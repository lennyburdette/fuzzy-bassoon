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

	function getCurrentTime(): string {
		const now = new Date();
		return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
	}

	function getTodayDate(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

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
			Edit Bus {bus.bus_number} for {getTodayDate()}
		</h2>

		<div class="space-y-4">
			<div>
				<label for="arrival-time" class="block text-sm font-medium text-stone-700">
					Arrival Time
				</label>
				<input
					type="time"
					id="arrival-time"
					bind:value={arrivalTime}
					class="mt-1 block w-full rounded-md border border-bus-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
				<div class="mt-2 flex gap-2">
					<button
						type="button"
						onclick={() => (arrivalTime = getCurrentTime())}
						class="flex-1 rounded-md bg-bus-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-bus-200"
					>
						Now
					</button>
					<button
						type="button"
						onclick={() => (arrivalTime = '')}
						class="flex-1 rounded-md bg-bus-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-bus-200"
					>
						Clear
					</button>
				</div>
			</div>

			<div>
				<label for="departure-time" class="block text-sm font-medium text-stone-700">
					Departure Time
				</label>
				<input
					type="time"
					id="departure-time"
					bind:value={departureTime}
					class="mt-1 block w-full rounded-md border border-bus-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
				<div class="mt-2 flex gap-2">
					<button
						type="button"
						onclick={() => (departureTime = getCurrentTime())}
						class="flex-1 rounded-md bg-bus-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-bus-200"
					>
						Now
					</button>
					<button
						type="button"
						onclick={() => (departureTime = '')}
						class="flex-1 rounded-md bg-bus-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-bus-200"
					>
						Clear
					</button>
				</div>
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

			<button
				type="button"
				onclick={() => (isUncovered = !isUncovered)}
				class="flex w-full items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors {isUncovered
					? 'border-red-500 bg-red-50'
					: 'border-bus-300 bg-white hover:bg-bus-50'}"
			>
				<div
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 {isUncovered
						? 'border-red-500 bg-red-500 text-white'
						: 'border-bus-400 bg-white'}"
				>
					{#if isUncovered}
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</div>
				<span class="font-medium {isUncovered ? 'text-red-700' : 'text-stone-700'}">
					Mark as Uncovered (No-show)
				</span>
			</button>
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
