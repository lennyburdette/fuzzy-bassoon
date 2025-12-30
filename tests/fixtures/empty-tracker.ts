import type { MockSheetData } from '../mocks/sheets-api';

/**
 * Fixture for a newly created tracker with no buses configured
 */
export const emptyTracker: MockSheetData = {
	spreadsheetId: 'empty_tracker_123',
	config: [],
	dailyData: {}
};

/**
 * Fixture for admin setting up a new school
 * Has the Config tab but no buses yet
 */
export const newSchoolSetup: MockSheetData = {
	spreadsheetId: 'new_school_456',
	config: [],
	dailyData: {}
};
