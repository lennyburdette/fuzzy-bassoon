<script lang="ts">
  import type { BusWithStatus } from "$lib/state/buses.svelte";
  import StatusBadge from "./StatusBadge.svelte";

  interface Props {
    bus: BusWithStatus;
    onArrived?: (busNumber: string) => void;
    onDeparted?: (busNumber: string) => void;
    onCover?: (busNumber: string) => void;
    onUncovered?: (busNumber: string) => void;
    onEdit?: (busNumber: string) => void;
  }

  let {
    bus,
    onArrived,
    onDeparted,
    onCover,
    onUncovered,
    onEdit,
  }: Props = $props();

  // Actions are pre-computed in bus.actions based on view mode
</script>

<div
  class="rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
  data-testid="bus-{bus.bus_number}"
  data-status={bus.derivedStatus}
>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="text-2xl font-bold text-gray-900">{bus.bus_number}</span>
      <StatusBadge status={bus.derivedStatus} />
    </div>

    {#if bus.actions.canEdit && onEdit}
      <button
        type="button"
        onclick={() => onEdit(bus.bus_number)}
        class="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200"
      >
        Edit
      </button>
    {/if}
  </div>

  {#if bus.covered_by}
    <p class="mt-2 text-sm text-yellow-700">
      Covered by Bus {bus.covered_by}
    </p>
  {/if}

  {#if bus.is_uncovered}
    <p class="mt-2 text-sm font-medium text-red-600">No-show / Uncovered</p>
  {/if}

  <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
    <span>Expected: {bus.expected_arrival_time}</span>
    {#if bus.arrival_time}
      <span class="text-green-600">Arrived: {bus.arrival_time}</span>
    {/if}
    {#if bus.departure_time}
      <span class="text-blue-600">Departed: {bus.departure_time}</span>
    {/if}
  </div>

  <!-- Action buttons - only show if any action is available -->
  {#if bus.actions.canMarkArrived || bus.actions.canMarkDeparted || bus.actions.canMarkCovered || bus.actions.canMarkUncovered}
    <div class="mt-4 flex flex-wrap gap-2">
      {#if bus.actions.canMarkArrived && onArrived}
        <button
          type="button"
          onclick={() => onArrived(bus.bus_number)}
          class="min-h-[44px] min-w-[44px] rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 active:bg-green-800"
        >
          Arrived
        </button>
      {/if}

      {#if bus.actions.canMarkDeparted && onDeparted}
        <button
          type="button"
          onclick={() => onDeparted(bus.bus_number)}
          class="min-h-[44px] min-w-[44px] rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 active:bg-blue-800"
        >
          Departed
        </button>
      {/if}

      {#if bus.actions.canMarkCovered && onCover}
        <button
          type="button"
          onclick={() => onCover(bus.bus_number)}
          class="min-h-[44px] min-w-[44px] rounded-lg bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600 active:bg-yellow-700"
        >
          Cover
        </button>
      {/if}

      {#if bus.actions.canMarkUncovered && onUncovered}
        <button
          type="button"
          onclick={() => onUncovered(bus.bus_number)}
          class="min-h-[44px] min-w-[44px] rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 active:bg-red-800"
        >
          Uncovered
        </button>
      {/if}
    </div>
  {/if}
</div>
