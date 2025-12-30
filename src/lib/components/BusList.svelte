<script lang="ts">
	import type { BusWithStatus, BusSection } from '$lib/state/buses.svelte';
	import BusCard from './BusCard.svelte';

	interface Props {
		buses: BusWithStatus[];
		grouped?: boolean;
		onArrived?: (busNumber: string) => void;
		onDeparted?: (busNumber: string) => void;
		onCover?: (busNumber: string) => void;
		onUncovered?: (busNumber: string) => void;
		onEdit?: (busNumber: string) => void;
	}

	let {
		buses,
		grouped = false,
		onArrived,
		onDeparted,
		onCover,
		onUncovered,
		onEdit
	}: Props = $props();

	// Group buses by section (uses pre-computed bus.section)
	let groupedBuses = $derived.by(() => {
		if (!grouped) return null;

		const groups: Record<BusSection, BusWithStatus[]> = {
			pending: [],
			arrived: [],
			done: []
		};

		for (const bus of buses) {
			groups[bus.section].push(bus);
		}

		// Sort within each group
		for (const section of Object.keys(groups) as BusSection[]) {
			groups[section].sort((a, b) =>
				a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true })
			);
		}

		return groups;
	});

	// Flat sorted list (by section, then by bus number)
	let sortedBuses = $derived.by(() => {
		if (grouped) return [];

		const sectionOrder: Record<BusSection, number> = {
			pending: 0,
			arrived: 1,
			done: 2
		};

		return [...buses].sort((a, b) => {
			const sectionDiff = sectionOrder[a.section] - sectionOrder[b.section];
			if (sectionDiff !== 0) return sectionDiff;
			return a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true });
		});
	});

	const sectionLabels: Record<BusSection, string> = {
		pending: 'Pending',
		arrived: 'Here',
		done: 'Departed'
	};
</script>

{#if grouped && groupedBuses}
	<div class="space-y-6">
		{#each Object.entries(groupedBuses) as [section, sectionBuses]}
			{#if sectionBuses.length > 0}
				<section data-testid="{section}-section">
					<h3 class="mb-3 text-lg font-semibold text-gray-700">
						{sectionLabels[section as BusSection]}
						<span class="ml-2 text-sm font-normal text-gray-500">
							({sectionBuses.length})
						</span>
					</h3>
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each sectionBuses as bus}
							<BusCard
								{bus}
								{onArrived}
								{onDeparted}
								{onCover}
								{onUncovered}
								{onEdit}
							/>
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	</div>
{:else}
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each sortedBuses as bus}
			<BusCard
				{bus}
				{onArrived}
				{onDeparted}
				{onCover}
				{onUncovered}
				{onEdit}
			/>
		{/each}
	</div>
{/if}
