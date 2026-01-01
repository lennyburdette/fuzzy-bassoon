<script lang="ts">
	import type { BusWithStatus } from '$lib/state/buses.svelte';
	import { formatTime12Hour } from '$lib/utils/time';

	interface Props {
		bus: BusWithStatus;
		onArrived?: (busNumber: string) => void;
		onDeparted?: (busNumber: string) => void;
		onCover?: (busNumber: string) => void;
		onUncovered?: (busNumber: string) => void;
		onEdit?: (busNumber: string) => void;
	}

	let { bus, onArrived, onDeparted, onCover, onUncovered, onEdit }: Props = $props();
</script>

<div
	class="
		{bus.is_uncovered
			? 'bg-[repeating-linear-gradient(135deg,#fef2f2,#fef2f2_10px,#fee2e2_10px,#fee2e2_20px)] sm:border-red-200'
			: 'bg-white sm:border-stone-200'}

		flex items-center gap-3 px-4 py-3
		active:bg-stone-50

		border-b border-stone-200 last:border-b-0
		sm:last:border-b sm:block sm:rounded-lg sm:border sm:p-4 sm:shadow-sm sm:transition-shadow sm:hover:shadow-md
	"
	data-testid="bus-{bus.bus_number}"
	data-status={bus.derivedStatus}
	style="view-transition-name: bus-{bus.bus_number}"
>
	<!-- Mobile: row layout -->
	<div class="flex min-w-[3rem] flex-col sm:hidden">
		<span class="text-2xl font-bold text-stone-900">{bus.bus_number}</span>
		{#if bus.covered_by}
			<span class="text-xs text-bus-700">by {bus.covered_by}</span>
		{/if}
		{#if bus.is_uncovered}
			<span class="text-xs font-medium text-red-600">Uncovered</span>
		{/if}
	</div>

	<!-- Desktop: card header -->
	<div class="hidden sm:flex sm:items-center sm:justify-between">
		<div class="flex flex-col">
			<div class="flex items-center gap-3">
				{#if bus.covered_by}
					<span class="text-2xl font-bold text-stone-400">{bus.bus_number}</span>
					<span class="rounded bg-bus-200 px-2 text-2xl font-bold text-bus-700"
						>{bus.covered_by}</span
					>
				{:else}
					<span class="text-2xl font-bold text-stone-900">{bus.bus_number}</span>
				{/if}
			</div>
			{#if bus.is_uncovered}
				<span class="text-sm font-medium text-red-600">Uncovered</span>
			{/if}
		</div>

		{#if bus.actions.canEdit && onEdit}
			<button
				type="button"
				onclick={() => onEdit(bus.bus_number)}
				class="rounded-md bg-bus-200 px-3 py-1.5 text-sm text-bus-800 hover:bg-bus-300"
			>
				Edit
			</button>
		{/if}
	</div>

	<!-- Desktop: time display -->
	<div class="mt-3 hidden flex-wrap items-center gap-2 text-sm text-stone-500 sm:flex">
		{#if bus.departure_time}
			<span class="text-blue-600">Departed: {formatTime12Hour(bus.departure_time)}</span>
		{:else if bus.arrival_time}
			<span class="text-green-600">Arrived: {formatTime12Hour(bus.arrival_time)}</span>
		{/if}
	</div>

	<!-- Spacer for mobile row layout -->
	<div class="flex-1 sm:hidden"></div>

	<!-- Action buttons -->
	{#if bus.actions.canMarkArrived || bus.actions.canMarkDeparted || bus.actions.canMarkCovered || bus.actions.canMarkUncovered || (bus.actions.canEdit && onEdit)}
		<div class="flex items-center gap-2 sm:mt-4 sm:flex-wrap">
			{#if bus.actions.canMarkArrived && onArrived}
				<button
					type="button"
					onclick={() => onArrived(bus.bus_number)}
					class="h-10 min-w-[44px] rounded-lg bg-green-600 px-3 text-sm font-medium text-white active:bg-green-800 sm:min-h-[44px] sm:px-4 sm:py-2 sm:hover:bg-green-700"
				>
					Arrived
				</button>
			{/if}

			{#if bus.actions.canMarkDeparted && onDeparted}
				<button
					type="button"
					onclick={() => onDeparted(bus.bus_number)}
					class="h-10 min-w-[44px] rounded-lg border border-bus-300 bg-bus-50 px-3 text-sm font-medium text-bus-800 active:bg-bus-200 sm:min-h-[44px] sm:bg-blue-600 sm:px-4 sm:py-2 sm:text-white sm:hover:bg-blue-700 sm:active:bg-blue-800 sm:border-0"
				>
					Departed
				</button>
			{/if}

			{#if bus.actions.canMarkCovered && onCover}
				<button
					type="button"
					onclick={() => onCover(bus.bus_number)}
					class="h-10 min-w-[44px] rounded-lg bg-bus-500 px-3 text-sm font-medium text-white active:bg-bus-700 sm:min-h-[44px] sm:px-4 sm:py-2 sm:hover:bg-bus-600"
				>
					Cover
				</button>
			{/if}

			{#if bus.actions.canMarkUncovered && onUncovered}
				<button
					type="button"
					onclick={() => onUncovered(bus.bus_number)}
					class="h-10 min-w-[44px] rounded-lg bg-red-600 px-3 text-sm font-medium text-white active:bg-red-800 sm:min-h-[44px] sm:px-4 sm:py-2 sm:hover:bg-red-700"
				>
					Uncovered
				</button>
			{/if}

			<!-- Mobile: Edit button as icon -->
			{#if bus.actions.canEdit && onEdit}
				<button
					type="button"
					onclick={() => onEdit(bus.bus_number)}
					aria-label="Edit bus {bus.bus_number}"
					class="h-10 w-10 rounded-lg bg-bus-200 text-bus-700 active:bg-bus-300 sm:hidden"
				>
					<svg class="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
						/>
					</svg>
				</button>
			{/if}
		</div>
	{/if}
</div>
