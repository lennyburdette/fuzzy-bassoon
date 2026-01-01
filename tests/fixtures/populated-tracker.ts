import type { MockSheetData, BusStatus } from '../mocks/sheets-api';
import { getTodayEastern } from '../helpers/time';

/**
 * Helper to generate a day's worth of bus data with specified arrival times
 */
function generateDayData(
	arrivalTimes: (string | null)[],
	departureTimes?: (string | null)[]
): BusStatus[] {
	return arrivalTimes.map((arrivalTime, i) => ({
		bus_number: String(i + 1),
		covered_by: '',
		is_uncovered: false,
		arrival_time: arrivalTime || '',
		departure_time: departureTimes?.[i] || (arrivalTime ? addMinutes(arrivalTime, 10) : ''),
		last_modified_by: arrivalTime ? 'monitor@school.edu' : '',
		last_modified_at: arrivalTime ? new Date().toISOString() : ''
	}));
}

/**
 * Helper to add minutes to a time string
 */
function addMinutes(time: string, minutes: number): string {
	const [hours, mins] = time.split(':').map(Number);
	const totalMins = hours * 60 + mins + minutes;
	const newHours = Math.floor(totalMins / 60) % 24;
	const newMins = totalMins % 60;
	return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
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
		[getTodayEastern()]: [
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

/**
 * Fixture with extended historical data for comprehensive statistics testing.
 * Contains 10 days of varied data including on-time, late, uncovered, and covered buses.
 */
export const trackerWithExtendedHistory: MockSheetData = {
	spreadsheetId: 'extended_history_tracker',
	config: [
		{ bus_number: '1', expected_arrival_time: '15:00' },
		{ bus_number: '2', expected_arrival_time: '15:05' },
		{ bus_number: '3', expected_arrival_time: '15:10' },
		{ bus_number: '4', expected_arrival_time: '15:15' },
		{ bus_number: '5', expected_arrival_time: '15:20' }
	],
	dailyData: {
		// Day 1: All on-time
		'2024-01-08': generateDayData(['15:02', '15:04', '15:09', '15:14', '15:19']),
		// Day 2: Some late arrivals
		'2024-01-09': generateDayData(['15:08', '15:03', '15:18', '15:14', '15:28']),
		// Day 3: One uncovered bus
		'2024-01-10': [
			...generateDayData(['15:01', '15:06', null, '15:16', '15:21']).slice(0, 2),
			{
				bus_number: '3',
				covered_by: '',
				is_uncovered: true,
				arrival_time: '',
				departure_time: '',
				last_modified_by: 'admin@school.edu',
				last_modified_at: '2024-01-10T15:30:00Z'
			},
			...generateDayData(['15:01', '15:06', null, '15:16', '15:21']).slice(3)
		],
		// Day 4: All on-time
		'2024-01-11': generateDayData(['15:00', '15:06', '15:09', '15:16', '15:21']),
		// Day 5: One bus covered by another
		'2024-01-12': [
			{
				bus_number: '1',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:01',
				departure_time: '15:11',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-12T15:11:00Z'
			},
			{
				bus_number: '2',
				covered_by: '1',
				is_uncovered: false,
				arrival_time: '15:01',
				departure_time: '15:11',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-12T15:01:00Z'
			},
			...generateDayData([null, null, '15:11', '15:17', '15:22']).slice(2)
		],
		// Day 6: Mixed results
		'2024-01-15': generateDayData(['15:03', '15:12', '15:08', '15:20', '15:18']),
		// Day 7: Another uncovered
		'2024-01-16': [
			...generateDayData(['15:02', '15:04', '15:11', '15:16', null]).slice(0, 4),
			{
				bus_number: '5',
				covered_by: '',
				is_uncovered: true,
				arrival_time: '',
				departure_time: '',
				last_modified_by: 'admin@school.edu',
				last_modified_at: '2024-01-16T15:40:00Z'
			}
		],
		// Day 8: All late
		'2024-01-17': generateDayData(['15:10', '15:15', '15:20', '15:25', '15:30']),
		// Day 9: Coverage event
		'2024-01-18': [
			{
				bus_number: '1',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:02',
				departure_time: '15:12',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-18T15:12:00Z'
			},
			{
				bus_number: '2',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:05',
				departure_time: '15:15',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-18T15:15:00Z'
			},
			{
				bus_number: '3',
				covered_by: '1',
				is_uncovered: false,
				arrival_time: '15:02',
				departure_time: '15:12',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-18T15:02:00Z'
			},
			...generateDayData([null, null, null, '15:14', '15:19']).slice(3)
		],
		// Day 10: Perfect day
		'2024-01-19': generateDayData(['15:00', '15:05', '15:10', '15:15', '15:20'])
	}
};
