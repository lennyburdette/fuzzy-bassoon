import type { MockSheetData } from '../mocks/sheets-api';
import { getTodaySessionSheet } from '../helpers/time';

/**
 * Fixture for a tracker where the session sheet exists but has no bus rows.
 * This simulates the state where:
 * 1. Config has buses configured
 * 2. Session sheet was created (has headers) but bus rows were never populated
 *
 * This can happen when buses are added to config after the session sheet was created.
 */
export const trackerWithEmptyDailySheet: MockSheetData = {
	spreadsheetId: 'tracker_empty_daily_123',
	config: [
		{ bus_number: 'B030', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: 'B154', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: 'B157', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: 'B172', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: 'B492', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' }
	],
	sessionData: {
		// Session sheet exists but has no bus data rows (only headers in real sheet)
		[getTodaySessionSheet('PM')]: []
	}
};
