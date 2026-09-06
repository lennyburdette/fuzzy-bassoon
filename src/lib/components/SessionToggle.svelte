<!-- Segmented AM/PM control for switching the tracking session. Defaults to
     the session implied by the clock; switching reloads bus data for the
     other session's sheet. -->
<script lang="ts">
	import { getBusState, setSession } from '$lib/state/buses.svelte';
	import type { Session } from '$lib/utils/time';

	const busState = getBusState();

	const sessions: { value: Session; label: string }[] = [
		{ value: 'AM', label: 'AM' },
		{ value: 'PM', label: 'PM' }
	];
</script>

<div
	role="group"
	aria-label="Tracking session"
	data-testid="session-toggle"
	class="inline-flex rounded-lg border border-bus-300 bg-bus-50 p-0.5"
>
	{#each sessions as s}
		<button
			type="button"
			aria-pressed={busState.session === s.value}
			onclick={() => setSession(s.value)}
			class="min-w-[3.5rem] rounded-md px-3 py-1.5 text-sm font-medium transition-colors {busState.session ===
			s.value
				? 'bg-stone-900 text-bus-400 shadow-sm'
				: 'text-stone-600 hover:text-stone-900'}"
		>
			{s.label}
		</button>
	{/each}
</div>
