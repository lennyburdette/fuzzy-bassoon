<script lang="ts">
	import { onMount } from 'svelte';
	import { renderSignInButton } from '$lib/state/auth.svelte';

	let buttonContainer: HTMLDivElement;

	onMount(() => {
		// Wait for Google Identity Services to load
		const checkGoogle = setInterval(() => {
			if (typeof window !== 'undefined' && window.google?.accounts?.id) {
				clearInterval(checkGoogle);
				renderSignInButton(buttonContainer);
			}
		}, 100);

		// Timeout after 5 seconds
		setTimeout(() => clearInterval(checkGoogle), 5000);

		return () => clearInterval(checkGoogle);
	});
</script>

<div bind:this={buttonContainer} data-testid="google-signin-container" class="inline-block"></div>
