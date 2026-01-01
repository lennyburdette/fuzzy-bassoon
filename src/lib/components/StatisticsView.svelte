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
	import { calculateStatistics } from '$lib/utils/stats';
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
			const newReport = calculateStatistics(historicalData);
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
		const [year, month, day] = dateStr.split('-');
		return `${month}/${day}`;
	}

	// Daily trend chart configuration
	let dailyTrendConfig = $derived<ChartConfiguration | null>(
		report && report.dailyCounts.length > 0
			? {
					type: 'line',
					data: {
						labels: report.dailyCounts.map((d) => formatShortDate(d.date)),
						datasets: [
							{
								label: 'On-Time',
								data: report.dailyCounts.map((d) => d.onTime),
								borderColor: 'rgb(34, 197, 94)',
								backgroundColor: 'rgba(34, 197, 94, 0.1)',
								fill: true,
								tension: 0.3
							},
							{
								label: 'Late',
								data: report.dailyCounts.map((d) => d.late),
								borderColor: 'rgb(249, 115, 22)',
								backgroundColor: 'rgba(249, 115, 22, 0.1)',
								fill: true,
								tension: 0.3
							},
							{
								label: 'Uncovered',
								data: report.dailyCounts.map((d) => d.uncovered),
								borderColor: 'rgb(239, 68, 68)',
								backgroundColor: 'rgba(239, 68, 68, 0.1)',
								fill: true,
								tension: 0.3
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: true,
								text: 'Daily Arrivals Trend'
							}
						},
						scales: {
							y: {
								beginAtZero: true,
								ticks: {
									stepSize: 1
								}
							}
						}
					}
				}
			: null
	);

	// On-time pie chart configuration
	let onTimePieConfig = $derived<ChartConfiguration | null>(
		report
			? {
					type: 'doughnut',
					data: {
						labels: ['On-Time', 'Late'],
						datasets: [
							{
								data: [report.overallOnTimePct, 100 - report.overallOnTimePct],
								backgroundColor: ['rgb(34, 197, 94)', 'rgb(249, 115, 22)'],
								borderWidth: 0
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: true,
								text: 'Overall On-Time Rate'
							}
						}
					}
				}
			: null
	);

	// Per-bus delay chart configuration
	let busDelayConfig = $derived<ChartConfiguration | null>(
		report && report.perBusStats.length > 0
			? {
					type: 'bar',
					data: {
						labels: report.perBusStats.map((b) => `Bus ${b.busNumber}`),
						datasets: [
							{
								label: 'Avg Delay (min)',
								data: report.perBusStats.map((b) => b.avgDelayMinutes),
								backgroundColor: 'rgba(59, 130, 246, 0.8)'
							},
							{
								label: 'Max Delay (min)',
								data: report.perBusStats.map((b) => b.maxDelayMinutes),
								backgroundColor: 'rgba(59, 130, 246, 0.3)'
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						indexAxis: 'y',
						plugins: {
							title: {
								display: true,
								text: 'Delay by Bus'
							}
						},
						scales: {
							x: {
								beginAtZero: true,
								title: {
									display: true,
									text: 'Minutes'
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
			<h2 class="text-xl font-semibold text-gray-900">Statistics</h2>
			{#if report}
				<p class="mt-1 text-sm text-gray-600">
					Last generated: <span class="font-medium">{formatDate(report.generatedAt)}</span>
				</p>
				<p class="text-sm text-gray-500">
					Data range: {report.startDate} to {report.endDate} ({report.totalDays} days)
				</p>
			{:else if !isLoading}
				<p class="mt-1 text-sm text-gray-500">No report has been generated yet.</p>
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
				class="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
			></div>
		</div>
	{:else if !report}
		<!-- No report state -->
		<div class="rounded-lg bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No statistics report has been generated yet.</p>
			<p class="mt-2 text-sm text-gray-500">
				Click "Recalculate Report" to generate statistics from all historical data.
			</p>
		</div>
	{:else}
		<!-- Summary Cards -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="rounded-lg bg-blue-50 p-4">
				<p class="text-sm font-medium text-blue-600">Total Days</p>
				<p class="mt-1 text-3xl font-bold text-blue-900">{report.totalDays}</p>
			</div>
			<div class="rounded-lg bg-green-50 p-4">
				<p class="text-sm font-medium text-green-600">On-Time Rate</p>
				<p class="mt-1 text-3xl font-bold text-green-900">{report.overallOnTimePct}%</p>
			</div>
			<div class="rounded-lg bg-red-50 p-4">
				<p class="text-sm font-medium text-red-600">Uncovered Incidents</p>
				<p class="mt-1 text-3xl font-bold text-red-900">{report.uncoveredIncidents.length}</p>
			</div>
		</div>

		<!-- Charts Section -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Daily Trend Chart -->
			{#if dailyTrendConfig}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<ChartWrapper config={dailyTrendConfig} height="250px" />
				</div>
			{/if}

			<!-- On-Time Pie Chart -->
			{#if onTimePieConfig}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<ChartWrapper config={onTimePieConfig} height="250px" />
				</div>
			{/if}
		</div>

		<!-- Per-Bus Delay Chart -->
		{#if busDelayConfig}
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<ChartWrapper
					config={busDelayConfig}
					height={`${Math.max(200, report.perBusStats.length * 40)}px`}
				/>
			</div>
		{/if}

		<!-- Per-Bus Statistics Table -->
		<div class="rounded-lg border border-gray-200">
			<h3 class="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-900">
				Per-Bus Performance
			</h3>
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Bus</th>
							<th class="px-4 py-3 text-right text-sm font-medium text-gray-700">Avg Delay</th>
							<th class="px-4 py-3 text-right text-sm font-medium text-gray-700">Max Delay</th>
							<th class="px-4 py-3 text-right text-sm font-medium text-gray-700">On-Time %</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each report.perBusStats as bus}
							<tr>
								<td class="px-4 py-3 font-medium text-gray-900">Bus {bus.busNumber}</td>
								<td class="px-4 py-3 text-right text-gray-600">{bus.avgDelayMinutes} min</td>
								<td class="px-4 py-3 text-right text-gray-600">{bus.maxDelayMinutes} min</td>
								<td class="px-4 py-3 text-right">
									<span
										class="inline-block rounded-full px-2 py-1 text-sm {bus.onTimePct >= 90
											? 'bg-green-100 text-green-800'
											: bus.onTimePct >= 75
												? 'bg-yellow-100 text-yellow-800'
												: 'bg-red-100 text-red-800'}"
									>
										{bus.onTimePct}%
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Uncovered Incidents -->
		{#if report.uncoveredIncidents.length > 0}
			<div class="rounded-lg border border-gray-200">
				<h3 class="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-900">
					Uncovered Incidents
				</h3>
				<ul class="divide-y divide-gray-200">
					{#each report.uncoveredIncidents as incident}
						<li class="flex items-center justify-between px-4 py-3">
							<span class="font-medium text-gray-900">Bus {incident.busNumber}</span>
							<span class="text-gray-600">{incident.date}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Coverage Summary -->
		{#if report.coveragePairs.length > 0}
			<div class="rounded-lg border border-gray-200">
				<h3 class="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-900">
					Coverage Summary
				</h3>
				<ul class="divide-y divide-gray-200">
					{#each report.coveragePairs as pair}
						<li class="px-4 py-3 text-gray-700">
							Bus <span class="font-medium">{pair.coveringBus}</span> covered Bus
							<span class="font-medium">{pair.coveredBus}</span>:
							<span class="text-blue-600">{pair.count} time{pair.count !== 1 ? 's' : ''}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</div>
