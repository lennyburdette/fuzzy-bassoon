<script lang="ts">
	import type { BusWithStatus, BusSection } from '$lib/state/buses.svelte';
	import BusItem from './BusItem.svelte';

	interface Props {
		buses: BusWithStatus[];
		grouped?: boolean;
		pendingFirst?: boolean;
		onArrived?: (busNumber: string) => void;
		onDeparted?: (busNumber: string) => void;
		onCover?: (busNumber: string) => void;
		onUncovered?: (busNumber: string) => void;
		onEdit?: (busNumber: string) => void;
	}

	let {
		buses,
		grouped = false,
		pendingFirst = false,
		onArrived,
		onDeparted,
		onCover,
		onUncovered,
		onEdit
	}: Props = $props();

	// Section display order: default is Here first, but monitor view wants Pending first
	let sectionOrder: BusSection[] = $derived(
		pendingFirst ? ['pending', 'arrived', 'done'] : ['arrived', 'pending', 'done']
	);

	// Group buses by section (uses pre-computed bus.section)
	let groupedBuses = $derived.by(() => {
		if (!grouped) return null;

		const groups: Record<BusSection, BusWithStatus[]> = {
			arrived: [],
			pending: [],
			done: []
		};

		for (const bus of buses) {
			groups[bus.section].push(bus);
		}

		// Sort within each group: uncovered first in pending, then alphabetically
		const sortAlpha = (a: BusWithStatus, b: BusWithStatus) =>
			a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true });

		for (const section of Object.keys(groups) as BusSection[]) {
			if (section === 'pending') {
				groups[section].sort((a, b) => {
					if (a.is_uncovered && !b.is_uncovered) return -1;
					if (!a.is_uncovered && b.is_uncovered) return 1;
					return sortAlpha(a, b);
				});
			} else {
				groups[section].sort(sortAlpha);
			}
		}

		return groups;
	});

	// Flat sorted list (by section order, then uncovered first in pending, then by bus number)
	let sortedBuses = $derived.by(() => {
		if (grouped) return [];

		const sectionOrderMap: Record<BusSection, number> = {
			arrived: 0,
			pending: 1,
			done: 2
		};

		return [...buses].sort((a, b) => {
			const sectionDiff = sectionOrderMap[a.section] - sectionOrderMap[b.section];
			if (sectionDiff !== 0) return sectionDiff;
			// Within pending section, uncovered buses come first
			if (a.section === 'pending') {
				if (a.is_uncovered && !b.is_uncovered) return -1;
				if (!a.is_uncovered && b.is_uncovered) return 1;
			}
			return a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true });
		});
	});

	const sectionLabels: Record<BusSection, string> = {
		pending: 'Pending',
		arrived: 'Here',
		done: 'Departed'
	};

	const sectionColors: Record<BusSection, string> = {
		pending: 'bg-yellow-50 text-yellow-700',
		arrived: 'bg-green-50 text-green-700',
		done: 'bg-gray-100 text-gray-500'
	};
</script>

{#if grouped && groupedBuses}
	<div class="sm:space-y-6">
		{#each sectionOrder as section}
			{@const sectionBuses = groupedBuses[section]}
			{#if sectionBuses.length > 0}
				<section data-testid="{section}-section">
					<!-- Mobile: colored bar header -->
					<div class="px-4 py-2 text-sm font-medium {sectionColors[section]} sm:hidden">
						{sectionLabels[section]} ({sectionBuses.length})
					</div>
					<!-- Desktop: text heading -->
					<h3 class="mb-3 hidden text-lg font-semibold text-gray-700 sm:block">
						{sectionLabels[section]}
						<span class="ml-2 text-sm font-normal text-gray-500">
							({sectionBuses.length})
						</span>
					</h3>
					<!-- Mobile: stacked rows, Desktop: grid of cards -->
					<div class="divide-y divide-gray-100 sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0 lg:grid-cols-3">
						{#each sectionBuses as bus (bus.bus_number)}
							<BusItem
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
	<div class="divide-y divide-gray-100 sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0 lg:grid-cols-3">
		{#each sortedBuses as bus (bus.bus_number)}
			<BusItem
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
