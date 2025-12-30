import type { MockSheetData } from '../mocks/sheets-api';

/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday(): string {
	return new Date().toISOString().split('T')[0];
}

/**
 * Fixture for a fully configured tracker with buses and today's data
 */
export const populatedTracker: MockSheetData = {
	spreadsheetId: 'populated_tracker_789',
	config: [
		{ bus_number: '1', expected_arrival_time: '15:00' },
		{ bus_number: '2', expected_arrival_time: '15:05' },
		{ bus_number: '3', expected_arrival_time: '15:10' },
		{ bus_number: '4', expected_arrival_time: '15:10' },
		{ bus_number: '5', expected_arrival_time: '15:15' },
		{ bus_number: '17', expected_arrival_time: '15:20' },
		{ bus_number: '42', expected_arrival_time: '15:25' }
	],
	dailyData: {
		[getToday()]: [
			{
				bus_number: '1',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:02',
				departure_time: '15:12',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-15T15:12:00Z'
			},
			{
				bus_number: '2',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:08',
				departure_time: '',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-15T15:08:00Z'
			},
			{
				bus_number: '3',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '',
				departure_time: '',
				last_modified_by: '',
				last_modified_at: ''
			},
			{
				bus_number: '4',
				covered_by: '17',
				is_uncovered: false,
				arrival_time: '15:10',
				departure_time: '',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-15T14:30:00Z'
			},
			{
				bus_number: '5',
				covered_by: '',
				is_uncovered: true,
				arrival_time: '',
				departure_time: '',
				last_modified_by: 'admin@school.edu',
				last_modified_at: '2024-01-15T14:45:00Z'
			},
			{
				bus_number: '17',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '',
				departure_time: '',
				last_modified_by: '',
				last_modified_at: ''
			},
			{
				bus_number: '42',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '',
				departure_time: '',
				last_modified_by: '',
				last_modified_at: ''
			}
		]
	}
};

/**
 * Fixture with historical data for statistics testing
 */
export const trackerWithHistory: MockSheetData = {
	spreadsheetId: 'history_tracker_101',
	config: [
		{ bus_number: '1', expected_arrival_time: '15:00' },
		{ bus_number: '2', expected_arrival_time: '15:05' },
		{ bus_number: '3', expected_arrival_time: '15:10' }
	],
	dailyData: {
		'2024-01-10': [
			{
				bus_number: '1',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:05',
				departure_time: '15:15',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-10T15:15:00Z'
			},
			{
				bus_number: '2',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:10',
				departure_time: '15:20',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-10T15:20:00Z'
			},
			{
				bus_number: '3',
				covered_by: '',
				is_uncovered: true,
				arrival_time: '',
				departure_time: '',
				last_modified_by: 'admin@school.edu',
				last_modified_at: '2024-01-10T15:30:00Z'
			}
		],
		'2024-01-11': [
			{
				bus_number: '1',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:02',
				departure_time: '15:12',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T15:12:00Z'
			},
			{
				bus_number: '2',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:03',
				departure_time: '15:13',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T15:13:00Z'
			},
			{
				bus_number: '3',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:15',
				departure_time: '15:25',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T15:25:00Z'
			}
		],
		'2024-01-12': [
			{
				bus_number: '1',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:00',
				departure_time: '15:10',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-12T15:10:00Z'
			},
			{
				bus_number: '2',
				covered_by: '1',
				is_uncovered: false,
				arrival_time: '',
				departure_time: '',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-12T14:30:00Z'
			},
			{
				bus_number: '3',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:08',
				departure_time: '15:18',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-12T15:18:00Z'
			}
		]
	}
};
