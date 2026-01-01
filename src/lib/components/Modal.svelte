<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		titleId: string;
		children: Snippet;
		variant?: 'centered' | 'bottom-sheet';
	}

	let { open, onClose, titleId, children, variant = 'centered' }: Props = $props();

	let dialogRef: HTMLDialogElement | undefined = $state();
	let previouslyFocused: HTMLElement | null = null;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogRef) {
			onClose();
		}
	}

	$effect(() => {
		if (open && dialogRef) {
			previouslyFocused = document.activeElement as HTMLElement;
			dialogRef.showModal();
		} else if (!open && dialogRef?.open) {
			dialogRef.close();
			previouslyFocused?.focus();
		}
	});

	onDestroy(() => {
		previouslyFocused?.focus();
	});
</script>

<dialog
	bind:this={dialogRef}
	class="modal {variant}"
	aria-labelledby={titleId}
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
>
	{@render children()}
</dialog>

<style>
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	dialog.modal {
		border: none;
		padding: 0;
		background: transparent;
		max-width: 100vw;
		max-height: 100vh;
		overflow: visible;
	}

	dialog.modal:focus {
		outline: none;
	}

	dialog.centered {
		margin: auto;
	}

	dialog.bottom-sheet {
		margin: auto auto 0 auto;
		width: 100%;
		max-width: 100%;
	}
</style>
