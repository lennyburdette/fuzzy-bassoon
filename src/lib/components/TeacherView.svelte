<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getBusState, loadBuses, startPolling, stopPolling, getBusesWithActions } from '$lib/state/buses.svelte';
	import { getAccessToken, requestAccessToken } from '$lib/state/auth.svelte';
	import BusList from './BusList.svelte';

	interface Props {
		sheetId: string;
	}

	let { sheetId }: Props = $props();

	const busState = getBusState();
	let needsAuthorization = $state(false);
	let isAuthorizing = $state(false);

	onMount(async () => {
		if (!getAccessToken()) {
			needsAuthorization = true;
			return;
		}
		await loadBuses(sheetId);
		startPolling(sheetId, 10000); // Poll every 10 seconds
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
</script>

<div>
	{#if needsAuthorization}
		<div class="rounded-lg bg-yellow-50 p-8 text-center">
			<p class="font-medium text-yellow-800">Authorization Required</p>
			<p class="mt-2 text-sm text-yellow-700">
				To view the bus tracker, you need to authorize access to Google Sheets.
			</p>
			<button
				onclick={handleAuthorize}
				disabled={isAuthorizing}
				class="mt-4 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
			>
				{isAuthorizing ? 'Authorizing...' : 'Authorize Access'}
			</button>
		</div>
	{:else if busState.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div
					class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-bus-600 border-t-transparent"
				></div>
				<p class="mt-4 text-stone-600">Loading buses...</p>
			</div>
		</div>
	{:else if busState.error}
		<div class="rounded-lg bg-red-50 p-4 text-red-700">
			<p class="font-medium">Error loading buses</p>
			<p class="mt-1 text-sm">{busState.error}</p>
		</div>
	{:else if busState.buses.length === 0}
		<div class="rounded-lg bg-bus-100 p-8 text-center text-stone-600">
			<p>No buses configured for this tracker.</p>
			<p class="mt-2 text-sm">Ask your administrator to set up the bus list.</p>
		</div>
	{:else}
		<BusList
			buses={getBusesWithActions('teacher')}
			grouped={true}
			lastUpdated={busState.lastUpdated}
			error={busState.error}
		/>
	{/if}
</div>
