<script lang="ts">
	interface Props {
		lastUpdated: Date | null;
		isLoading?: boolean;
		error?: string | null;
	}

	let { lastUpdated, isLoading = false, error = null }: Props = $props();

	// Consider stale if more than 30 seconds since last update
	let isStale = $derived(() => {
		if (!lastUpdated) return true;
		return Date.now() - lastUpdated.getTime() > 30000;
	});
</script>

<div class="flex items-center gap-1.5" title={lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Not connected'}>
	{#if error}
		<!-- Error state - red dot -->
		<span class="relative flex h-2.5 w-2.5">
			<span class="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
			<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
		</span>
	{:else if isLoading}
		<!-- Loading state - pulsing gray -->
		<span class="relative flex h-2.5 w-2.5">
			<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-400 opacity-75"></span>
			<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-gray-400"></span>
		</span>
	{:else if isStale()}
		<!-- Stale state - yellow dot -->
		<span class="relative flex h-2.5 w-2.5">
			<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
		</span>
	{:else}
		<!-- Connected state - green dot with subtle pulse -->
		<span class="relative flex h-2.5 w-2.5">
			<span class="absolute inline-flex h-full w-full animate-pulse rounded-full bg-green-400 opacity-75"></span>
			<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
		</span>
	{/if}
</div>
