/**
 * Statistics calculation utilities for bus tracker data.
 *
 * The report centers on one question: does this school's uncovered-bus rate
 * exceed the district average?
 */

import type { BusStatus, StatisticsReport } from '$lib/services/sheets-api';
import { parseSessionSheetName } from '$lib/utils/time';

export interface CalculationInput {
	/** Bus status rows keyed by session sheet name (e.g. "2026-07-08 AM") */
	sessionData: Record<string, BusStatus[]>;
}

/** District-wide average rate of uncovered bus runs, in percent. */
export const DISTRICT_AVERAGE_UNCOVERED_RATE = 1.6;

/** Round to one decimal place. */
function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

/**
 * Calculate the uncovered-rate statistics from historical session data.
 *
 * A "scheduled run" is one bus row in one session sheet — every configured
 * bus is seeded into each session's sheet, so the denominator is the total
 * row count across all sessions. The uncovered rate is uncovered runs
 * divided by scheduled runs.
 */
export function calculateStatistics(input: CalculationInput): StatisticsReport {
	const sheetNames = Object.keys(input.sessionData).sort();

	const uncoveredIncidents: StatisticsReport['uncoveredIncidents'] = [];
	const sessionRates: StatisticsReport['sessionRates'] = [];

	let totalScheduledRuns = 0;
	let totalUncovered = 0;
	const dates = new Set<string>();

	for (const sheetName of sheetNames) {
		const parsed = parseSessionSheetName(sheetName);
		if (!parsed) continue;
		const { date, session } = parsed;
		dates.add(date);

		const buses = input.sessionData[sheetName].filter((b) => b.bus_number);
		let uncovered = 0;

		for (const bus of buses) {
			if (bus.is_uncovered) {
				uncovered++;
				uncoveredIncidents.push({ date, session, busNumber: bus.bus_number });
			}
		}

		totalScheduledRuns += buses.length;
		totalUncovered += uncovered;

		sessionRates.push({
			date,
			session,
			scheduled: buses.length,
			uncovered,
			ratePct: buses.length > 0 ? round1((uncovered / buses.length) * 100) : 0
		});
	}

	const sortedDates = Array.from(dates).sort();
	const uncoveredRatePct =
		totalScheduledRuns > 0 ? round1((totalUncovered / totalScheduledRuns) * 100) : 0;

	return {
		generatedAt: new Date().toISOString(),
		startDate: sortedDates[0] || '',
		endDate: sortedDates[sortedDates.length - 1] || '',
		totalSessions: sessionRates.length,
		totalScheduledRuns,
		totalUncovered,
		uncoveredRatePct,
		exceedsDistrictAverage: uncoveredRatePct > DISTRICT_AVERAGE_UNCOVERED_RATE,
		uncoveredIncidents,
		sessionRates
	};
}
