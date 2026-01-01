<script lang="ts">
	import type { BusWithStatus } from '$lib/state/buses.svelte';

	interface Props {
		bus: BusWithStatus;
		onSave: (updates: { arrival_time?: string; departure_time?: string; covered_by?: string; is_uncovered?: boolean }) => void;
		onClose: () => void;
	}

	let { bus, onSave, onClose }: Props = $props();

	let arrivalTime = $state(bus.arrival_time);
	let departureTime = $state(bus.departure_time);
	let coveredBy = $state(bus.covered_by);
	let isUncovered = $state(bus.is_uncovered);

	function handleSave() {
		onSave({
			arrival_time: arrivalTime,
			departure_time: departureTime,
			covered_by: coveredBy,
			is_uncovered: isUncovered
		});
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50"
	onclick={onClose}
	role="dialog"
	aria-modal="true"
	aria-labelledby="edit-modal-title"
>
	<div
		class="w-full sm:mx-4 sm:max-w-sm rounded-t-xl sm:rounded-lg bg-white p-6 shadow-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<h2 id="edit-modal-title" class="mb-4 text-lg font-semibold text-stone-900">
			Edit Bus {bus.bus_number}
		</h2>

		<div class="space-y-4">
			<div>
				<div class="flex items-center justify-between">
					<label for="arrival-time" class="block text-sm font-medium text-stone-700">
						Arrival Time
					</label>
					{#if arrivalTime}
						<button
							type="button"
							onclick={() => (arrivalTime = '')}
							class="text-sm text-red-600 hover:text-red-800"
						>
							Clear
						</button>
					{/if}
				</div>
				<input
					type="time"
					id="arrival-time"
					bind:value={arrivalTime}
					class="mt-1 block w-full rounded-md border border-bus-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<div class="flex items-center justify-between">
					<label for="departure-time" class="block text-sm font-medium text-stone-700">
						Departure Time
					</label>
					{#if departureTime}
						<button
							type="button"
							onclick={() => (departureTime = '')}
							class="text-sm text-red-600 hover:text-red-800"
						>
							Clear
						</button>
					{/if}
				</div>
				<input
					type="time"
					id="departure-time"
					bind:value={departureTime}
					class="mt-1 block w-full rounded-md border border-bus-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="covered-by" class="block text-sm font-medium text-stone-700">
					Covered By (Bus Number)
				</label>
				<input
					type="text"
					id="covered-by"
					bind:value={coveredBy}
					placeholder="Leave empty if not covered"
					class="mt-1 block w-full rounded-md border border-bus-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div class="flex items-center gap-2">
				<input
					type="checkbox"
					id="is-uncovered"
					bind:checked={isUncovered}
					class="h-4 w-4 rounded border-bus-300 text-blue-600 focus:ring-blue-500"
				/>
				<label for="is-uncovered" class="text-sm font-medium text-stone-700">
					Mark as Uncovered (No-show)
				</label>
			</div>
		</div>

		<div class="mt-6 flex gap-2">
			<button
				onclick={handleSave}
				class="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
			>
				Save
			</button>
			<button
				onclick={onClose}
				class="flex-1 rounded-lg bg-bus-100 px-4 py-2 text-stone-700 hover:bg-bus-200"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
