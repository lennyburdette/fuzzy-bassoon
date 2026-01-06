/**
 * Google Sheets API client for the Bus Tracker app.
 * Uses the Sheets API v4 via fetch with OAuth access tokens.
 */

import { getAccessToken } from '$lib/state/auth.svelte';
import {
	isSheetCached,
	cacheSheetExists,
	getCachedRowIndex,
	updateRowIndexCache,
	deduplicateRequest,
	recordRateLimitHit,
	recordSuccessfulCall
} from './sheets-cache';
import { getCurrentTimeEastern, getTodayDateEastern } from '$lib/utils/time';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

export interface BusConfig {
	bus_number: string;
	expected_arrival_time: string;
	early_dismissal_overrides?: Record<string, string>; // date (YYYY-MM-DD) -> override time (HH:MM)
}

export interface BusStatus {
	bus_number: string;
	covered_by: string;
	is_uncovered: boolean;
	arrival_time: string;
	departure_time: string;
	last_modified_by: string;
	last_modified_at: string;
}

export interface StatisticsReport {
	generatedAt: string;
	startDate: string;
	endDate: string;
	totalDays: number;
	totalBusArrivals: number;
	overallOnTimePct: number;
	perBusStats: {
		busNumber: string;
		avgDelayMinutes: number;
		maxDelayMinutes: number;
		onTimePct: number;
	}[];
	uncoveredIncidents: {
		date: string;
		busNumber: string;
	}[];
	coveragePairs: {
		coveringBus: string;
		coveredBus: string;
		count: number;
	}[];
	dailyCounts: {
		date: string;
		total: number;
		onTime: number;
		late: number;
		uncovered: number;
	}[];
}

export type BusDerivedStatus = 'pending' | 'arrived' | 'departed' | 'uncovered';

/**
 * Derive the display status from bus data.
 * Note: covered_by is orthogonal to status - a bus can be covered AND arrived/departed.
 */
export function deriveBusStatus(bus: BusStatus): BusDerivedStatus {
	if (bus.is_uncovered) return 'uncovered';
	if (bus.departure_time) return 'departed';
	if (bus.arrival_time) return 'arrived';
	return 'pending';
}

/**
 * Get authorization headers for API calls.
 */
function getAuthHeaders(): HeadersInit {
	const token = getAccessToken();
	if (!token) {
		throw new Error('Not authenticated');
	}
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	};
}

/**
 * Wrapper for fetch that tracks rate limits.
 * Records 429 errors for adaptive throttling.
 */
async function fetchWithRateLimitTracking(
	url: string,
	options?: RequestInit
): Promise<Response> {
	const response = await fetch(url, options);

	if (response.status === 429) {
		recordRateLimitHit();
	} else if (response.ok) {
		recordSuccessfulCall();
	}

	return response;
}

/**
 * Set domain-wide read/write permission on a file.
 * Anyone in the specified domain will have writer access.
 * Returns true if successful, false if the domain doesn't support this permission type
 * (e.g., personal Gmail accounts).
 */
async function setDomainPermission(fileId: string, domain: string): Promise<boolean> {
	const response = await fetch(`${DRIVE_API_BASE}/${fileId}/permissions`, {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			type: 'domain',
			role: 'writer',
			domain: domain
		})
	});

	if (!response.ok) {
		const error = await response.json();
		const errorMessage = error.error?.message || '';

		// Personal accounts (e.g., gmail.com) don't support domain-wide sharing
		// Gracefully ignore this error
		if (errorMessage.includes('invalid or not applicable for the given permission type')) {
			console.warn(`Domain sharing not supported for ${domain}, skipping.`);
			return false;
		}

		throw new Error(errorMessage || 'Failed to set domain permission');
	}

	return true;
}

/**
 * Create a new Google Sheet for bus tracking.
 * If userEmail is provided, shares the spreadsheet with the user's domain.
 */
export async function createSpreadsheet(
	title: string = 'Bus Tracker',
	userEmail?: string
): Promise<string> {
	// Create the spreadsheet with initial sheets
	const response = await fetch(SHEETS_API_BASE, {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			properties: {
				title
			},
			sheets: [
				{
					properties: {
						title: 'Config',
						gridProperties: {
							frozenRowCount: 1
						}
					}
				}
			]
		})
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to create spreadsheet');
	}

	const data = await response.json();
	const spreadsheetId = data.spreadsheetId;

	// Add headers to Config sheet
	await updateSheetValues(spreadsheetId, 'Config!A1:B1', [['bus_number', 'expected_arrival_time']]);

	// Share with user's domain if email provided
	if (userEmail) {
		const domain = userEmail.split('@')[1];
		if (domain) {
			await setDomainPermission(spreadsheetId, domain);
		}
	}

	return spreadsheetId;
}

/**
 * Get spreadsheet metadata.
 */
export async function getSpreadsheetInfo(
	spreadsheetId: string
): Promise<{ title: string; sheets: string[] }> {
	const response = await fetchWithRateLimitTracking(`${SHEETS_API_BASE}/${spreadsheetId}`, {
		headers: getAuthHeaders()
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to get spreadsheet');
	}

	const data = await response.json();
	return {
		title: data.properties.title,
		sheets: data.sheets.map((s: { properties: { title: string } }) => s.properties.title)
	};
}

/**
 * Read values from a sheet.
 */
async function getSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
	const response = await fetchWithRateLimitTracking(
		`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
		{
			headers: getAuthHeaders()
		}
	);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to read sheet');
	}

	const data = await response.json();
	return data.values || [];
}

/**
 * Batch read multiple ranges in a single API call.
 * Returns an array of value arrays, one per range requested.
 */
async function batchGetValues(spreadsheetId: string, ranges: string[]): Promise<string[][][]> {
	const params = new URLSearchParams();
	for (const range of ranges) {
		params.append('ranges', range);
	}

	const response = await fetchWithRateLimitTracking(
		`${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${params}`,
		{
			headers: getAuthHeaders()
		}
	);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to batch read sheets');
	}

	const data = await response.json();
	// Each valueRange has a 'values' property
	return (data.valueRanges || []).map(
		(vr: { values?: string[][] }) => vr.values || []
	);
}

/**
 * Update values in a sheet.
 */
async function updateSheetValues(
	spreadsheetId: string,
	range: string,
	values: string[][]
): Promise<void> {
	const response = await fetch(
		`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
		{
			method: 'PUT',
			headers: getAuthHeaders(),
			body: JSON.stringify({ values })
		}
	);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to update sheet');
	}
}

/**
 * Add a new sheet (tab) to the spreadsheet.
 */
async function addSheet(spreadsheetId: string, sheetTitle: string): Promise<void> {
	const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({
			requests: [
				{
					addSheet: {
						properties: {
							title: sheetTitle,
							gridProperties: {
								frozenRowCount: 1
							}
						}
					}
				}
			]
		})
	});

	if (!response.ok) {
		const error = await response.json();
		// Ignore if sheet already exists
		if (!error.error?.message?.includes('already exists')) {
			throw new Error(error.error?.message || 'Failed to add sheet');
		}
	}
}

/**
 * Get the bus configuration.
 */
export async function getBusConfig(spreadsheetId: string): Promise<BusConfig[]> {
	const values = await getSheetValues(spreadsheetId, 'Config!A2:C100');

	return values.map((row) => ({
		bus_number: row[0] || '',
		expected_arrival_time: row[1] || '',
		early_dismissal_overrides: row[2] ? JSON.parse(row[2]) : {}
	}));
}

/**
 * Get the effective arrival time for a bus on a given date.
 * Returns the override time if one exists, otherwise the expected arrival time.
 */
export function getEffectiveArrivalTime(bus: BusConfig, date: string): string {
	return bus.early_dismissal_overrides?.[date] || bus.expected_arrival_time;
}

/**
 * Save the bus configuration.
 */
export async function saveBusConfig(spreadsheetId: string, config: BusConfig[]): Promise<void> {
	const values = [
		['bus_number', 'expected_arrival_time', 'early_dismissal_overrides'],
		...config.map((c) => [
			c.bus_number,
			c.expected_arrival_time,
			c.early_dismissal_overrides && Object.keys(c.early_dismissal_overrides).length > 0
				? JSON.stringify(c.early_dismissal_overrides)
				: ''
		])
	];

	await updateSheetValues(spreadsheetId, 'Config!A1:C' + (config.length + 1), values);
}

/**
 * Get today's date in YYYY-MM-DD format (US Eastern timezone).
 */
export function getTodayDate(): string {
	return getTodayDateEastern();
}

/**
 * Ensure a daily sheet exists and has data for all configured buses.
 * Uses caching to avoid repeated API calls once sheet existence is confirmed.
 */
export async function ensureDailySheet(
	spreadsheetId: string,
	date: string = getTodayDate()
): Promise<void> {
	// Fast path: if we already know the sheet exists, skip all checks
	if (isSheetCached(spreadsheetId, date)) {
		return;
	}

	// Deduplicate concurrent calls for the same spreadsheet/date
	return deduplicateRequest(`ensureDailySheet:${spreadsheetId}:${date}`, async () => {
		const info = await getSpreadsheetInfo(spreadsheetId);
		const sheetExists = info.sheets.includes(date);

		if (!sheetExists) {
			// Sheet doesn't exist - create it
			await addSheet(spreadsheetId, date);
		}

		// Get config and current sheet data
		const config = await getBusConfig(spreadsheetId);
		const existingValues = sheetExists
			? await getSheetValues(spreadsheetId, `${date}!A1:G${config.length + 1}`)
			: [];

		// Check if sheet needs to be populated/repaired
		// A valid sheet has: header row + one row per config bus
		const hasValidHeader =
			existingValues.length > 0 &&
			existingValues[0][0] === 'bus_number' &&
			existingValues[0][3] === 'arrival_time';

		const existingBuses = new Set(
			existingValues.slice(1).map((row) => row[0]).filter(Boolean)
		);
		const configBuses = new Set(config.map((c) => c.bus_number));
		const allBusesPresent =
			configBuses.size > 0 &&
			[...configBuses].every((bus) => existingBuses.has(bus));

		if (!hasValidHeader || !allBusesPresent) {
			// Sheet is empty or missing buses - write full structure
			// Preserve existing data for buses that are present
			const existingDataMap = new Map<string, string[]>();
			for (const row of existingValues.slice(1)) {
				if (row[0]) {
					existingDataMap.set(row[0], row);
				}
			}

			const values = [
				[
					'bus_number',
					'covered_by',
					'is_uncovered',
					'arrival_time',
					'departure_time',
					'last_modified_by',
					'last_modified_at'
				],
				...config.map((c) => {
					const existing = existingDataMap.get(c.bus_number);
					if (existing) {
						// Preserve existing data
						return [
							existing[0] || c.bus_number,
							existing[1] || '',
							existing[2] || 'FALSE',
							existing[3] || '',
							existing[4] || '',
							existing[5] || '',
							existing[6] || ''
						];
					}
					// New bus - empty row
					return [c.bus_number, '', 'FALSE', '', '', '', ''];
				})
			];

			await updateSheetValues(spreadsheetId, `${date}!A1:G${config.length + 1}`, values);
		}

		// Cache that the sheet now exists and is valid
		cacheSheetExists(spreadsheetId, date);
	});
}

/**
 * Parse raw sheet row values into BusStatus object.
 */
function parseStatusRow(row: string[]): BusStatus {
	return {
		bus_number: row[0] || '',
		covered_by: row[1] || '',
		is_uncovered: row[2] === 'TRUE',
		arrival_time: row[3] || '',
		departure_time: row[4] || '',
		last_modified_by: row[5] || '',
		last_modified_at: row[6] || ''
	};
}

/**
 * Get bus status for a specific date.
 * Uses deduplication to prevent concurrent identical requests.
 */
export async function getBusStatus(
	spreadsheetId: string,
	date: string = getTodayDate()
): Promise<BusStatus[]> {
	await ensureDailySheet(spreadsheetId, date);

	// Deduplicate concurrent calls
	return deduplicateRequest(`getBusStatus:${spreadsheetId}:${date}`, async () => {
		const values = await getSheetValues(spreadsheetId, `${date}!A2:G100`);

		const statuses = values.map(parseStatusRow);

		// Update row index cache for future updates
		updateRowIndexCache(spreadsheetId, date, statuses);

		return statuses;
	});
}

/**
 * Update a single bus status.
 * Uses cached row index when available to avoid full sheet reads.
 */
export async function updateBusStatus(
	spreadsheetId: string,
	busNumber: string,
	updates: Partial<BusStatus>,
	userEmail: string,
	date: string = getTodayDate()
): Promise<void> {
	await ensureDailySheet(spreadsheetId, date);

	// Try to get row index from cache first
	let rowIndex = getCachedRowIndex(spreadsheetId, date, busNumber);

	if (rowIndex === null) {
		// Cache miss - need to fetch the data to find the row
		const currentData = await getBusStatus(spreadsheetId, date);
		rowIndex = currentData.findIndex((b) => b.bus_number === busNumber);

		if (rowIndex === -1) {
			throw new Error(`Bus ${busNumber} not found`);
		}
	}

	// Row in sheet (1-indexed, +1 for header row)
	const sheetRow = rowIndex + 2;

	// Read just this single row to get current values for merging
	const currentRowValues = await getSheetValues(spreadsheetId, `${date}!A${sheetRow}:G${sheetRow}`);

	if (!currentRowValues.length) {
		throw new Error(`Bus ${busNumber} not found at row ${sheetRow}`);
	}

	const currentBus = parseStatusRow(currentRowValues[0]);

	// Merge updates
	const updatedBus: BusStatus = {
		...currentBus,
		...updates,
		last_modified_by: userEmail,
		last_modified_at: new Date().toISOString()
	};

	// Write back single row
	await updateSheetValues(spreadsheetId, `${date}!A${sheetRow}:G${sheetRow}`, [
		[
			updatedBus.bus_number,
			updatedBus.covered_by,
			updatedBus.is_uncovered ? 'TRUE' : 'FALSE',
			updatedBus.arrival_time,
			updatedBus.departure_time,
			updatedBus.last_modified_by,
			updatedBus.last_modified_at
		]
	]);
}

/**
 * Mark a bus as arrived.
 */
export async function markBusArrived(
	spreadsheetId: string,
	busNumber: string,
	userEmail: string,
	arrivalTime?: string
): Promise<void> {
	const time = arrivalTime || getCurrentTimeEastern();
	await updateBusStatus(spreadsheetId, busNumber, { arrival_time: time }, userEmail);
}

/**
 * Mark a bus as departed.
 */
export async function markBusDeparted(
	spreadsheetId: string,
	busNumber: string,
	userEmail: string,
	departureTime?: string
): Promise<void> {
	const time = departureTime || getCurrentTimeEastern();
	await updateBusStatus(spreadsheetId, busNumber, { departure_time: time }, userEmail);
}

/**
 * Mark a bus as covered by another bus. Also marks as arrived.
 */
export async function markBusCovered(
	spreadsheetId: string,
	busNumber: string,
	coveredBy: string,
	userEmail: string
): Promise<void> {
	const arrivalTime = getCurrentTimeEastern();
	await updateBusStatus(
		spreadsheetId,
		busNumber,
		{ covered_by: coveredBy, arrival_time: arrivalTime },
		userEmail
	);
}

/**
 * Mark a bus as uncovered (no-show).
 */
export async function markBusUncovered(
	spreadsheetId: string,
	busNumber: string,
	userEmail: string
): Promise<void> {
	await updateBusStatus(spreadsheetId, busNumber, { is_uncovered: true }, userEmail);
}

/**
 * Batch fetch config and status data in a single API call.
 * This is the most efficient way to load initial data.
 * Returns null for status if the daily sheet doesn't exist yet.
 */
export async function getBusDataBatched(
	spreadsheetId: string,
	date: string = getTodayDate()
): Promise<{ config: BusConfig[]; status: BusStatus[] | null; sheetExists: boolean }> {
	// First check if we need to know about sheet existence
	const info = await getSpreadsheetInfo(spreadsheetId);
	const sheetExists = info.sheets.includes(date);

	if (sheetExists) {
		// Cache that sheet exists
		cacheSheetExists(spreadsheetId, date);

		// Batch fetch both config and status in one call
		const [configValues, statusValues] = await batchGetValues(spreadsheetId, [
			'Config!A2:C100',
			`${date}!A2:G100`
		]);

		const config = configValues.map((row) => ({
			bus_number: row[0] || '',
			expected_arrival_time: row[1] || '',
			early_dismissal_overrides: row[2] ? JSON.parse(row[2]) : {}
		}));

		const status = statusValues.map(parseStatusRow);

		// Update row index cache
		updateRowIndexCache(spreadsheetId, date, status);

		return { config, status, sheetExists: true };
	} else {
		// Sheet doesn't exist - just get config
		const configValues = await getSheetValues(spreadsheetId, 'Config!A2:C100');

		const config = configValues.map((row) => ({
			bus_number: row[0] || '',
			expected_arrival_time: row[1] || '',
			early_dismissal_overrides: row[2] ? JSON.parse(row[2]) : {}
		}));

		return { config, status: null, sheetExists: false };
	}
}

/**
 * Get all daily sheets (dates) available.
 */
export async function getAvailableDates(spreadsheetId: string): Promise<string[]> {
	const info = await getSpreadsheetInfo(spreadsheetId);
	return info.sheets.filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
}

/**
 * Get historical data for statistics.
 */
export async function getHistoricalData(
	spreadsheetId: string,
	startDate: string,
	endDate: string
): Promise<Record<string, BusStatus[]>> {
	const dates = await getAvailableDates(spreadsheetId);
	const filteredDates = dates.filter((d) => d >= startDate && d <= endDate);

	const result: Record<string, BusStatus[]> = {};

	for (const date of filteredDates) {
		result[date] = await getBusStatus(spreadsheetId, date);
	}

	return result;
}

/**
 * Check if the Statistics sheet exists.
 */
export async function hasStatisticsSheet(spreadsheetId: string): Promise<boolean> {
	const info = await getSpreadsheetInfo(spreadsheetId);
	return info.sheets.includes('Statistics');
}

/**
 * Ensure the Statistics sheet exists.
 * No initial headers needed - the horizontal tables include their own headers.
 */
export async function ensureStatisticsSheet(spreadsheetId: string): Promise<void> {
	const exists = await hasStatisticsSheet(spreadsheetId);
	if (exists) return;

	await addSheet(spreadsheetId, 'Statistics');
}

/**
 * Parse Statistics sheet data into a StatisticsReport object.
 * Uses state-machine parsing based on section markers.
 */
function parseStatisticsRows(rows: string[][]): StatisticsReport | null {
	if (rows.length === 0) return null;

	const report: StatisticsReport = {
		generatedAt: '',
		startDate: '',
		endDate: '',
		totalDays: 0,
		totalBusArrivals: 0,
		overallOnTimePct: 0,
		perBusStats: [],
		uncoveredIncidents: [],
		coveragePairs: [],
		dailyCounts: []
	};

	type TableContext = 'none' | 'summary' | 'per_bus' | 'daily' | 'coverage' | 'uncovered';
	let currentTable: TableContext = 'none';
	let skipNextRow = false; // Skip header rows after markers

	for (const row of rows) {
		const firstCell = (row[0] || '').trim();

		// Detect table markers
		if (firstCell === '--- SUMMARY ---') {
			currentTable = 'summary';
			skipNextRow = true;
			continue;
		}
		if (firstCell === '--- PER-BUS STATISTICS ---') {
			currentTable = 'per_bus';
			skipNextRow = true;
			continue;
		}
		if (firstCell === '--- DAILY COUNTS ---') {
			currentTable = 'daily';
			skipNextRow = true;
			continue;
		}
		if (firstCell === '--- COVERAGE PAIRS ---') {
			currentTable = 'coverage';
			skipNextRow = true;
			continue;
		}
		if (firstCell === '--- UNCOVERED INCIDENTS ---') {
			currentTable = 'uncovered';
			skipNextRow = true;
			continue;
		}

		// Skip header rows (row immediately after marker)
		if (skipNextRow) {
			skipNextRow = false;
			continue;
		}

		// Skip empty rows
		if (!firstCell) continue;

		// Parse based on current table context
		switch (currentTable) {
			case 'summary':
				// Summary has exactly one data row
				report.generatedAt = row[0] || '';
				report.startDate = row[1] || '';
				report.endDate = row[2] || '';
				report.totalDays = parseInt(row[3], 10) || 0;
				report.totalBusArrivals = parseInt(row[4], 10) || 0;
				report.overallOnTimePct = parseFloat(row[5]) || 0;
				break;

			case 'per_bus':
				report.perBusStats.push({
					busNumber: row[0] || '',
					avgDelayMinutes: parseFloat(row[1]) || 0,
					maxDelayMinutes: parseFloat(row[2]) || 0,
					onTimePct: parseFloat(row[3]) || 0
				});
				break;

			case 'daily':
				report.dailyCounts.push({
					date: row[0] || '',
					total: parseInt(row[1], 10) || 0,
					onTime: parseInt(row[2], 10) || 0,
					late: parseInt(row[3], 10) || 0,
					uncovered: parseInt(row[4], 10) || 0
				});
				break;

			case 'coverage':
				report.coveragePairs.push({
					coveringBus: row[0] || '',
					coveredBus: row[1] || '',
					count: parseInt(row[2], 10) || 0
				});
				break;

			case 'uncovered':
				report.uncoveredIncidents.push({
					date: row[0] || '',
					busNumber: row[1] || ''
				});
				break;
		}
	}

	// Sort daily counts by date
	report.dailyCounts.sort((a, b) => a.date.localeCompare(b.date));

	return report.generatedAt ? report : null;
}

/**
 * Get the statistics report from the Statistics sheet.
 * Returns null if no report has been generated yet.
 */
export async function getStatisticsReport(spreadsheetId: string): Promise<StatisticsReport | null> {
	const exists = await hasStatisticsSheet(spreadsheetId);
	if (!exists) return null;

	// Read from row 1 - the horizontal tables include their own section markers and headers
	const values = await getSheetValues(spreadsheetId, 'Statistics!A1:F1000');
	return parseStatisticsRows(values);
}

/**
 * Convert a StatisticsReport to row format for the Statistics sheet.
 * Uses horizontal tables with section markers for human readability.
 */
function statisticsReportToRows(report: StatisticsReport): string[][] {
	const rows: string[][] = [];

	// Summary Table
	rows.push(['--- SUMMARY ---']);
	rows.push(['Generated At', 'Start Date', 'End Date', 'Total Days', 'Total Arrivals', 'On-Time %']);
	rows.push([
		report.generatedAt,
		report.startDate,
		report.endDate,
		String(report.totalDays),
		String(report.totalBusArrivals),
		String(report.overallOnTimePct)
	]);

	// Blank row separator
	rows.push([]);

	// Per-Bus Stats Table
	rows.push(['--- PER-BUS STATISTICS ---']);
	rows.push(['Bus Number', 'Avg Delay (min)', 'Max Delay (min)', 'On-Time %']);
	for (const bus of report.perBusStats) {
		rows.push([
			bus.busNumber,
			String(bus.avgDelayMinutes),
			String(bus.maxDelayMinutes),
			String(bus.onTimePct)
		]);
	}

	// Blank row separator
	rows.push([]);

	// Daily Counts Table
	rows.push(['--- DAILY COUNTS ---']);
	rows.push(['Date', 'Total', 'On-Time', 'Late', 'Uncovered']);
	for (const day of report.dailyCounts) {
		rows.push([
			day.date,
			String(day.total),
			String(day.onTime),
			String(day.late),
			String(day.uncovered)
		]);
	}

	// Blank row separator
	rows.push([]);

	// Coverage Pairs Table
	rows.push(['--- COVERAGE PAIRS ---']);
	rows.push(['Covering Bus', 'Covered Bus', 'Count']);
	for (const pair of report.coveragePairs) {
		rows.push([pair.coveringBus, pair.coveredBus, String(pair.count)]);
	}

	// Blank row separator
	rows.push([]);

	// Uncovered Incidents Table
	rows.push(['--- UNCOVERED INCIDENTS ---']);
	rows.push(['Date', 'Bus Number']);
	for (const incident of report.uncoveredIncidents) {
		rows.push([incident.date, incident.busNumber]);
	}

	return rows;
}

/**
 * Save a statistics report to the Statistics sheet.
 * Clears existing data and writes the new report.
 */
export async function saveStatisticsReport(
	spreadsheetId: string,
	report: StatisticsReport
): Promise<void> {
	await ensureStatisticsSheet(spreadsheetId);

	const rows = statisticsReportToRows(report);

	// Determine the max column width needed (Summary table has 6 columns: A through F)
	const maxCols = 6;

	// Pad all rows to max width to ensure clean overwrite
	const paddedRows = rows.map((row) => {
		const padded = [...row];
		while (padded.length < maxCols) {
			padded.push('');
		}
		return padded;
	});

	// Write to sheet - use A1:F{rowCount} to cover full width
	await updateSheetValues(spreadsheetId, `Statistics!A1:F${paddedRows.length}`, paddedRows);
}

/**
 * Fetch ALL historical data for statistics calculation.
 * Uses batch API for efficiency.
 */
export async function getAllHistoricalData(spreadsheetId: string): Promise<{
	config: BusConfig[];
	dailyData: Record<string, BusStatus[]>;
}> {
	const dates = await getAvailableDates(spreadsheetId);

	if (dates.length === 0) {
		// Just get config
		const config = await getBusConfig(spreadsheetId);
		return { config, dailyData: {} };
	}

	// Build ranges for batch fetch: config + all daily sheets
	const ranges = ['Config!A2:C100', ...dates.map((date) => `${date}!A2:G100`)];

	const results = await batchGetValues(spreadsheetId, ranges);

	// First result is config
	const config = results[0].map((row) => ({
		bus_number: row[0] || '',
		expected_arrival_time: row[1] || '',
		early_dismissal_overrides: row[2] ? JSON.parse(row[2]) : {}
	}));

	// Remaining results are daily data
	const dailyData: Record<string, BusStatus[]> = {};
	for (let i = 0; i < dates.length; i++) {
		dailyData[dates[i]] = results[i + 1].map(parseStatusRow);
	}

	return { config, dailyData };
}
