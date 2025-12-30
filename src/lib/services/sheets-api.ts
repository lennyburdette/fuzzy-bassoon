/**
 * Google Sheets API client for the Bus Tracker app.
 * Uses the Sheets API v4 via fetch with OAuth access tokens.
 */

import { getAccessToken } from '$lib/state/auth.svelte';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

export interface BusConfig {
	bus_number: string;
	expected_arrival_time: string;
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
 * Create a new Google Sheet for bus tracking.
 */
export async function createSpreadsheet(title: string = 'Bus Tracker'): Promise<string> {
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

	return spreadsheetId;
}

/**
 * Get spreadsheet metadata.
 */
export async function getSpreadsheetInfo(
	spreadsheetId: string
): Promise<{ title: string; sheets: string[] }> {
	const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}`, {
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
	const response = await fetch(
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
	const values = await getSheetValues(spreadsheetId, 'Config!A2:B100');

	return values.map((row) => ({
		bus_number: row[0] || '',
		expected_arrival_time: row[1] || ''
	}));
}

/**
 * Save the bus configuration.
 */
export async function saveBusConfig(spreadsheetId: string, config: BusConfig[]): Promise<void> {
	const values = [
		['bus_number', 'expected_arrival_time'],
		...config.map((c) => [c.bus_number, c.expected_arrival_time])
	];

	await updateSheetValues(spreadsheetId, 'Config!A1:B' + (config.length + 1), values);
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function getTodayDate(): string {
	return new Date().toISOString().split('T')[0];
}

/**
 * Ensure a daily sheet exists and has data for all configured buses.
 */
export async function ensureDailySheet(
	spreadsheetId: string,
	date: string = getTodayDate()
): Promise<void> {
	const info = await getSpreadsheetInfo(spreadsheetId);
	const config = await getBusConfig(spreadsheetId);

	if (!info.sheets.includes(date)) {
		// Create the sheet
		await addSheet(spreadsheetId, date);

		// Add headers and initial data
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
			...config.map((c) => [c.bus_number, '', 'FALSE', '', '', '', ''])
		];

		await updateSheetValues(spreadsheetId, `${date}!A1:G${config.length + 1}`, values);
	} else {
		// Sheet exists - check if any configured buses are missing
		const existingData = await getSheetValues(spreadsheetId, `${date}!A2:A100`);
		const existingBusNumbers = new Set(existingData.map((row) => row[0]));

		const missingBuses = config.filter((c) => !existingBusNumbers.has(c.bus_number));

		if (missingBuses.length > 0) {
			// Append missing buses
			const startRow = existingData.length + 2; // +1 for header, +1 for 1-indexing
			const values = missingBuses.map((c) => [c.bus_number, '', 'FALSE', '', '', '', '']);
			await updateSheetValues(
				spreadsheetId,
				`${date}!A${startRow}:G${startRow + missingBuses.length - 1}`,
				values
			);
		}
	}
}

/**
 * Get bus status for a specific date.
 */
export async function getBusStatus(
	spreadsheetId: string,
	date: string = getTodayDate()
): Promise<BusStatus[]> {
	await ensureDailySheet(spreadsheetId, date);

	const values = await getSheetValues(spreadsheetId, `${date}!A2:G100`);

	return values.map((row) => ({
		bus_number: row[0] || '',
		covered_by: row[1] || '',
		is_uncovered: row[2] === 'TRUE',
		arrival_time: row[3] || '',
		departure_time: row[4] || '',
		last_modified_by: row[5] || '',
		last_modified_at: row[6] || ''
	}));
}

/**
 * Update a single bus status.
 */
export async function updateBusStatus(
	spreadsheetId: string,
	busNumber: string,
	updates: Partial<BusStatus>,
	userEmail: string,
	date: string = getTodayDate()
): Promise<void> {
	await ensureDailySheet(spreadsheetId, date);

	// Get current data to find the row
	const currentData = await getBusStatus(spreadsheetId, date);
	const rowIndex = currentData.findIndex((b) => b.bus_number === busNumber);

	if (rowIndex === -1) {
		throw new Error(`Bus ${busNumber} not found`);
	}

	// Merge updates
	const updatedBus: BusStatus = {
		...currentData[rowIndex],
		...updates,
		last_modified_by: userEmail,
		last_modified_at: new Date().toISOString()
	};

	// Write back (row index + 2 because of 1-indexing and header row)
	const row = rowIndex + 2;
	await updateSheetValues(spreadsheetId, `${date}!A${row}:G${row}`, [
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
	const time =
		arrivalTime ||
		new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
	const time =
		departureTime ||
		new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
	const arrivalTime = new Date().toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
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
