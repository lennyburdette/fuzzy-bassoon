/**
 * Bus state management using Svelte 5 runes.
 * Handles loading, polling, and updating bus data.
 */

import {
	type BusConfig,
	type BusStatus,
	type BusDerivedStatus,
	deriveBusStatus,
	getBusStatus,
	getBusDataBatched,
	ensureDailySheet,
	getTodayDate,
	getEffectiveArrivalTime
} from '$lib/services/sheets-api';
import { clearAllCaches, getRecommendedPollInterval } from '$lib/services/sheets-cache';
import { getCurrentSessionEastern, type Session } from '$lib/utils/time';

export type ViewMode = 'monitor' | 'teacher' | 'admin';
export type BusSection = 'pending' | 'arrived' | 'done';

export interface BusActions {
	canMarkArrived: boolean;
	canMarkDeparted: boolean;
	canMarkCovered: boolean;
	canMarkUncovered: boolean;
	canEdit: boolean;
}

export interface BusWithStatus extends BusStatus {
	expected_arrival_time: string;
	effective_arrival_time: string; // May differ from expected if early dismissal override is active
	has_override: boolean; // True if early dismissal override is active for today
	derivedStatus: BusDerivedStatus;
	section: BusSection;
	actions: BusActions;
}

/**
 * Derive which UI section a bus belongs to based on its status.
 * Uncovered buses stay in pending section so they remain visible.
 */
export function deriveBusSection(status: BusDerivedStatus): BusSection {
	if (status === 'departed') return 'done';
	if (status === 'arrived') return 'arrived';
	return 'pending'; // includes 'pending' and 'uncovered'
}

/**
 * Derive available actions for a bus based on its state and the current view mode.
 * Admin mode only shows edit button; all other actions are performed via the edit modal.
 */
export function deriveBusActions(
	bus: BusStatus & { derivedStatus: BusDerivedStatus },
	mode: ViewMode
): BusActions {
	const isPending = bus.derivedStatus === 'pending';
	const isArrived = bus.derivedStatus === 'arrived';
	const isMonitor = mode === 'monitor';

	return {
		canMarkArrived: isMonitor && isPending && !bus.is_uncovered,
		canMarkDeparted: isMonitor && isArrived,
		canMarkCovered: isMonitor && isPending,
		canMarkUncovered: false, // Only available through edit modal now
		canEdit: mode === 'monitor' || mode === 'admin'
	};
}

// Reactive state
let buses = $state<BusWithStatus[]>([]);
let config = $state<BusConfig[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);
let lastUpdated = $state<Date | null>(null);

// The tracking session (AM/PM) currently shown. Defaults to the session
// implied by the current Eastern time so monitors land on the right one.
let session = $state<Session>(getCurrentSessionEastern());

// Polling interval handle
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Default actions (no actions available) - used for raw bus data before mode is applied
const noActions: BusActions = {
	canMarkArrived: false,
	canMarkDeparted: false,
	canMarkCovered: false,
	canMarkUncovered: false,
	canEdit: false
};

/**
 * Merge config and status data into a single array.
 * Buses with no expected arrival time for the given session don't run that
 * session, so they're excluded entirely (e.g. an AM-only bus is left out of
 * the PM view).
 * Actions are set to defaults; use getBusesWithActions() to get mode-specific actions.
 */
function mergeBusData(
	configData: BusConfig[],
	statusData: BusStatus[],
	sess: Session,
	date: string = getTodayDate()
): BusWithStatus[] {
	return configData
		.filter((c) => (sess === 'AM' ? c.am_expected_arrival_time : c.pm_expected_arrival_time))
		.map((c) => {
			const status = statusData.find((s) => s.bus_number === c.bus_number) || {
				bus_number: c.bus_number,
				covered_by: '',
				is_uncovered: false,
				arrival_time: '',
				departure_time: '',
				last_modified_by: '',
				last_modified_at: ''
			};

			const derivedStatus = deriveBusStatus(status);
			const expectedTime =
				sess === 'AM' ? c.am_expected_arrival_time : c.pm_expected_arrival_time;
			const effectiveTime = getEffectiveArrivalTime(c, date, sess);
			const hasOverride = effectiveTime !== expectedTime;

			return {
				...status,
				expected_arrival_time: expectedTime,
				effective_arrival_time: effectiveTime,
				has_override: hasOverride,
				derivedStatus,
				section: deriveBusSection(derivedStatus),
				actions: noActions
			};
		});
}

/**
 * Load bus data for a specific sheet.
 * Uses batched API call when possible to reduce API requests.
 */
export async function loadBuses(spreadsheetId: string, date: string = getTodayDate()): Promise<void> {
	isLoading = true;
	error = null;
	currentSpreadsheetId = spreadsheetId;

	// Capture the session this load is for, so a mid-flight session switch
	// doesn't write stale data into the new session's view
	const sess = session;

	try {
		const result = await getBusDataBatched(spreadsheetId, sess, date);

		if (sess !== session) return;

		config = result.config;

		if (result.sheetExists && result.status) {
			// Sheet exists, we have both config and status
			buses = mergeBusData(result.config, result.status, sess, date);
		} else {
			// Sheet doesn't exist - create it and fetch status
			await ensureDailySheet(spreadsheetId, sess, date);
			const statusData = await getBusStatus(spreadsheetId, sess, date);
			if (sess !== session) return;
			buses = mergeBusData(result.config, statusData, sess, date);
		}

		lastUpdated = new Date();
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to load buses';
	} finally {
		isLoading = false;
	}
}

/**
 * Refresh bus data (for polling).
 */
export async function refreshBuses(
	spreadsheetId: string,
	date: string = getTodayDate()
): Promise<void> {
	// Don't show loading state for refresh
	const sess = session;
	try {
		const statusData = await getBusStatus(spreadsheetId, sess, date);
		if (sess !== session) return;
		buses = mergeBusData(config, statusData, sess, date);
		lastUpdated = new Date();
		error = null;
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to refresh buses';
	}
}

// Store the spreadsheet ID for adaptive polling restarts
let currentSpreadsheetId: string | null = null;

/**
 * Get the currently selected tracking session.
 */
export function getSelectedSession(): Session {
	return session;
}

/**
 * Switch to a different tracking session and reload bus data for it.
 */
export async function setSession(newSession: Session): Promise<void> {
	if (newSession === session) return;
	session = newSession;
	buses = [];
	if (currentSpreadsheetId) {
		await loadBuses(currentSpreadsheetId);
	}
}

/**
 * Start polling for updates.
 * Uses adaptive intervals that increase when rate limits are hit.
 */
export function startPolling(spreadsheetId: string, intervalMs: number = 10000): void {
	stopPolling();
	currentSpreadsheetId = spreadsheetId;

	// Use recommended interval (may be longer if we've hit rate limits)
	const actualInterval = Math.max(intervalMs, getRecommendedPollInterval());

	pollInterval = setInterval(() => {
		refreshBuses(spreadsheetId).then(() => {
			// Check if we need to adjust polling interval after each refresh
			const newInterval = getRecommendedPollInterval();
			if (newInterval !== actualInterval && currentSpreadsheetId) {
				// Restart polling with new interval
				startPolling(currentSpreadsheetId, intervalMs);
			}
		});
	}, actualInterval);
}

/**
 * Stop polling for updates.
 */
export function stopPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
	currentSpreadsheetId = null;
}

/**
 * Update a bus in local state (optimistic update).
 */
export function updateBusLocally(busNumber: string, updates: Partial<BusStatus>): void {
	buses = buses.map((bus) => {
		if (bus.bus_number === busNumber) {
			const updated = { ...bus, ...updates };
			const derivedStatus = deriveBusStatus(updated);
			return {
				...updated,
				derivedStatus,
				section: deriveBusSection(derivedStatus)
			};
		}
		return bus;
	});
}

/**
 * Get buses with mode-specific actions as a flat array.
 * BusList can use this and do its own grouping by bus.section.
 */
export function getBusesWithActions(mode: ViewMode): BusWithStatus[] {
	return buses.map((bus) => ({
		...bus,
		actions: deriveBusActions(bus, mode)
	}));
}

/**
 * Get buses with mode-specific actions, grouped by section.
 * This is the primary function for views that render sections separately (like MonitorView).
 */
export function getBusesForView(mode: ViewMode): {
	pending: BusWithStatus[];
	arrived: BusWithStatus[];
	done: BusWithStatus[];
} {
	const pending: BusWithStatus[] = [];
	const arrived: BusWithStatus[] = [];
	const done: BusWithStatus[] = [];

	for (const bus of buses) {
		const busWithActions: BusWithStatus = {
			...bus,
			actions: deriveBusActions(bus, mode)
		};

		if (bus.section === 'done') {
			done.push(busWithActions);
		} else if (bus.section === 'arrived') {
			arrived.push(busWithActions);
		} else {
			pending.push(busWithActions);
		}
	}

	// Compare two HH:MM time strings; empty string sorts last.
	const compareTime = (a: string, b: string): number => {
		if (a === b) return 0;
		if (a === '') return 1;
		if (b === '') return -1;
		return a < b ? -1 : 1;
	};

	// Sort by departure time asc, arrival time asc, then bus number.
	const sortByTime = (a: BusWithStatus, b: BusWithStatus): number => {
		const depDiff = compareTime(a.departure_time, b.departure_time);
		if (depDiff !== 0) return depDiff;
		const arrDiff = compareTime(a.arrival_time, b.arrival_time);
		if (arrDiff !== 0) return arrDiff;
		return a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true });
	};

	// For pending buses, departure_time and arrival_time are empty; use effective_arrival_time
	// as the primary sort key. Uncovered buses still sort first.
	const sortPending = (a: BusWithStatus, b: BusWithStatus): number => {
		if (a.is_uncovered && !b.is_uncovered) return -1;
		if (!a.is_uncovered && b.is_uncovered) return 1;
		const effDiff = compareTime(a.effective_arrival_time, b.effective_arrival_time);
		if (effDiff !== 0) return effDiff;
		return a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true });
	};

	pending.sort(sortPending);
	arrived.sort(sortByTime);
	done.sort(sortByTime);

	return { pending, arrived, done };
}

export interface BusStateAccessor {
	readonly buses: BusWithStatus[];
	readonly config: BusConfig[];
	readonly isLoading: boolean;
	readonly error: string | null;
	readonly lastUpdated: Date | null;
	readonly session: Session;
}

/**
 * Get state for reactive access.
 */
export function getBusState(): BusStateAccessor {
	return {
		get buses() {
			return buses;
		},
		get config() {
			return config;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		get lastUpdated() {
			return lastUpdated;
		},
		get session() {
			return session;
		}
	};
}

/**
 * Reset state (e.g., when switching sheets).
 */
export function resetBusState(): void {
	stopPolling();
	buses = [];
	config = [];
	isLoading = false;
	error = null;
	lastUpdated = null;
	session = getCurrentSessionEastern();
	clearAllCaches();
}
