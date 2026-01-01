<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    getBusState,
    loadBuses,
    startPolling,
    stopPolling,
    updateBusLocally,
    getBusesWithActions,
  } from "$lib/state/buses.svelte";
  import {
    saveBusConfig,
    markBusArrived,
    markBusDeparted,
    markBusCovered,
    markBusUncovered,
    updateBusStatus,
    type BusConfig,
  } from "$lib/services/sheets-api";
  import { getCurrentTimeEastern } from "$lib/utils/time";
  import {
    getCurrentUser,
    getAccessToken,
    requestAccessToken,
  } from "$lib/state/auth.svelte";
  import BusList from "./BusList.svelte";
  import CoverModal from "./CoverModal.svelte";
  import EditBusModal from "./EditBusModal.svelte";
  import EarlyDismissalModal from "./EarlyDismissalModal.svelte";
  import StatisticsView from "./StatisticsView.svelte";

  interface Props {
    sheetId: string;
  }

  let { sheetId }: Props = $props();

  const busState = getBusState();
  let activeTab = $state<"status" | "config" | "stats">("status");
  let editingBusData = $state<typeof busState.buses[0] | null>(null);
  let coveringBus = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  // Config editing state
  let editingConfig = $state<BusConfig[]>([]);
  let newBusNumber = $state("");
  let newArrivalTime = $state("");
  let needsAuthorization = $state(false);
  let isAuthorizing = $state(false);
  let showEarlyDismissalModal = $state(false);

  onMount(async () => {
    // Check if we have an access token
    if (!getAccessToken()) {
      needsAuthorization = true;
      return;
    }
    await loadBuses(sheetId);
    editingConfig = [...busState.config];
    startPolling(sheetId, 10000);
  });

  async function handleAuthorize() {
    isAuthorizing = true;
    requestAccessToken();

    // Wait for the token to be available (poll for up to 30 seconds)
    const startTime = Date.now();
    while (!getAccessToken() && Date.now() - startTime < 30000) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (getAccessToken()) {
      needsAuthorization = false;
      await loadBuses(sheetId);
      editingConfig = [...busState.config];
      startPolling(sheetId, 10000);
    }
    isAuthorizing = false;
  }

  onDestroy(() => {
    stopPolling();
  });

  // Sync config when it changes
  $effect(() => {
    if (busState.config.length > 0 && editingConfig.length === 0) {
      editingConfig = [...busState.config];
    }
  });

  async function handleArrived(busNumber: string) {
    const user = getCurrentUser();
    if (!user) return;

    try {
      actionError = null;
      const time = getCurrentTimeEastern();
      updateBusLocally(busNumber, { arrival_time: time });
      await markBusArrived(sheetId, busNumber, user.email);
      successMessage = `Bus ${busNumber} marked as arrived`;
      setTimeout(() => (successMessage = null), 3000);
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Failed to mark arrived";
      try {
        await loadBuses(sheetId);
      } catch {
        // Ignore reload errors
      }
    }
  }

  async function handleDeparted(busNumber: string) {
    const user = getCurrentUser();
    if (!user) return;

    try {
      actionError = null;
      const time = getCurrentTimeEastern();
      updateBusLocally(busNumber, { departure_time: time });
      await markBusDeparted(sheetId, busNumber, user.email);
      successMessage = `Bus ${busNumber} marked as departed`;
      setTimeout(() => (successMessage = null), 3000);
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Failed to mark departed";
      try {
        await loadBuses(sheetId);
      } catch {
        // Ignore reload errors
      }
    }
  }

  function handleCover(busNumber: string) {
    coveringBus = busNumber;
  }

  async function handleCoverSelect(coveringBusNumber: string) {
    const user = getCurrentUser();
    if (!user || !coveringBus) return;

    const busToUpdate = coveringBus;
    const time = getCurrentTimeEastern();

    coveringBus = null;

    try {
      actionError = null;
      updateBusLocally(busToUpdate, { covered_by: coveringBusNumber, arrival_time: time });
      await markBusCovered(sheetId, busToUpdate, coveringBusNumber, user.email);
      successMessage = `Bus ${busToUpdate} marked as covered by ${coveringBusNumber}`;
      setTimeout(() => (successMessage = null), 3000);
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Failed to mark covered";
      try {
        await loadBuses(sheetId);
      } catch {
        // Ignore reload errors
      }
    }
  }

  async function handleUncovered(busNumber: string) {
    const user = getCurrentUser();
    if (!user) return;

    try {
      actionError = null;
      updateBusLocally(busNumber, { is_uncovered: true });
      await markBusUncovered(sheetId, busNumber, user.email);
      successMessage = `Bus ${busNumber} marked as uncovered`;
      setTimeout(() => (successMessage = null), 3000);
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Failed to mark uncovered";
      try {
        await loadBuses(sheetId);
      } catch {
        // Ignore reload errors
      }
    }
  }

  function handleEdit(busNumber: string) {
    // Capture a snapshot of the bus data when opening the modal
    const bus = busState.buses.find((b) => b.bus_number === busNumber);
    if (bus) {
      editingBusData = { ...bus };
    }
  }

  async function handleEditSave(updates: {
    arrival_time?: string;
    departure_time?: string;
    covered_by?: string;
    is_uncovered?: boolean;
  }) {
    const user = getCurrentUser();
    if (!user || !editingBusData) return;

    const busToUpdate = editingBusData.bus_number;
    editingBusData = null; // Close modal before state updates

    try {
      actionError = null;
      updateBusLocally(busToUpdate, updates);
      await updateBusStatus(sheetId, busToUpdate, updates, user.email);
      successMessage = "Changes saved";
      setTimeout(() => (successMessage = null), 3000);
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Failed to save changes";
      try {
        await loadBuses(sheetId);
      } catch {
        // Ignore reload errors
      }
    }
  }

  function addBus() {
    if (!newBusNumber.trim()) return;

    // Use the entered time, or fall back to the last bus's time
    const timeToUse = newArrivalTime || defaultArrivalTime;

    editingConfig = [
      ...editingConfig,
      {
        bus_number: newBusNumber.trim(),
        expected_arrival_time: timeToUse,
      },
    ];
    newBusNumber = "";
    newArrivalTime = "";
  }

  function removeBus(index: number) {
    editingConfig = editingConfig.filter((_, i) => i !== index);
  }

  function updateBusTime(index: number, time: string) {
    editingConfig = editingConfig.map((bus, i) =>
      i === index ? { ...bus, expected_arrival_time: time } : bus
    );
  }

  async function saveConfig() {
    try {
      actionError = null;
      await saveBusConfig(sheetId, editingConfig);
      await loadBuses(sheetId);
      successMessage = "Configuration saved";
      setTimeout(() => (successMessage = null), 3000);
    } catch (e) {
      actionError =
        e instanceof Error ? e.message : "Failed to save configuration";
    }
  }

  // Early dismissal helper functions
  function hasOverrides(config: BusConfig[]): boolean {
    return config.some(
      (bus) =>
        bus.early_dismissal_overrides &&
        Object.keys(bus.early_dismissal_overrides).length > 0
    );
  }

  function getUniqueOverrideDates(config: BusConfig[]): string[] {
    const dates = new Set<string>();
    for (const bus of config) {
      if (bus.early_dismissal_overrides) {
        for (const date of Object.keys(bus.early_dismissal_overrides)) {
          dates.add(date);
        }
      }
    }
    return Array.from(dates).sort();
  }

  function getOverrideCount(config: BusConfig[], date: string): number {
    return config.filter((bus) => bus.early_dismissal_overrides?.[date]).length;
  }

  function formatOverrideDate(dateStr: string): string {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function handleEarlyDismissalSave(override: {
    date: string;
    time: string;
    busNumbers: string[];
  }) {
    showEarlyDismissalModal = false;

    editingConfig = editingConfig.map((bus) => {
      if (override.busNumbers.includes(bus.bus_number)) {
        return {
          ...bus,
          early_dismissal_overrides: {
            ...bus.early_dismissal_overrides,
            [override.date]: override.time,
          },
        };
      }
      return bus;
    });
  }

  function removeOverrideForDate(date: string) {
    editingConfig = editingConfig.map((bus) => {
      if (bus.early_dismissal_overrides?.[date]) {
        const overrides = { ...bus.early_dismissal_overrides };
        delete overrides[date];
        return { ...bus, early_dismissal_overrides: overrides };
      }
      return bus;
    });
  }

  // Default new arrival time to the last bus's time
  let defaultArrivalTime = $derived(
    editingConfig.length > 0
      ? editingConfig[editingConfig.length - 1].expected_arrival_time
      : ""
  );
</script>

<div>
  {#if needsAuthorization}
    <div class="rounded-lg bg-yellow-50 p-8 text-center">
      <p class="font-medium text-yellow-800">Authorization Required</p>
      <p class="mt-2 text-sm text-yellow-700">
        To access the bus tracker data, you need to authorize access to Google
        Sheets.
      </p>
      <button
        onclick={handleAuthorize}
        disabled={isAuthorizing}
        class="mt-4 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {isAuthorizing ? "Authorizing..." : "Authorize Access"}
      </button>
    </div>
  {:else}
    <!-- Tab Navigation -->
    <div class="mb-6 border-b border-bus-200">
      <nav class="-mb-px flex space-x-8">
        <button
          onclick={() => (activeTab = "status")}
          class="border-b-2 px-1 py-4 text-sm font-medium {activeTab ===
          'status'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-stone-500 hover:border-bus-300 hover:text-stone-700'}"
        >
          Today's Status
        </button>
        <button
          onclick={() => (activeTab = "config")}
          class="border-b-2 px-1 py-4 text-sm font-medium {activeTab ===
          'config'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-stone-500 hover:border-bus-300 hover:text-stone-700'}"
        >
          Configure Buses
        </button>
        <button
          onclick={() => (activeTab = "stats")}
          class="border-b-2 px-1 py-4 text-sm font-medium {activeTab === 'stats'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-stone-500 hover:border-bus-300 hover:text-stone-700'}"
        >
          Statistics
        </button>
      </nav>
    </div>

    <!-- Messages -->
    {#if actionError}
      <div class="mb-4 rounded-lg bg-red-50 p-3 text-red-700">
        <p class="text-sm">{actionError}</p>
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-4 rounded-lg bg-green-50 p-3 text-green-700">
        <p class="text-sm">{successMessage}</p>
      </div>
    {/if}

    <!-- Status Tab -->
    {#if activeTab === "status"}
      {#if busState.isLoading}
        <div class="flex items-center justify-center py-12">
          <div
            class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-bus-600 border-t-transparent"
          ></div>
        </div>
      {:else if busState.error}
        <div class="rounded-lg bg-red-50 p-8 text-center text-red-700">
          <p class="font-medium">Failed to load bus data</p>
          <p class="mt-2 text-sm">{busState.error}</p>
          <button
            onclick={() => loadBuses(sheetId)}
            class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      {:else if busState.buses.length === 0}
        <div class="rounded-lg bg-bus-50 p-8 text-center text-stone-600">
          <p>No buses configured.</p>
          <button
            onclick={() => (activeTab = "config")}
            class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Configure Buses
          </button>
        </div>
      {:else}
        <BusList
          buses={getBusesWithActions('admin')}
          grouped={true}
          onArrived={handleArrived}
          onDeparted={handleDeparted}
          onCover={handleCover}
          onUncovered={handleUncovered}
          onEdit={handleEdit}
        />
      {/if}
    {/if}

    <!-- Config Tab -->
    {#if activeTab === "config"}
      <div class="space-y-6">
        <!-- Early Dismissal -->
        <div class="rounded-lg bg-yellow-50 p-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-yellow-800">Early Dismissal</h3>
              <p class="mt-1 text-sm text-yellow-700">
                Set override arrival times for specific dates.
              </p>
            </div>
            <button
              onclick={() => (showEarlyDismissalModal = true)}
              class="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
            >
              Add Early Dismissal
            </button>
          </div>

          <!-- Show existing overrides -->
          {#if hasOverrides(editingConfig)}
            <div class="mt-4 space-y-2">
              <h4 class="text-sm font-medium text-yellow-800">
                Scheduled Overrides
              </h4>
              {#each getUniqueOverrideDates(editingConfig) as date}
                <div
                  class="flex items-center justify-between rounded bg-yellow-100 px-3 py-2"
                >
                  <span class="text-sm text-yellow-900">
                    {formatOverrideDate(date)}: {getOverrideCount(
                      editingConfig,
                      date
                    )} bus(es) affected
                  </span>
                  <button
                    onclick={() => removeOverrideForDate(date)}
                    class="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Bus List -->
        <div class="rounded-lg border border-bus-200">
          <table class="w-full">
            <thead class="bg-bus-50">
              <tr>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-stone-700"
                  >Bus Number</th
                >
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-stone-700"
                >
                  Expected Arrival Time
                </th>
                <th
                  class="px-4 py-3 text-right text-sm font-medium text-stone-700"
                  >Actions</th
                >
              </tr>
            </thead>
            <tbody class="divide-y divide-bus-200">
              {#each editingConfig as bus, index}
                <tr>
                  <td class="px-4 py-3 text-stone-900">{bus.bus_number}</td>
                  <td class="px-4 py-3">
                    <input
                      type="time"
                      value={bus.expected_arrival_time}
                      onchange={(e) =>
                        updateBusTime(
                          index,
                          (e.target as HTMLInputElement).value
                        )}
                      class="rounded border border-bus-300 px-2 py-1"
                    />
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      onclick={() => removeBus(index)}
                      class="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              {/each}
              <tr class="bg-bus-50">
                <td class="px-4 py-3">
                  <input
                    type="text"
                    bind:value={newBusNumber}
                    placeholder="Bus number"
                    class="w-full rounded border border-bus-300 px-2 py-1"
                  />
                </td>
                <td class="px-4 py-3">
                  <input
                    type="time"
                    value={newArrivalTime || defaultArrivalTime}
                    onchange={(e) => (newArrivalTime = (e.target as HTMLInputElement).value)}
                    class="rounded border border-bus-300 px-2 py-1"
                  />
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    onclick={addBus}
                    class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                  >
                    Add Bus
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end">
          <button
            onclick={saveConfig}
            class="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
          >
            Save Configuration
          </button>
        </div>
      </div>
    {/if}

    <!-- Stats Tab -->
    {#if activeTab === "stats"}
      <StatisticsView {sheetId} />
    {/if}
  {/if}
</div>

{#if coveringBus}
  <CoverModal
    busNumber={coveringBus}
    onSelect={handleCoverSelect}
    onClose={() => (coveringBus = null)}
  />
{/if}

{#if editingBusData}
  <EditBusModal
    bus={editingBusData}
    onSave={handleEditSave}
    onClose={() => (editingBusData = null)}
  />
{/if}

{#if showEarlyDismissalModal}
  <EarlyDismissalModal
    buses={editingConfig}
    onSave={handleEarlyDismissalSave}
    onClose={() => (showEarlyDismissalModal = false)}
  />
{/if}
