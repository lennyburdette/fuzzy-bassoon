<script lang="ts">
	import type { BusWithStatus } from '$lib/state/buses.svelte';

	interface Props {
		bus: BusWithStatus;
		onArrived?: (busNumber: string) => void;
		onDeparted?: (busNumber: string) => void;
		onCover?: (busNumber: string) => void;
		onEdit?: (busNumber: string) => void;
	}

	let { bus, onArrived, onDeparted, onCover, onEdit }: Props = $props();

	// Actions are pre-computed in bus.actions based on view mode
</script>

<div
	class="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 active:bg-gray-50"
	data-testid="bus-{bus.bus_number}"
	data-status={bus.derivedStatus}
	style="view-transition-name: bus-{bus.bus_number}"
>
	<!-- Bus number -->
	<div class="flex min-w-[3rem] flex-col">
		<span class="text-2xl font-bold text-gray-900">{bus.bus_number}</span>
		{#if bus.covered_by}
			<span class="text-xs text-yellow-600">by {bus.covered_by}</span>
		{/if}
		{#if bus.is_uncovered}
			<span class="text-xs text-red-600">No show</span>
		{/if}
	</div>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Action buttons -->
	<div class="flex items-center gap-2">
		{#if bus.actions.canMarkArrived && onArrived}
			<button
				type="button"
				onclick={() => onArrived(bus.bus_number)}
				class="h-10 rounded-lg bg-green-600 px-3 text-sm font-medium text-white active:bg-green-800"
			>
				Arrived
			</button>
		{/if}

		{#if bus.actions.canMarkDeparted && onDeparted}
			<button
				type="button"
				onclick={() => onDeparted(bus.bus_number)}
				class="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 active:bg-gray-100"
			>
				Departed
			</button>
		{/if}

		{#if bus.actions.canMarkCovered && onCover}
			<button
				type="button"
				onclick={() => onCover(bus.bus_number)}
				class="h-10 rounded-lg bg-yellow-500 px-3 text-sm font-medium text-white active:bg-yellow-700"
			>
				Cover
			</button>
		{/if}

		{#if bus.actions.canEdit && onEdit}
			<button
				type="button"
				onclick={() => onEdit(bus.bus_number)}
				class="h-10 w-10 rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200"
			>
				<svg class="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
				</svg>
			</button>
		{/if}
	</div>
</div>
