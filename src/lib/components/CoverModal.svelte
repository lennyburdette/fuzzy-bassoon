<script lang="ts">
	interface Props {
		busNumber: string;
		onSelect: (coveringBus: string) => void;
		onClose: () => void;
	}

	let { busNumber, onSelect, onClose }: Props = $props();

	let selectedPrefix = $state<string>('');
	let selectedNumber = $state<string>('');

	const prefixes = ['B', 'HS', 'MS'];

	let displayValue = $derived(selectedPrefix + selectedNumber);
	let canSubmit = $derived(displayValue.length > 0);

	function selectPrefix(prefix: string) {
		if (selectedPrefix === prefix) {
			selectedPrefix = '';
		} else {
			selectedPrefix = prefix;
		}
	}

	function appendNumber(num: string) {
		selectedNumber += num;
	}

	function backspace() {
		if (selectedNumber.length > 0) {
			selectedNumber = selectedNumber.slice(0, -1);
		} else if (selectedPrefix.length > 0) {
			selectedPrefix = '';
		}
	}

	function clear() {
		selectedPrefix = '';
		selectedNumber = '';
	}

	function submit() {
		if (canSubmit) {
			onSelect(displayValue);
		}
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/50"
	onclick={onClose}
	role="dialog"
	aria-modal="true"
	aria-labelledby="cover-modal-title"
>
	<!-- Bottom sheet -->
	<div
		class="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 pb-8 shadow-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="mx-auto mb-4 h-1 w-12 rounded-full bg-gray-300"></div>

		<h2 id="cover-modal-title" class="mb-2 text-center text-lg font-semibold text-gray-900">
			Which bus is covering {busNumber}?
		</h2>

		<!-- Display value -->
		<div class="mb-4 flex items-center justify-center gap-2">
			<div
				class="flex h-14 min-w-[120px] items-center justify-center rounded-lg border-2 border-gray-200 bg-gray-50 px-4 text-2xl font-bold text-gray-900"
			>
				{displayValue || '—'}
			</div>
			{#if displayValue}
				<button
					type="button"
					onclick={backspace}
					class="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-200 text-gray-700 active:bg-gray-300"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
						/>
					</svg>
				</button>
			{/if}
		</div>

		<!-- Prefix buttons -->
		<div class="mb-3 flex justify-center gap-2">
			{#each prefixes as prefix}
				<button
					type="button"
					onclick={() => selectPrefix(prefix)}
					class="h-12 rounded-lg px-5 text-lg font-medium transition-colors {selectedPrefix ===
					prefix
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 text-gray-700 active:bg-gray-200'}"
				>
					{prefix}
				</button>
			{/each}
		</div>

		<!-- Number pad -->
		<div class="mx-auto grid max-w-xs grid-cols-3 gap-2">
			{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as num}
				<button
					type="button"
					onclick={() => appendNumber(num)}
					class="h-14 rounded-lg bg-gray-100 text-xl font-medium text-gray-900 active:bg-gray-200"
				>
					{num}
				</button>
			{/each}
			<button
				type="button"
				onclick={clear}
				class="h-14 rounded-lg bg-gray-100 text-sm font-medium text-gray-500 active:bg-gray-200"
			>
				Clear
			</button>
			<button
				type="button"
				onclick={() => appendNumber('0')}
				class="h-14 rounded-lg bg-gray-100 text-xl font-medium text-gray-900 active:bg-gray-200"
			>
				0
			</button>
			<button
				type="button"
				onclick={submit}
				disabled={!canSubmit}
				class="h-14 rounded-lg bg-green-600 text-sm font-medium text-white active:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400"
			>
				Done
			</button>
		</div>

		<!-- Cancel button -->
		<button
			type="button"
			onclick={onClose}
			class="mt-4 w-full rounded-lg bg-gray-100 py-3 text-gray-700 active:bg-gray-200"
		>
			Cancel
		</button>
	</div>
</div>
