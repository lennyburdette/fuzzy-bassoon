/**
 * Bus state management using Svelte 5 runes.
 * Handles loading, polling, and updating bus data.
 */

import {
	type BusConfig,
	type BusStatus,
	type BusDerivedStatus,
	deriveBusStatus,
	getBusConfig,
	getBusStatus,
	getTodayDate
} from '$lib/services/sheets-api';

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
	derivedStatus: BusDerivedStatus;
	section: BusSection;
	actions: BusActions;
}

/**
 * Derive which UI section a bus belongs to based on its status.
 */
export function deriveBusSection(status: BusDerivedStatus): BusSection {
	if (status === 'departed' || status === 'uncovered') return 'done';
	if (status === 'arrived') return 'arrived';
	return 'pending';
}

/**
 * Derive available actions for a bus based on its state and the current view mode.
 */
export function deriveBusActions(
	bus: BusStatus & { derivedStatus: BusDerivedStatus },
	mode: ViewMode
): BusActions {
	const isPending = bus.derivedStatus === 'pending';
	const isArrived = bus.derivedStatus === 'arrived';
	const canAct = mode === 'monitor' || mode === 'admin';

	return {
		canMarkArrived: canAct && isPending && !bus.covered_by && !bus.is_uncovered,
		canMarkDeparted: canAct && isArrived,
		canMarkCovered: canAct && isPending, // Only pending buses can be covered
		canMarkUncovered: mode === 'admin' && isPending,
		canEdit: canAct // Always allow edit for monitors and admins
	};
}

// Reactive state
let buses = $state<BusWithStatus[]>([]);
let config = $state<BusConfig[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);
let lastUpdated = $state<Date | null>(null);

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
 * Actions are set to defaults; use getBusesForView() to get mode-specific actions.
 */
function mergeBusData(configData: BusConfig[], statusData: BusStatus[]): BusWithStatus[] {
	return configData.map((c) => {
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

		return {
			...status,
			expected_arrival_time: c.expected_arrival_time,
			derivedStatus,
			section: deriveBusSection(derivedStatus),
			actions: noActions
		};
	});
}

/**
 * Load bus data for a specific sheet.
 */
export async function loadBuses(spreadsheetId: string, date: string = getTodayDate()): Promise<void> {
	isLoading = true;
	error = null;

	try {
		const [configData, statusData] = await Promise.all([
			getBusConfig(spreadsheetId),
			getBusStatus(spreadsheetId, date)
		]);

		config = configData;
		buses = mergeBusData(configData, statusData);
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
	try {
		const statusData = await getBusStatus(spreadsheetId, date);
		buses = mergeBusData(config, statusData);
		lastUpdated = new Date();
		error = null;
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to refresh buses';
	}
}

/**
 * Start polling for updates.
 */
export function startPolling(spreadsheetId: string, intervalMs: number = 10000): void {
	stopPolling();
	pollInterval = setInterval(() => {
		refreshBuses(spreadsheetId);
	}, intervalMs);
}

/**
 * Stop polling for updates.
 */
export function stopPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
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

	// Sort each section alphabetically
	const sortFn = (a: BusWithStatus, b: BusWithStatus) =>
		a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true });

	pending.sort(sortFn);
	arrived.sort(sortFn);
	done.sort(sortFn);

	return { pending, arrived, done };
}

/**
 * Get state for reactive access.
 */
export function getBusState() {
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
}
