<!-- Statistics dashboard for admins, focused on one question: does the
     school's uncovered-bus rate exceed the district average (1.6%)?
     Shows a headline rate with verdict, a per-session trend chart against
     the district line, and the list of uncovered incidents. Admins can
     trigger a full recalculation from all historical session sheets. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { ChartConfiguration } from 'chart.js';
	import {
		getStatisticsReport,
		getAllHistoricalData,
		saveStatisticsReport,
		ensureStatisticsSheet,
		type StatisticsReport
	} from '$lib/services/sheets-api';
	import { calculateStatistics, DISTRICT_AVERAGE_UNCOVERED_RATE } from '$lib/utils/stats';
	import ChartWrapper from './ChartWrapper.svelte';

	interface Props {
		sheetId: string;
	}

	let { sheetId }: Props = $props();

	let report = $state<StatisticsReport | null>(null);
	let isLoading = $state(true);
	let isRecalculating = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		await loadReport();
	});

	async function loadReport() {
		isLoading = true;
		error = null;
		try {
			report = await getStatisticsReport(sheetId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load statistics';
		} finally {
			isLoading = false;
		}
	}

	async function handleRecalculate() {
		isRecalculating = true;
		error = null;
		try {
			await ensureStatisticsSheet(sheetId);
			const historicalData = await getAllHistoricalData(sheetId);
			const newReport = calculateStatistics({ sessionData: historicalData.sessionData });
			await saveStatisticsReport(sheetId, newReport);
			report = newReport;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to generate statistics';
		} finally {
			isRecalculating = false;
		}
	}

	function formatDate(isoString: string): string {
		if (!isoString) return 'N/A';
		const date = new Date(isoString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatShortDate(dateStr: string): string {
		if (!dateStr) return '';
		const [, month, day] = dateStr.split('-');
		return `${month}/${day}`;
	}

	// Uncovered-rate trend against the district average line
	let trendConfig = $derived<ChartConfiguration | null>(
		report && report.sessionRates.length > 0
			? {
					type: 'line',
					data: {
						labels: report.sessionRates.map((r) => `${formatShortDate(r.date)} ${r.session}`),
						datasets: [
							{
								label: 'Uncovered Rate %',
								data: report.sessionRates.map((r) => r.ratePct),
								borderColor: 'rgb(239, 68, 68)',
								backgroundColor: 'rgba(239, 68, 68, 0.1)',
								fill: true,
								tension: 0.3
							},
							{
								label: `District Average (${DISTRICT_AVERAGE_UNCOVERED_RATE}%)`,
								data: report.sessionRates.map(() => DISTRICT_AVERAGE_UNCOVERED_RATE),
								borderColor: 'rgb(120, 113, 108)',
								borderDash: [6, 6],
								pointRadius: 0,
								fill: false
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: true,
								text: 'Uncovered Rate by Session'
							}
						},
						scales: {
							y: {
								beginAtZero: true,
								title: {
									display: true,
									text: '% of scheduled runs'
								}
							}
						}
					}
				}
			: null
	);
</script>

<div class="space-y-6">
	<!-- Header with recalculate button -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h2 class="text-xl font-semibold text-stone-900">Statistics</h2>
			{#if report}
				<p class="mt-1 text-sm text-stone-600">
					Last generated: <span class="font-medium">{formatDate(report.generatedAt)}</span>
				</p>
				<p class="text-sm text-stone-500">
					Data range: {report.startDate} to {report.endDate} ({report.totalSessions} sessions)
				</p>
			{:else if !isLoading}
				<p class="mt-1 text-sm text-stone-500">No report has been generated yet.</p>
			{/if}
		</div>
		<button
			onclick={handleRecalculate}
			disabled={isRecalculating}
			class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
		>
			{#if isRecalculating}
				<span class="flex items-center gap-2">
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
					></span>
					Calculating...
				</span>
			{:else}
				Recalculate Report
			{/if}
		</button>
	</div>

	<!-- Error message -->
	{#if error}
		<div class="rounded-lg bg-red-50 p-4 text-red-700">
			<p class="font-medium">Error</p>
			<p class="text-sm">{error}</p>
		</div>
	{/if}

	<!-- Loading state -->
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-bus-600 border-t-transparent"
			></div>
		</div>
	{:else if !report}
		<!-- No report state -->
		<div class="rounded-lg bg-bus-50 p-8 text-center">
			<p class="text-stone-600">No statistics report has been generated yet.</p>
			<p class="mt-2 text-sm text-stone-500">
				Click "Recalculate Report" to generate statistics from all historical data.
			</p>
		</div>
	{:else}
		<!-- Headline: uncovered rate vs district average -->
		<div
			data-testid="uncovered-rate-headline"
			class="rounded-lg border-2 p-6 text-center {report.exceedsDistrictAverage
				? 'border-red-300 bg-red-50'
				: 'border-green-300 bg-green-50'}"
		>
			<p class="text-sm font-medium uppercase tracking-wide {report.exceedsDistrictAverage
					? 'text-red-600'
					: 'text-green-700'}"
			>
				Uncovered Bus Rate
			</p>
			<p
				data-testid="uncovered-rate"
				class="mt-2 text-6xl font-bold {report.exceedsDistrictAverage
					? 'text-red-700'
					: 'text-green-800'}"
			>
				{report.uncoveredRatePct}%
			</p>
			<p
				data-testid="district-verdict"
				class="mt-3 text-lg font-medium {report.exceedsDistrictAverage
					? 'text-red-700'
					: 'text-green-800'}"
			>
				{#if report.exceedsDistrictAverage}
					Above the district average of {DISTRICT_AVERAGE_UNCOVERED_RATE}%
				{:else}
					At or below the district average of {DISTRICT_AVERAGE_UNCOVERED_RATE}%
				{/if}
			</p>
			<p class="mt-2 text-sm text-stone-600">
				{report.totalUncovered} uncovered of {report.totalScheduledRuns} scheduled bus runs
			</p>
		</div>

		<!-- Trend chart -->
		{#if trendConfig}
			<div class="rounded-lg border border-bus-200 bg-white p-4">
				<ChartWrapper config={trendConfig} height="250px" />
			</div>
		{/if}

		<!-- Uncovered Incidents -->
		{#if report.uncoveredIncidents.length > 0}
			<div class="rounded-lg border border-bus-200">
				<h3 class="border-b border-bus-200 bg-bus-50 px-4 py-3 font-medium text-stone-900">
					Uncovered Incidents
				</h3>
				<ul class="divide-y divide-bus-200">
					{#each report.uncoveredIncidents as incident}
						<li class="flex items-center justify-between px-4 py-3">
							<span class="font-medium text-stone-900">Bus {incident.busNumber}</span>
							<span class="text-stone-600">{incident.date} {incident.session}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</div>
