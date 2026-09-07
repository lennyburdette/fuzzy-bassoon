/**
 * Google Sheets API client for the Bus Tracker app.
 * Uses the Sheets API v4 via fetch with OAuth access tokens.
 */

import {
	getAccessToken,
	ensureFreshToken,
	trySilentTokenAcquisition
} from '$lib/state/auth.svelte';
import {
	isSheetCached,
	cacheSheetExists,
	getCachedRowIndex,
	updateRowIndexCache,
	deduplicateRequest,
	recordRateLimitHit,
	recordSuccessfulCall
} from './sheets-cache';
import {
	getCurrentTimeEastern,
	getTodayDateEastern,
	getSessionSheetName,
	parseSessionSheetName,
	normalizeTimeString,
	type Session
} from '$lib/utils/time';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

export interface BusConfig {
	bus_number: string;
	am_expected_arrival_time: string;
	pm_expected_arrival_time: string;
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

export interface UncoveredIncident {
	date: string;
	session: Session;
	busNumber: string;
}

export interface SessionRate {
	date: string;
	session: Session;
	scheduled: number;
	uncovered: number;
	ratePct: number;
}

export interface StatisticsReport {
	generatedAt: string;
	startDate: string;
	endDate: string;
	totalSessions: number;
	totalScheduledRuns: number;
	totalUncovered: number;
	uncoveredRatePct: number;
	exceedsDistrictAverage: boolean;
	uncoveredIncidents: UncoveredIncident[];
	sessionRates: SessionRate[];
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
 * Build an A1-notation range for a sheet, quoting the sheet name so that
 * names with spaces (like "2026-07-08 AM") are valid.
 */
function sheetRange(sheetName: string, cells: string): string {
	return `'${sheetName}'!${cells}`;
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
 * Authenticated fetch for Google APIs.
 * Refreshes the access token silently when it is missing or expired, and on a
 * 401 response attempts one silent re-acquisition and retries the request.
 */
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
	await ensureFreshToken();

	let response = await fetchWithRateLimitTracking(url, {
		...init,
		headers: getAuthHeaders()
	});

	if (response.status === 401) {
		// Token rejected server-side — try one silent refresh, then retry
		if (await trySilentTokenAcquisition()) {
			response = await fetchWithRateLimitTracking(url, {
				...init,
				headers: getAuthHeaders()
			});
		}
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
	const response = await apiFetch(`${DRIVE_API_BASE}/${fileId}/permissions`, {
		method: 'POST',
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

const CONFIG_HEADERS = [
	'bus_number',
	'am_expected_arrival_time',
	'pm_expected_arrival_time',
	'early_dismissal_overrides'
];
const CONFIG_DATA_RANGE = 'Config!A2:D100';

/**
 * Parse a raw Config sheet row into a BusConfig object.
 */
function parseConfigRow(row: string[]): BusConfig {
	const overrides: Record<string, string> = row[3] ? JSON.parse(row[3]) : {};

	return {
		bus_number: row[0] || '',
		am_expected_arrival_time: normalizeTimeString(row[1] || ''),
		pm_expected_arrival_time: normalizeTimeString(row[2] || ''),
		early_dismissal_overrides: Object.fromEntries(
			Object.entries(overrides).map(([date, time]) => [date, normalizeTimeString(time)])
		)
	};
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
	const response = await apiFetch(SHEETS_API_BASE, {
		method: 'POST',
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
	await updateSheetValues(spreadsheetId, 'Config!A1:D1', [CONFIG_HEADERS]);

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
	const response = await apiFetch(`${SHEETS_API_BASE}/${spreadsheetId}`);

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
	const response = await apiFetch(
		`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`
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

	const response = await apiFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${params}`);

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
	// RAW (not USER_ENTERED) so Sheets stores our strings verbatim instead of
	// auto-detecting and reformatting them as dates/times/numbers/booleans -
	// e.g. USER_ENTERED turns "07:00" into a locale-formatted time value that
	// no longer round-trips as "HH:MM" for <input type="time">.
	const response = await apiFetch(
		`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
		{
			method: 'PUT',
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
	const response = await apiFetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
		method: 'POST',
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
	const values = await getSheetValues(spreadsheetId, CONFIG_DATA_RANGE);
	return values.map(parseConfigRow);
}

/**
 * Get the effective expected arrival time for a bus on a given date + session.
 * Early dismissal overrides apply to the afternoon (PM) session only.
 */
export function getEffectiveArrivalTime(bus: BusConfig, date: string, session: Session): string {
	if (session === 'AM') {
		return bus.am_expected_arrival_time;
	}
	return bus.early_dismissal_overrides?.[date] || bus.pm_expected_arrival_time;
}

/**
 * Save the bus configuration.
 */
export async function saveBusConfig(spreadsheetId: string, config: BusConfig[]): Promise<void> {
	const values = [
		CONFIG_HEADERS,
		...config.map((c) => [
			c.bus_number,
			c.am_expected_arrival_time,
			c.pm_expected_arrival_time,
			c.early_dismissal_overrides && Object.keys(c.early_dismissal_overrides).length > 0
				? JSON.stringify(c.early_dismissal_overrides)
				: ''
		])
	];

	await updateSheetValues(spreadsheetId, 'Config!A1:D' + (config.length + 1), values);
}

/**
 * Get today's date in YYYY-MM-DD format (US Eastern timezone).
 */
export function getTodayDate(): string {
	return getTodayDateEastern();
}

/**
 * Ensure a session sheet (e.g. "2026-07-08 AM") exists and has data for all
 * configured buses.
 * Uses caching to avoid repeated API calls once sheet existence is confirmed.
 */
export async function ensureDailySheet(
	spreadsheetId: string,
	session: Session,
	date: string = getTodayDate()
): Promise<void> {
	const sheetName = getSessionSheetName(date, session);

	// Fast path: if we already know the sheet exists, skip all checks
	if (isSheetCached(spreadsheetId, sheetName)) {
		return;
	}

	// Deduplicate concurrent calls for the same spreadsheet/sheet
	return deduplicateRequest(`ensureDailySheet:${spreadsheetId}:${sheetName}`, async () => {
		const info = await getSpreadsheetInfo(spreadsheetId);
		const sheetExists = info.sheets.includes(sheetName);

		if (!sheetExists) {
			// Sheet doesn't exist - create it
			await addSheet(spreadsheetId, sheetName);
		}

		// Get config and current sheet data
		const config = await getBusConfig(spreadsheetId);
		const existingValues = sheetExists
			? await getSheetValues(spreadsheetId, sheetRange(sheetName, `A1:G${config.length + 1}`))
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

			await updateSheetValues(
				spreadsheetId,
				sheetRange(sheetName, `A1:G${config.length + 1}`),
				values
			);
		}

		// Cache that the sheet now exists and is valid
		cacheSheetExists(spreadsheetId, sheetName);
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
		arrival_time: normalizeTimeString(row[3] || ''),
		departure_time: normalizeTimeString(row[4] || ''),
		last_modified_by: row[5] || '',
		last_modified_at: row[6] || ''
	};
}

/**
 * Get bus status for a specific session (and date).
 * Uses deduplication to prevent concurrent identical requests.
 */
export async function getBusStatus(
	spreadsheetId: string,
	session: Session,
	date: string = getTodayDate()
): Promise<BusStatus[]> {
	await ensureDailySheet(spreadsheetId, session, date);

	const sheetName = getSessionSheetName(date, session);

	// Deduplicate concurrent calls
	return deduplicateRequest(`getBusStatus:${spreadsheetId}:${sheetName}`, async () => {
		const values = await getSheetValues(spreadsheetId, sheetRange(sheetName, 'A2:G100'));

		const statuses = values.map(parseStatusRow);

		// Update row index cache for future updates
		updateRowIndexCache(spreadsheetId, sheetName, statuses);

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
	session: Session,
	date: string = getTodayDate()
): Promise<void> {
	await ensureDailySheet(spreadsheetId, session, date);

	const sheetName = getSessionSheetName(date, session);

	// Try to get row index from cache first
	let rowIndex = getCachedRowIndex(spreadsheetId, sheetName, busNumber);

	if (rowIndex === null) {
		// Cache miss - need to fetch the data to find the row
		const currentData = await getBusStatus(spreadsheetId, session, date);
		rowIndex = currentData.findIndex((b) => b.bus_number === busNumber);

		if (rowIndex === -1) {
			throw new Error(`Bus ${busNumber} not found`);
		}
	}

	// Row in sheet (1-indexed, +1 for header row)
	const sheetRow = rowIndex + 2;

	// Read just this single row to get current values for merging
	const currentRowValues = await getSheetValues(
		spreadsheetId,
		sheetRange(sheetName, `A${sheetRow}:G${sheetRow}`)
	);

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
	await updateSheetValues(spreadsheetId, sheetRange(sheetName, `A${sheetRow}:G${sheetRow}`), [
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
	session: Session,
	arrivalTime?: string
): Promise<void> {
	const time = arrivalTime || getCurrentTimeEastern();
	await updateBusStatus(spreadsheetId, busNumber, { arrival_time: time }, userEmail, session);
}

/**
 * Mark a bus as departed.
 */
export async function markBusDeparted(
	spreadsheetId: string,
	busNumber: string,
	userEmail: string,
	session: Session,
	departureTime?: string
): Promise<void> {
	const time = departureTime || getCurrentTimeEastern();
	await updateBusStatus(spreadsheetId, busNumber, { departure_time: time }, userEmail, session);
}

/**
 * Mark a bus as covered by another bus. Does not set arrival_time;
 * the bus remains pending until explicitly marked arrived.
 */
export async function markBusCovered(
	spreadsheetId: string,
	busNumber: string,
	coveredBy: string,
	userEmail: string,
	session: Session
): Promise<void> {
	await updateBusStatus(spreadsheetId, busNumber, { covered_by: coveredBy }, userEmail, session);
}

/**
 * Mark a bus as uncovered (no-show).
 */
export async function markBusUncovered(
	spreadsheetId: string,
	busNumber: string,
	userEmail: string,
	session: Session
): Promise<void> {
	await updateBusStatus(spreadsheetId, busNumber, { is_uncovered: true }, userEmail, session);
}

/**
 * Batch fetch config and status data in a single API call.
 * This is the most efficient way to load initial data.
 * Returns null for status if the session sheet doesn't exist yet.
 */
export async function getBusDataBatched(
	spreadsheetId: string,
	session: Session,
	date: string = getTodayDate()
): Promise<{ config: BusConfig[]; status: BusStatus[] | null; sheetExists: boolean }> {
	const sheetName = getSessionSheetName(date, session);

	// First check if we need to know about sheet existence
	const info = await getSpreadsheetInfo(spreadsheetId);
	const sheetExists = info.sheets.includes(sheetName);

	if (sheetExists) {
		// Validate and repair the sheet structure before reading
		// (this also caches that the sheet exists and is valid)
		await ensureDailySheet(spreadsheetId, session, date);

		// Batch fetch both config and status in one call
		const [configValues, statusValues] = await batchGetValues(spreadsheetId, [
			CONFIG_DATA_RANGE,
			sheetRange(sheetName, 'A2:G100')
		]);

		const config = configValues.map(parseConfigRow);
		const status = statusValues.map(parseStatusRow);

		// Update row index cache
		updateRowIndexCache(spreadsheetId, sheetName, status);

		return { config, status, sheetExists: true };
	} else {
		// Sheet doesn't exist - just get config
		const configValues = await getSheetValues(spreadsheetId, CONFIG_DATA_RANGE);
		return { config: configValues.map(parseConfigRow), status: null, sheetExists: false };
	}
}

/**
 * Get all session sheets (e.g. "2026-07-08 AM"), sorted chronologically
 * (AM sorts before PM within a date).
 */
export async function getAvailableSessionSheets(spreadsheetId: string): Promise<string[]> {
	const info = await getSpreadsheetInfo(spreadsheetId);
	return info.sheets.filter((name) => parseSessionSheetName(name) !== null).sort();
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
		totalSessions: 0,
		totalScheduledRuns: 0,
		totalUncovered: 0,
		uncoveredRatePct: 0,
		exceedsDistrictAverage: false,
		uncoveredIncidents: [],
		sessionRates: []
	};

	type TableContext = 'none' | 'summary' | 'session_rates' | 'uncovered';
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
		if (firstCell === '--- SESSION RATES ---') {
			currentTable = 'session_rates';
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
				report.totalSessions = parseInt(row[3], 10) || 0;
				report.totalScheduledRuns = parseInt(row[4], 10) || 0;
				report.totalUncovered = parseInt(row[5], 10) || 0;
				report.uncoveredRatePct = parseFloat(row[6]) || 0;
				report.exceedsDistrictAverage = row[7] === 'TRUE';
				break;

			case 'session_rates':
				report.sessionRates.push({
					date: row[0] || '',
					session: row[1] === 'AM' ? 'AM' : 'PM',
					scheduled: parseInt(row[2], 10) || 0,
					uncovered: parseInt(row[3], 10) || 0,
					ratePct: parseFloat(row[4]) || 0
				});
				break;

			case 'uncovered':
				report.uncoveredIncidents.push({
					date: row[0] || '',
					session: row[1] === 'AM' ? 'AM' : 'PM',
					busNumber: row[2] || ''
				});
				break;
		}
	}

	// Sort session rates chronologically (AM before PM within a date)
	report.sessionRates.sort((a, b) =>
		`${a.date} ${a.session}`.localeCompare(`${b.date} ${b.session}`)
	);

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
	const values = await getSheetValues(spreadsheetId, 'Statistics!A1:H1000');
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
	rows.push([
		'Generated At',
		'Start Date',
		'End Date',
		'Total Sessions',
		'Scheduled Runs',
		'Uncovered Runs',
		'Uncovered Rate %',
		'Exceeds District Avg'
	]);
	rows.push([
		report.generatedAt,
		report.startDate,
		report.endDate,
		String(report.totalSessions),
		String(report.totalScheduledRuns),
		String(report.totalUncovered),
		String(report.uncoveredRatePct),
		report.exceedsDistrictAverage ? 'TRUE' : 'FALSE'
	]);

	// Blank row separator
	rows.push([]);

	// Session Rates Table
	rows.push(['--- SESSION RATES ---']);
	rows.push(['Date', 'Session', 'Scheduled', 'Uncovered', 'Rate %']);
	for (const rate of report.sessionRates) {
		rows.push([
			rate.date,
			rate.session,
			String(rate.scheduled),
			String(rate.uncovered),
			String(rate.ratePct)
		]);
	}

	// Blank row separator
	rows.push([]);

	// Uncovered Incidents Table
	rows.push(['--- UNCOVERED INCIDENTS ---']);
	rows.push(['Date', 'Session', 'Bus Number']);
	for (const incident of report.uncoveredIncidents) {
		rows.push([incident.date, incident.session, incident.busNumber]);
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

	// Determine the max column width needed (Summary table has 8 columns: A through H)
	const maxCols = 8;

	// Pad all rows to max width to ensure clean overwrite
	const paddedRows = rows.map((row) => {
		const padded = [...row];
		while (padded.length < maxCols) {
			padded.push('');
		}
		return padded;
	});

	// Write to sheet - use A1:H{rowCount} to cover full width
	await updateSheetValues(spreadsheetId, `Statistics!A1:H${paddedRows.length}`, paddedRows);
}

/**
 * Fetch ALL historical data for statistics calculation.
 * Uses batch API for efficiency. Data is keyed by session sheet name
 * (e.g. "2026-07-08 AM").
 */
export async function getAllHistoricalData(spreadsheetId: string): Promise<{
	config: BusConfig[];
	sessionData: Record<string, BusStatus[]>;
}> {
	const sheetNames = await getAvailableSessionSheets(spreadsheetId);

	if (sheetNames.length === 0) {
		// Just get config
		const config = await getBusConfig(spreadsheetId);
		return { config, sessionData: {} };
	}

	// Build ranges for batch fetch: config + all session sheets
	const ranges = [
		CONFIG_DATA_RANGE,
		...sheetNames.map((name) => sheetRange(name, 'A2:G100'))
	];

	const results = await batchGetValues(spreadsheetId, ranges);

	// First result is config
	const config = results[0].map(parseConfigRow);

	// Remaining results are session data
	const sessionData: Record<string, BusStatus[]> = {};
	for (let i = 0; i < sheetNames.length; i++) {
		sessionData[sheetNames[i]] = results[i + 1].map(parseStatusRow);
	}

	return { config, sessionData };
}
