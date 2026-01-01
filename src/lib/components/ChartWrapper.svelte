<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables, type ChartConfiguration } from 'chart.js';

	Chart.register(...registerables);

	interface Props {
		config: ChartConfiguration;
		height?: string;
	}

	let { config, height = '300px' }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, config);
	});

	onDestroy(() => {
		chart?.destroy();
	});

	// Update chart when config changes
	$effect(() => {
		if (chart && config) {
			chart.data = config.data;
			chart.options = config.options || {};
			chart.update();
		}
	});
</script>

<div style="height: {height}; position: relative;">
	<canvas bind:this={canvas}></canvas>
</div>
