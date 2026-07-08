import type { Page, Route } from '@playwright/test';

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

export interface MockSheetData {
	spreadsheetId: string;
	config: BusConfig[];
	sessionData: Record<string, BusStatus[]>; // keyed by session sheet name, e.g. "2026-07-08 AM"
	statisticsData?: string[][]; // raw Statistics sheet data (key-value rows)
}

export interface MockSheetsOptions {
	/** Respond 401 to the first API request (to exercise the silent-refresh retry). */
	failFirstRequestWith401?: boolean;
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const SESSION_SHEET_PATTERN = /^\d{4}-\d{2}-\d{2} (AM|PM)$/;

function parseRowRange(range: string): { startRow: number; endRow: number } | null {
	const match = range.match(/!A(\d+):[A-Z]+(\d+)/);
	if (!match) return null;
	return { startRow: Number(match[1]), endRow: Number(match[2]) };
}

/**
 * Extract the sheet name from an A1-notation range, handling quoted names
 * like "'2026-07-08 AM'!A2:G100".
 */
function sheetNameFromRange(range: string): string {
	const match = range.match(/^'([^']+)'!/) || range.match(/^([^!]+)!/);
	return match ? match[1] : '';
}

function configToRows(config: BusConfig[]): string[][] {
	return config.map((c) => [
		c.bus_number,
		c.am_expected_arrival_time,
		c.pm_expected_arrival_time,
		c.early_dismissal_overrides && Object.keys(c.early_dismissal_overrides).length > 0
			? JSON.stringify(c.early_dismissal_overrides)
			: ''
	]);
}

function statusToRows(buses: BusStatus[]): string[][] {
	return buses.map((b) => [
		b.bus_number,
		b.covered_by,
		b.is_uncovered ? 'TRUE' : 'FALSE',
		b.arrival_time,
		b.departure_time,
		b.last_modified_by,
		b.last_modified_at
	]);
}

const CONFIG_HEADER = [
	'bus_number',
	'am_expected_arrival_time',
	'pm_expected_arrival_time',
	'early_dismissal_overrides'
];

const STATUS_HEADER = [
	'bus_number',
	'covered_by',
	'is_uncovered',
	'arrival_time',
	'departure_time',
	'last_modified_by',
	'last_modified_at'
];

function sliceForRange(values: string[][], rangePath: string): string[][] {
	const rowRange = parseRowRange(rangePath);
	if (!rowRange) return values;
	if (rowRange.startRow <= 1) {
		return values.slice(0, Math.max(0, rowRange.endRow - 1));
	}
	const startIndex = Math.max(0, rowRange.startRow - 2);
	const endIndex = Math.max(0, rowRange.endRow - 2);
	return values.slice(startIndex, endIndex + 1);
}

/**
 * Mock Google Sheets API for testing.
 * Intercepts API calls and returns mock data.
 */
export async function mockSheetsApi(
	page: Page,
	initialData: MockSheetData,
	options: MockSheetsOptions = {}
) {
	const data = JSON.parse(JSON.stringify(initialData)) as MockSheetData;
	let shouldFailWith401 = options.failFirstRequestWith401 ?? false;

	// Mock spreadsheet metadata (get spreadsheet info)
	await page.route(`${SHEETS_API_BASE}/${data.spreadsheetId}**`, async (route: Route) => {
		const url = new URL(route.request().url());
		const method = route.request().method();
		const rangePath = decodeURIComponent(url.pathname.split('/values/')[1] || '');
		const sheetName = sheetNameFromRange(rangePath);
		const includeHeader = rangePath.includes('!A1');

		if (shouldFailWith401) {
			shouldFailWith401 = false;
			await route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({
					error: {
						code: 401,
						message: 'Request had invalid authentication credentials.',
						status: 'UNAUTHENTICATED'
					}
				})
			});
			return;
		}

		if (method === 'GET' && !url.pathname.includes('/values/')) {
			// Get spreadsheet metadata
			const sheets = [
				{ properties: { title: 'Config', sheetId: 0 } },
				...Object.keys(data.sessionData).map((name, i) => ({
					properties: { title: name, sheetId: i + 1 }
				}))
			];
			// Include Statistics sheet if it has data
			if (data.statisticsData && data.statisticsData.length > 0) {
				sheets.push({ properties: { title: 'Statistics', sheetId: 999 } });
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					spreadsheetId: data.spreadsheetId,
					properties: {
						title: 'Bus Tracker'
					},
					sheets
				})
			});
		} else if (sheetName === 'Statistics') {
			// Get or update Statistics data
			if (method === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						range: rangePath,
						values: data.statisticsData || []
					})
				});
			} else if (method === 'PUT') {
				const body = JSON.parse(route.request().postData() || '{}');
				data.statisticsData = body.values || [];
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ updatedCells: body.values?.length || 0 })
				});
			}
		} else if (sheetName === 'Config') {
			// Get or update config data
			if (method === 'GET') {
				let payloadValues = sliceForRange(configToRows(data.config), rangePath);
				if (includeHeader) {
					payloadValues = [CONFIG_HEADER, ...payloadValues];
				}
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						range: rangePath || 'Config!A2:D100',
						values: payloadValues
					})
				});
			} else if (method === 'PUT') {
				const body = JSON.parse(route.request().postData() || '{}');
				if (body.values) {
					// Update config (skip header row)
					data.config = body.values.slice(1).map((row: string[]) => ({
						bus_number: row[0],
						am_expected_arrival_time: row[1] || '',
						pm_expected_arrival_time: row[2] || '',
						early_dismissal_overrides: row[3] ? JSON.parse(row[3]) : {}
					}));
				}
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ updatedCells: body.values?.length || 0 })
				});
			}
		} else if (SESSION_SHEET_PATTERN.test(sheetName)) {
			// Get or update session data
			if (method === 'GET') {
				const sessionBuses = data.sessionData[sheetName] || [];
				let payloadValues = sliceForRange(statusToRows(sessionBuses), rangePath);
				if (includeHeader) {
					payloadValues = [STATUS_HEADER, ...payloadValues];
				}
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						range: rangePath,
						values: payloadValues
					})
				});
			} else if (method === 'PUT') {
				const body = JSON.parse(route.request().postData() || '{}');
				if (body.values) {
					const rowRange = parseRowRange(rangePath);
					const rows = includeHeader ? body.values.slice(1) : body.values;
					if (rowRange && rowRange.startRow === rowRange.endRow) {
						const index = rowRange.startRow - 2;
						if (index >= 0) {
							data.sessionData[sheetName] = data.sessionData[sheetName] || [];
							data.sessionData[sheetName][index] = {
								bus_number: rows[0]?.[0] || '',
								covered_by: rows[0]?.[1] || '',
								is_uncovered: rows[0]?.[2] === 'TRUE',
								arrival_time: rows[0]?.[3] || '',
								departure_time: rows[0]?.[4] || '',
								last_modified_by: rows[0]?.[5] || '',
								last_modified_at: rows[0]?.[6] || ''
							};
						}
					} else {
						data.sessionData[sheetName] = rows.map((row: string[]) => ({
							bus_number: row[0],
							covered_by: row[1] || '',
							is_uncovered: row[2] === 'TRUE',
							arrival_time: row[3] || '',
							departure_time: row[4] || '',
							last_modified_by: row[5] || '',
							last_modified_at: row[6] || ''
						}));
					}
				}
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ updatedCells: body.values?.length || 0 })
				});
			}
		} else {
			await route.continue();
		}
	});

	// Mock creating new spreadsheets (POST to base URL without spreadsheet ID)
	await page.route(SHEETS_API_BASE, async (route: Route) => {
		if (route.request().method() === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					spreadsheetId: data.spreadsheetId,
					properties: {
						title: 'Bus Tracker'
					},
					sheets: [{ properties: { title: 'Config', sheetId: 0 } }]
				})
			});
		} else {
			await route.continue();
		}
	});

	// Mock Drive API for creating new spreadsheets
	await page.route('https://www.googleapis.com/drive/v3/files**', async (route: Route) => {
		if (route.request().method() === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: data.spreadsheetId,
					name: 'Bus Tracker'
				})
			});
		} else {
			await route.continue();
		}
	});

	// Mock batch get for fetching multiple ranges in one call
	await page.route(
		`${SHEETS_API_BASE}/${data.spreadsheetId}/values:batchGet**`,
		async (route: Route) => {
			const url = new URL(route.request().url());
			const ranges = url.searchParams.getAll('ranges');

			const valueRanges = ranges.map((range) => {
				const name = sheetNameFromRange(range);
				if (name === 'Config') {
					return {
						range: range,
						values: configToRows(data.config)
					};
				} else {
					return {
						range: range,
						values: statusToRows(data.sessionData[name] || [])
					};
				}
			});

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					spreadsheetId: data.spreadsheetId,
					valueRanges
				})
			});
		}
	);

	// Mock batch update for creating new sheets (tabs)
	await page.route(`${SHEETS_API_BASE}/${data.spreadsheetId}:batchUpdate`, async (route: Route) => {
		const body = JSON.parse(route.request().postData() || '{}');

		// Handle addSheet requests
		if (body.requests) {
			for (const request of body.requests) {
				if (request.addSheet) {
					const sheetTitle = request.addSheet.properties.title;
					if (sheetTitle === 'Statistics') {
						// Initialize Statistics sheet as empty
						if (!data.statisticsData) {
							data.statisticsData = [];
						}
					} else if (!data.sessionData[sheetTitle]) {
						// Initialize new session sheet with buses from config
						data.sessionData[sheetTitle] = data.config.map((c) => ({
							bus_number: c.bus_number,
							covered_by: '',
							is_uncovered: false,
							arrival_time: '',
							departure_time: '',
							last_modified_by: '',
							last_modified_at: ''
						}));
					}
				}
			}
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ spreadsheetId: data.spreadsheetId, replies: [] })
		});
	});

	return data;
}

/**
 * Mock Sheets API that returns permission errors
 */
export async function mockSheetsApiNoAccess(page: Page, spreadsheetId: string) {
	await page.route(`${SHEETS_API_BASE}/${spreadsheetId}**`, async (route: Route) => {
		await route.fulfill({
			status: 403,
			contentType: 'application/json',
			body: JSON.stringify({
				error: {
					code: 403,
					message: 'The caller does not have permission',
					status: 'PERMISSION_DENIED'
				}
			})
		});
	});
}
