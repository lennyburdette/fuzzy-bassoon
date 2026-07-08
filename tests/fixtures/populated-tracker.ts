import type { MockSheetData, BusStatus } from '../mocks/sheets-api';
import { getTodaySessionSheet } from '../helpers/time';

/**
 * Helper to generate a session's worth of bus data with specified arrival times
 */
function generateSessionData(
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
 * Helper to create an uncovered bus row
 */
function uncoveredBus(busNumber: string, modifiedAt: string): BusStatus {
	return {
		bus_number: busNumber,
		covered_by: '',
		is_uncovered: true,
		arrival_time: '',
		departure_time: '',
		last_modified_by: 'admin@school.edu',
		last_modified_at: modifiedAt
	};
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
 * Fixture for a fully configured tracker with buses and today's PM session data
 */
export const populatedTracker: MockSheetData = {
	spreadsheetId: 'populated_tracker_789',
	config: [
		{ bus_number: '1', am_expected_arrival_time: '07:00', pm_expected_arrival_time: '15:00' },
		{ bus_number: '2', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: '3', am_expected_arrival_time: '07:10', pm_expected_arrival_time: '15:10' },
		{ bus_number: '4', am_expected_arrival_time: '07:10', pm_expected_arrival_time: '15:10' },
		{ bus_number: '5', am_expected_arrival_time: '07:15', pm_expected_arrival_time: '15:15' },
		{ bus_number: '17', am_expected_arrival_time: '07:20', pm_expected_arrival_time: '15:20' },
		{ bus_number: '42', am_expected_arrival_time: '07:25', pm_expected_arrival_time: '15:25' }
	],
	sessionData: {
		[getTodaySessionSheet('PM')]: [
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
			uncoveredBus('5', '2024-01-15T14:45:00Z'),
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
 * Fixture with a few sessions of historical data
 */
export const trackerWithHistory: MockSheetData = {
	spreadsheetId: 'history_tracker_101',
	config: [
		{ bus_number: '1', am_expected_arrival_time: '07:00', pm_expected_arrival_time: '15:00' },
		{ bus_number: '2', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: '3', am_expected_arrival_time: '07:10', pm_expected_arrival_time: '15:10' }
	],
	sessionData: {
		'2024-01-10 PM': [
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
			uncoveredBus('3', '2024-01-10T15:30:00Z')
		],
		'2024-01-11 AM': [
			{
				bus_number: '1',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '07:02',
				departure_time: '07:12',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T07:12:00Z'
			},
			{
				bus_number: '2',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '07:03',
				departure_time: '07:13',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T07:13:00Z'
			},
			{
				bus_number: '3',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '07:15',
				departure_time: '07:25',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T07:25:00Z'
			}
		],
		'2024-01-11 PM': [
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
				covered_by: '1',
				is_uncovered: false,
				arrival_time: '',
				departure_time: '',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T14:30:00Z'
			},
			{
				bus_number: '3',
				covered_by: '',
				is_uncovered: false,
				arrival_time: '15:08',
				departure_time: '15:18',
				last_modified_by: 'monitor@school.edu',
				last_modified_at: '2024-01-11T15:18:00Z'
			}
		]
	}
};

/**
 * Fixture with extended historical data for statistics testing.
 * 10 PM sessions + 2 AM sessions of 5 buses each = 60 scheduled runs,
 * 3 of them uncovered. The admin view auto-creates today's (empty) session
 * sheet on load, adding 5 more runs: 3 / 65 = 4.6% uncovered — well above
 * the 1.6% district average.
 */
export const trackerWithExtendedHistory: MockSheetData = {
	spreadsheetId: 'extended_history_tracker',
	config: [
		{ bus_number: '1', am_expected_arrival_time: '07:00', pm_expected_arrival_time: '15:00' },
		{ bus_number: '2', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: '3', am_expected_arrival_time: '07:10', pm_expected_arrival_time: '15:10' },
		{ bus_number: '4', am_expected_arrival_time: '07:15', pm_expected_arrival_time: '15:15' },
		{ bus_number: '5', am_expected_arrival_time: '07:20', pm_expected_arrival_time: '15:20' }
	],
	sessionData: {
		'2024-01-08 PM': generateSessionData(['15:02', '15:04', '15:09', '15:14', '15:19']),
		'2024-01-09 PM': generateSessionData(['15:08', '15:03', '15:18', '15:14', '15:28']),
		// Bus 3 uncovered in the afternoon
		'2024-01-10 PM': [
			...generateSessionData(['15:01', '15:06', null, '15:16', '15:21']).slice(0, 2),
			uncoveredBus('3', '2024-01-10T15:30:00Z'),
			...generateSessionData(['15:01', '15:06', null, '15:16', '15:21']).slice(3)
		],
		'2024-01-11 PM': generateSessionData(['15:00', '15:06', '15:09', '15:16', '15:21']),
		// One bus covered by another
		'2024-01-12 PM': [
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
			...generateSessionData([null, null, '15:11', '15:17', '15:22']).slice(2)
		],
		'2024-01-15 PM': generateSessionData(['15:03', '15:12', '15:08', '15:20', '15:18']),
		// Morning session, all arrived
		'2024-01-16 AM': generateSessionData(['07:02', '07:04', '07:09', '07:14', '07:19']),
		// Bus 2 uncovered in the morning, bus 5 uncovered in the afternoon
		'2024-01-16 PM': [
			...generateSessionData(['15:02', '15:04', '15:11', '15:16', null]).slice(0, 4),
			uncoveredBus('5', '2024-01-16T15:40:00Z')
		],
		'2024-01-17 AM': [
			generateSessionData(['07:01', null, '07:09', '07:13', '07:18'])[0],
			uncoveredBus('2', '2024-01-17T07:30:00Z'),
			...generateSessionData(['07:01', null, '07:09', '07:13', '07:18']).slice(2)
		],
		'2024-01-17 PM': generateSessionData(['15:10', '15:15', '15:20', '15:25', '15:30']),
		'2024-01-18 PM': generateSessionData(['15:02', '15:05', '15:02', '15:14', '15:19']),
		'2024-01-19 PM': generateSessionData(['15:00', '15:05', '15:10', '15:15', '15:20'])
	}
};

/**
 * Fixture whose uncovered rate is below the district average.
 * 12 days × AM + PM × 5 buses = 120 scheduled runs with a single uncovered
 * run. With today's auto-created session sheet: 1 / 125 = 0.8% — below the
 * 1.6% district average.
 */
export const lowUncoveredTracker: MockSheetData = (() => {
	const config = [
		{ bus_number: '1', am_expected_arrival_time: '07:00', pm_expected_arrival_time: '15:00' },
		{ bus_number: '2', am_expected_arrival_time: '07:05', pm_expected_arrival_time: '15:05' },
		{ bus_number: '3', am_expected_arrival_time: '07:10', pm_expected_arrival_time: '15:10' },
		{ bus_number: '4', am_expected_arrival_time: '07:15', pm_expected_arrival_time: '15:15' },
		{ bus_number: '5', am_expected_arrival_time: '07:20', pm_expected_arrival_time: '15:20' }
	];
	const sessionData: Record<string, BusStatus[]> = {};
	for (let day = 1; day <= 12; day++) {
		const date = `2024-02-${String(day).padStart(2, '0')}`;
		sessionData[`${date} AM`] = generateSessionData(['07:01', '07:05', '07:11', '07:14', '07:21']);
		sessionData[`${date} PM`] = generateSessionData(['15:01', '15:05', '15:11', '15:14', '15:21']);
	}
	// The single uncovered run: bus 4 on the morning of Feb 7
	sessionData['2024-02-07 AM'][3] = uncoveredBus('4', '2024-02-07T07:30:00Z');

	return {
		spreadsheetId: 'low_uncovered_tracker',
		config,
		sessionData
	};
})();
