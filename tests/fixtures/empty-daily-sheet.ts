import type { MockSheetData } from '../mocks/sheets-api';
import { getTodayEastern } from '../helpers/time';

/**
 * Fixture for a tracker where the daily sheet exists but has no bus rows.
 * This simulates the state where:
 * 1. Config has buses configured
 * 2. Daily sheet was created (has headers) but bus rows were never populated
 *
 * This can happen when buses are added to config after the daily sheet was created.
 */
export const trackerWithEmptyDailySheet: MockSheetData = {
	spreadsheetId: 'tracker_empty_daily_123',
	config: [
		{ bus_number: 'B030', expected_arrival_time: '15:05' },
		{ bus_number: 'B154', expected_arrival_time: '15:05' },
		{ bus_number: 'B157', expected_arrival_time: '15:05' },
		{ bus_number: 'B172', expected_arrival_time: '15:05' },
		{ bus_number: 'B492', expected_arrival_time: '15:05' }
	],
	dailyData: {
		// Daily sheet exists but has no bus data rows (only headers in real sheet)
		[getTodayEastern()]: []
	}
};
