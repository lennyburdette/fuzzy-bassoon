/**
 * Statistics calculation utilities for bus tracker data.
 */

import type { BusConfig, BusStatus, StatisticsReport } from '$lib/services/sheets-api';

export interface CalculationInput {
	config: BusConfig[];
	dailyData: Record<string, BusStatus[]>;
}

/** Default threshold for considering a bus "on time" (in minutes) */
export const ON_TIME_THRESHOLD_MINUTES = 5;

/**
 * Calculate the delay in minutes between expected and actual times.
 * Positive values indicate late arrivals, negative indicate early.
 * @param expected Time in HH:MM format
 * @param actual Time in HH:MM format
 * @returns Delay in minutes (positive = late, negative = early)
 */
export function calculateDelayMinutes(expected: string, actual: string): number {
	if (!expected || !actual) return 0;

	const [expectedHours, expectedMins] = expected.split(':').map(Number);
	const [actualHours, actualMins] = actual.split(':').map(Number);

	if (isNaN(expectedHours) || isNaN(expectedMins) || isNaN(actualHours) || isNaN(actualMins)) {
		return 0;
	}

	const expectedTotalMins = expectedHours * 60 + expectedMins;
	const actualTotalMins = actualHours * 60 + actualMins;

	return actualTotalMins - expectedTotalMins;
}

/**
 * Check if an arrival is considered "on time" (within threshold of expected).
 * @param expected Time in HH:MM format
 * @param actual Time in HH:MM format
 * @param thresholdMinutes Maximum allowed delay to be considered on-time
 * @returns true if on-time, false if late
 */
export function isOnTime(
	expected: string,
	actual: string,
	thresholdMinutes: number = ON_TIME_THRESHOLD_MINUTES
): boolean {
	const delay = calculateDelayMinutes(expected, actual);
	return delay <= thresholdMinutes;
}

/**
 * Calculate comprehensive statistics from historical bus data.
 */
export function calculateStatistics(input: CalculationInput): StatisticsReport {
	const { config, dailyData } = input;
	const dates = Object.keys(dailyData).sort();

	if (dates.length === 0) {
		return {
			generatedAt: new Date().toISOString(),
			startDate: '',
			endDate: '',
			totalDays: 0,
			totalBusArrivals: 0,
			overallOnTimePct: 100,
			perBusStats: config.map((c) => ({
				busNumber: c.bus_number,
				avgDelayMinutes: 0,
				maxDelayMinutes: 0,
				onTimePct: 100
			})),
			uncoveredIncidents: [],
			coveragePairs: [],
			dailyCounts: []
		};
	}

	// Build expected times lookup from config
	const expectedTimes = new Map<string, string>();
	config.forEach((c) => expectedTimes.set(c.bus_number, c.expected_arrival_time));

	// Per-bus accumulators
	const busDelays = new Map<string, number[]>();
	const busOnTimeCount = new Map<string, { onTime: number; total: number }>();

	// Uncovered incidents list
	const uncoveredIncidents: { date: string; busNumber: string }[] = [];

	// Coverage tracking
	const coverageCounts = new Map<string, number>(); // "covering:covered" -> count

	// Daily counts
	const dailyCounts: StatisticsReport['dailyCounts'] = [];

	// Process each day
	for (const date of dates) {
		const dayData = dailyData[date];
		let dayTotal = 0;
		let dayOnTime = 0;
		let dayLate = 0;
		let dayUncovered = 0;

		for (const bus of dayData) {
			const expected = expectedTimes.get(bus.bus_number);

			if (bus.is_uncovered) {
				uncoveredIncidents.push({ date, busNumber: bus.bus_number });
				dayUncovered++;
				continue;
			}

			if (bus.covered_by) {
				// Track coverage pair
				const key = `${bus.covered_by}:${bus.bus_number}`;
				coverageCounts.set(key, (coverageCounts.get(key) || 0) + 1);
			}

			if (bus.arrival_time && expected) {
				const delay = calculateDelayMinutes(expected, bus.arrival_time);

				// Track delays (only positive delays, early arrivals count as 0)
				const actualDelay = Math.max(0, delay);
				if (!busDelays.has(bus.bus_number)) {
					busDelays.set(bus.bus_number, []);
				}
				busDelays.get(bus.bus_number)!.push(actualDelay);

				// Track on-time status
				const onTime = isOnTime(expected, bus.arrival_time, ON_TIME_THRESHOLD_MINUTES);
				if (!busOnTimeCount.has(bus.bus_number)) {
					busOnTimeCount.set(bus.bus_number, { onTime: 0, total: 0 });
				}
				const counts = busOnTimeCount.get(bus.bus_number)!;
				counts.total++;
				if (onTime) counts.onTime++;

				dayTotal++;
				if (onTime) dayOnTime++;
				else dayLate++;
			}
		}

		dailyCounts.push({
			date,
			total: dayTotal,
			onTime: dayOnTime,
			late: dayLate,
			uncovered: dayUncovered
		});
	}

	// Calculate per-bus statistics
	const perBusStats = config.map((c) => {
		const delays = busDelays.get(c.bus_number) || [];
		const onTimeCounts = busOnTimeCount.get(c.bus_number) || { onTime: 0, total: 0 };

		const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;

		const maxDelay = delays.length > 0 ? Math.max(...delays) : 0;

		const onTimePct =
			onTimeCounts.total > 0 ? (onTimeCounts.onTime / onTimeCounts.total) * 100 : 100;

		return {
			busNumber: c.bus_number,
			avgDelayMinutes: Math.round(avgDelay * 10) / 10, // Round to 1 decimal
			maxDelayMinutes: maxDelay,
			onTimePct: Math.round(onTimePct * 10) / 10 // Round to 1 decimal
		};
	});

	// Calculate overall on-time percentage
	const totalArrivals = dailyCounts.reduce((sum, d) => sum + d.total, 0);
	const totalOnTime = dailyCounts.reduce((sum, d) => sum + d.onTime, 0);
	const overallOnTimePct = totalArrivals > 0 ? (totalOnTime / totalArrivals) * 100 : 100;

	// Build coverage pairs
	const coveragePairs = Array.from(coverageCounts.entries())
		.map(([key, count]) => {
			const [covering, covered] = key.split(':');
			return { coveringBus: covering, coveredBus: covered, count };
		})
		.sort((a, b) => b.count - a.count); // Sort by count descending

	return {
		generatedAt: new Date().toISOString(),
		startDate: dates[0],
		endDate: dates[dates.length - 1],
		totalDays: dates.length,
		totalBusArrivals: totalArrivals,
		overallOnTimePct: Math.round(overallOnTimePct * 10) / 10,
		perBusStats,
		uncoveredIncidents,
		coveragePairs,
		dailyCounts
	};
}
