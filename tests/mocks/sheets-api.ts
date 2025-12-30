import type { Page, Route } from '@playwright/test';

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

export interface MockSheetData {
	spreadsheetId: string;
	config: BusConfig[];
	dailyData: Record<string, BusStatus[]>; // keyed by date YYYY-MM-DD
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Mock Google Sheets API for testing.
 * Intercepts API calls and returns mock data.
 */
export async function mockSheetsApi(page: Page, initialData: MockSheetData) {
	const data = { ...initialData };

	// Mock spreadsheet metadata (get spreadsheet info)
	await page.route(`${SHEETS_API_BASE}/${data.spreadsheetId}**`, async (route: Route) => {
		const url = new URL(route.request().url());
		const method = route.request().method();

		if (method === 'GET' && !url.pathname.includes('/values/')) {
			// Get spreadsheet metadata
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					spreadsheetId: data.spreadsheetId,
					properties: {
						title: 'Bus Tracker'
					},
					sheets: [
						{ properties: { title: 'Config', sheetId: 0 } },
						...Object.keys(data.dailyData).map((date, i) => ({
							properties: { title: date, sheetId: i + 1 }
						}))
					]
				})
			});
		} else if (url.pathname.includes('/values/Config')) {
			// Get or update config data
			if (method === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						range: 'Config!A1:B100',
						values: [
							['bus_number', 'expected_arrival_time'],
							...data.config.map((c) => [c.bus_number, c.expected_arrival_time])
						]
					})
				});
			} else if (method === 'PUT') {
				const body = JSON.parse(route.request().postData() || '{}');
				if (body.values) {
					// Update config (skip header row)
					data.config = body.values.slice(1).map((row: string[]) => ({
						bus_number: row[0],
						expected_arrival_time: row[1]
					}));
				}
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ updatedCells: body.values?.length || 0 })
				});
			}
		} else if (url.pathname.match(/\/values\/\d{4}-\d{2}-\d{2}/)) {
			// Get or update daily data
			const dateMatch = url.pathname.match(/(\d{4}-\d{2}-\d{2})/);
			const date = dateMatch ? dateMatch[1] : '';

			if (method === 'GET') {
				const dayData = data.dailyData[date] || [];
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						range: `${date}!A1:G100`,
						values: [
							[
								'bus_number',
								'covered_by',
								'is_uncovered',
								'arrival_time',
								'departure_time',
								'last_modified_by',
								'last_modified_at'
							],
							...dayData.map((b) => [
								b.bus_number,
								b.covered_by,
								b.is_uncovered ? 'TRUE' : 'FALSE',
								b.arrival_time,
								b.departure_time,
								b.last_modified_by,
								b.last_modified_at
							])
						]
					})
				});
			} else if (method === 'PUT') {
				const body = JSON.parse(route.request().postData() || '{}');
				if (body.values) {
					data.dailyData[date] = body.values.slice(1).map((row: string[]) => ({
						bus_number: row[0],
						covered_by: row[1] || '',
						is_uncovered: row[2] === 'TRUE',
						arrival_time: row[3] || '',
						departure_time: row[4] || '',
						last_modified_by: row[5] || '',
						last_modified_at: row[6] || ''
					}));
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

	// Mock batch update for creating new sheets (tabs)
	await page.route(`${SHEETS_API_BASE}/${data.spreadsheetId}:batchUpdate`, async (route: Route) => {
		const body = JSON.parse(route.request().postData() || '{}');

		// Handle addSheet requests
		if (body.requests) {
			for (const request of body.requests) {
				if (request.addSheet) {
					const sheetTitle = request.addSheet.properties.title;
					if (!data.dailyData[sheetTitle]) {
						// Initialize new daily sheet with buses from config
						data.dailyData[sheetTitle] = data.config.map((c) => ({
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
