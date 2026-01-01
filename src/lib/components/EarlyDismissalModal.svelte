<script lang="ts">
	import Modal from './Modal.svelte';
	import type { BusConfig } from '$lib/services/sheets-api';
	import { getTodayDateEastern } from '$lib/utils/time';

	interface Props {
		buses: BusConfig[];
		onSave: (override: { date: string; time: string; busNumbers: string[] }) => void;
		onClose: () => void;
	}

	let { buses, onSave, onClose }: Props = $props();

	// Form state
	let selectedDate = $state(getTodayDateEastern());
	let overrideTime = $state('');
	// Initialize with all buses selected
	let selectedBuses = $state<Set<string>>(new Set());

	// Initialize selectedBuses when component mounts
	$effect(() => {
		if (selectedBuses.size === 0 && buses.length > 0) {
			selectedBuses = new Set(buses.map((b) => b.bus_number));
		}
	});

	// Derived state
	let allSelected = $derived(selectedBuses.size === buses.length);
	let noneSelected = $derived(selectedBuses.size === 0);
	let canSave = $derived(selectedDate && overrideTime && selectedBuses.size > 0);

	function selectAll() {
		selectedBuses = new Set(buses.map((b) => b.bus_number));
	}

	function selectNone() {
		selectedBuses = new Set();
	}

	function toggleBus(busNumber: string) {
		const newSet = new Set(selectedBuses);
		if (newSet.has(busNumber)) {
			newSet.delete(busNumber);
		} else {
			newSet.add(busNumber);
		}
		selectedBuses = newSet;
	}

	function handleSave() {
		if (canSave) {
			onSave({
				date: selectedDate,
				time: overrideTime,
				busNumbers: Array.from(selectedBuses)
			});
		}
	}
</script>

<Modal open={true} {onClose} titleId="early-dismissal-modal-title" variant="centered">
	<div
		class="max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-6 shadow-xl sm:mx-4 sm:max-w-md sm:rounded-lg"
	>
		<h2 id="early-dismissal-modal-title" class="mb-4 text-lg font-semibold text-stone-900">
			Add Early Dismissal
		</h2>

		<div class="space-y-4">
			<!-- Date Picker -->
			<div>
				<label for="dismissal-date" class="block text-sm font-medium text-stone-700"> Date </label>
				<input
					type="date"
					id="dismissal-date"
					bind:value={selectedDate}
					class="mt-1 block w-full rounded-md border border-bus-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<!-- Override Time -->
			<div>
				<label for="override-time" class="block text-sm font-medium text-stone-700">
					New Arrival Time
				</label>
				<input
					type="time"
					id="override-time"
					bind:value={overrideTime}
					class="mt-1 block w-full rounded-md border border-bus-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<!-- Bus Selection -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<span class="block text-sm font-medium text-stone-700">
						Apply to Buses ({selectedBuses.size} of {buses.length})
					</span>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={selectAll}
							disabled={allSelected}
							class="text-sm text-blue-600 hover:text-blue-800 disabled:text-stone-400"
						>
							All
						</button>
						<span class="text-stone-300">|</span>
						<button
							type="button"
							onclick={selectNone}
							disabled={noneSelected}
							class="text-sm text-blue-600 hover:text-blue-800 disabled:text-stone-400"
						>
							None
						</button>
					</div>
				</div>

				<div
					class="max-h-48 divide-y divide-bus-100 overflow-y-auto rounded-md border border-bus-200"
				>
					{#each buses as bus}
						<label
							class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-bus-50"
						>
							<input
								type="checkbox"
								checked={selectedBuses.has(bus.bus_number)}
								onchange={() => toggleBus(bus.bus_number)}
								class="h-4 w-4 rounded border-bus-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-stone-900">Bus {bus.bus_number}</span>
							<span class="text-sm text-stone-500">({bus.expected_arrival_time})</span>
						</label>
					{/each}
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="mt-6 flex gap-2">
			<button
				type="button"
				onclick={handleSave}
				disabled={!canSave}
				class="flex-1 rounded-lg bg-yellow-600 px-4 py-2 font-medium text-white hover:bg-yellow-700 disabled:bg-stone-300"
			>
				Add Early Dismissal
			</button>
			<button
				type="button"
				onclick={onClose}
				class="flex-1 rounded-lg bg-bus-100 px-4 py-2 text-stone-700 hover:bg-bus-200"
			>
				Cancel
			</button>
		</div>
	</div>
</Modal>
