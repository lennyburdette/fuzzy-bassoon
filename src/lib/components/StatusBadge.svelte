<script lang="ts">
	import type { BusDerivedStatus } from '$lib/services/sheets-api';

	interface Props {
		status: BusDerivedStatus;
		compact?: boolean;
	}

	let { status, compact = false }: Props = $props();

	const statusConfig: Record<
		BusDerivedStatus,
		{ label: string; shortLabel: string; bgClass: string; textClass: string; dotClass: string }
	> = {
		pending: { label: 'Pending', shortLabel: 'Wait', bgClass: 'bg-gray-100', textClass: 'text-gray-700', dotClass: 'bg-gray-400' },
		arrived: { label: 'Here', shortLabel: 'Here', bgClass: 'bg-green-100', textClass: 'text-green-700', dotClass: 'bg-green-500' },
		departed: { label: 'Departed', shortLabel: 'Gone', bgClass: 'bg-blue-100', textClass: 'text-blue-700', dotClass: 'bg-blue-500' },
		uncovered: { label: 'Uncovered', shortLabel: 'N/A', bgClass: 'bg-red-100', textClass: 'text-red-700', dotClass: 'bg-red-500' }
	};

	let config = $derived(statusConfig[status]);
</script>

{#if compact}
	<span
		class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {config.bgClass} {config.textClass}"
	>
		<span class="h-2 w-2 rounded-full {config.dotClass}"></span>
		{config.shortLabel}
	</span>
{:else}
	<span
		class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {config.bgClass} {config.textClass}"
	>
		{config.label}
	</span>
{/if}
