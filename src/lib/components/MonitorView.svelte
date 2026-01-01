<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		getBusState,
		loadBuses,
		startPolling,
		stopPolling,
		updateBusLocally,
		getBusesWithActions
	} from '$lib/state/buses.svelte';
	import {
		markBusArrived,
		markBusDeparted,
		markBusCovered,
		updateBusStatus
	} from '$lib/services/sheets-api';
	import { getCurrentTimeEastern } from '$lib/utils/time';
	import { getCurrentUser, getAccessToken, requestAccessToken } from '$lib/state/auth.svelte';
	import BusList from './BusList.svelte';
	import CoverModal from './CoverModal.svelte';
	import EditBusModal from './EditBusModal.svelte';

	interface Props {
		sheetId: string;
	}

	let { sheetId }: Props = $props();

	const busState = getBusState();
	let coveringBus = $state<string | null>(null);
	let editingBusData = $state<typeof busState.buses[0] | null>(null);
	let actionError = $state<string | null>(null);
	let needsAuthorization = $state(false);
	let isAuthorizing = $state(false);

	onMount(async () => {
		if (!getAccessToken()) {
			needsAuthorization = true;
			return;
		}
		await loadBuses(sheetId);
		startPolling(sheetId, 10000);
	});

	onDestroy(() => {
		stopPolling();
	});

	async function handleAuthorize() {
		isAuthorizing = true;
		requestAccessToken();

		const startTime = Date.now();
		while (!getAccessToken() && Date.now() - startTime < 30000) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}

		if (getAccessToken()) {
			needsAuthorization = false;
			await loadBuses(sheetId);
			startPolling(sheetId, 10000);
		}
		isAuthorizing = false;
	}

	// Helper to wrap state updates with view transitions
	function withViewTransition(callback: () => void) {
		if (document.startViewTransition) {
			document.startViewTransition(callback);
		} else {
			callback();
		}
	}

	async function handleArrived(busNumber: string) {
		const user = getCurrentUser();
		if (!user) return;

		try {
			actionError = null;
			const time = getCurrentTimeEastern();
			withViewTransition(() => updateBusLocally(busNumber, { arrival_time: time }));
			await markBusArrived(sheetId, busNumber, user.email);
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to mark arrived';
			try {
				await loadBuses(sheetId); // Reload to get correct state
			} catch {
				// Ignore reload errors
			}
		}
	}

	async function handleDeparted(busNumber: string) {
		const user = getCurrentUser();
		if (!user) return;

		try {
			actionError = null;
			const time = getCurrentTimeEastern();
			withViewTransition(() => updateBusLocally(busNumber, { departure_time: time }));
			await markBusDeparted(sheetId, busNumber, user.email);
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to mark departed';
			try {
				await loadBuses(sheetId);
			} catch {
				// Ignore reload errors
			}
		}
	}

	function handleCover(busNumber: string) {
		coveringBus = busNumber;
	}

	async function handleCoverSelect(coveringBusNumber: string) {
		const user = getCurrentUser();
		if (!user || !coveringBus) return;

		const busToUpdate = coveringBus;
		const time = getCurrentTimeEastern();

		// Close modal before starting the transition
		coveringBus = null;

		try {
			actionError = null;
			withViewTransition(() =>
				updateBusLocally(busToUpdate, { covered_by: coveringBusNumber, arrival_time: time })
			);
			await markBusCovered(sheetId, busToUpdate, coveringBusNumber, user.email);
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to mark covered';
			try {
				await loadBuses(sheetId);
			} catch {
				// Ignore reload errors
			}
		}
	}

	function handleEdit(busNumber: string) {
		// Capture a snapshot of the bus data when opening the modal
		const bus = busState.buses.find((b) => b.bus_number === busNumber);
		if (bus) {
			editingBusData = { ...bus };
		}
	}

	async function handleEditSave(updates: {
		arrival_time?: string;
		departure_time?: string;
		covered_by?: string;
		is_uncovered?: boolean;
	}) {
		const user = getCurrentUser();
		if (!user || !editingBusData) return;

		const busToUpdate = editingBusData.bus_number;
		editingBusData = null; // Close modal before view transition

		try {
			actionError = null;
			withViewTransition(() => updateBusLocally(busToUpdate, updates));
			await updateBusStatus(sheetId, busToUpdate, updates, user.email);
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to save changes';
			try {
				await loadBuses(sheetId);
			} catch {
				// Ignore reload errors
			}
		}
	}
</script>

<div>
	{#if needsAuthorization}
		<div class="rounded-lg bg-yellow-50 p-8 text-center">
			<p class="font-medium text-yellow-800">Authorization Required</p>
			<p class="mt-2 text-sm text-yellow-700">
				To access the bus tracker, you need to authorize access to Google Sheets.
			</p>
			<button
				type="button"
				onclick={handleAuthorize}
				disabled={isAuthorizing}
				class="mt-4 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
			>
				{isAuthorizing ? 'Authorizing...' : 'Authorize Access'}
			</button>
		</div>
	{:else}
	{#if actionError}
		<div class="mx-4 mb-2 rounded-lg bg-red-50 p-3 text-red-700 sm:mx-0">
			<p class="text-sm">{actionError}</p>
		</div>
	{/if}

	{#if busState.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div
					class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-bus-600 border-t-transparent"
				></div>
				<p class="mt-4 text-stone-600">Loading buses...</p>
			</div>
		</div>
	{:else if busState.error}
		<div class="mx-4 rounded-lg bg-red-50 p-4 text-red-700 sm:mx-0">
			<p class="font-medium">Error loading buses</p>
			<p class="mt-1 text-sm">{busState.error}</p>
		</div>
	{:else if busState.buses.length === 0}
		<div class="mx-4 rounded-lg bg-bus-100 p-8 text-center text-stone-600 sm:mx-0">
			<p>No buses configured for this tracker.</p>
			<p class="mt-2 text-sm">Ask your administrator to set up the bus list.</p>
		</div>
	{:else}
		<BusList
			buses={getBusesWithActions('monitor')}
			grouped={true}
			pendingFirst={true}
			lastUpdated={busState.lastUpdated}
			error={busState.error}
			onArrived={handleArrived}
			onDeparted={handleDeparted}
			onCover={handleCover}
			onEdit={handleEdit}
		/>
	{/if}
	{/if}
</div>

{#if coveringBus}
	<CoverModal
		busNumber={coveringBus}
		onSelect={handleCoverSelect}
		onClose={() => (coveringBus = null)}
	/>
{/if}

{#if editingBusData}
	<EditBusModal
		bus={editingBusData}
		onSave={handleEditSave}
		onClose={() => (editingBusData = null)}
	/>
{/if}
