<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import SignIn from '$lib/components/SignIn.svelte';
	import TeacherView from '$lib/components/TeacherView.svelte';
	import MonitorView from '$lib/components/MonitorView.svelte';
	import AdminView from '$lib/components/AdminView.svelte';
	import {
		initializeAuth,
		getAuthState,
		signOut,
		getAccessToken,
		requestAccessToken
	} from '$lib/state/auth.svelte';
	import { createSpreadsheet } from '$lib/services/sheets-api';
	import { resetBusState } from '$lib/state/buses.svelte';

	// TODO: Replace with your Google OAuth Client ID
	const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

	// Get URL parameters
	let sheetId = $derived($page.url.searchParams.get('sheet'));

	// Get auth state
	const auth = getAuthState();

	// Role selection (stored in localStorage)
	let selectedRole = $state<string | null>(null);

	// Setup state
	let isCreatingTracker = $state(false);
	let createError = $state<string | null>(null);
	let createdSheetId = $state<string | null>(null);
	let enteredSheetId = $state('');

	onMount(() => {
		initializeAuth(GOOGLE_CLIENT_ID);

		// Load saved role from localStorage
		const savedRole = localStorage.getItem('busTracker:role');
		if (savedRole) {
			selectedRole = savedRole;
		}
	});

	function selectRole(role: string) {
		selectedRole = role;
		localStorage.setItem('busTracker:role', role);
	}

	function handleSignOut() {
		signOut();
		resetBusState();
		selectedRole = null;
		localStorage.removeItem('busTracker:role');
	}

	async function handleCreateTracker() {
		// If we don't have an access token yet, request one
		if (!getAccessToken()) {
			createError = null;
			isCreatingTracker = true;

			// Request access token - this will open a popup
			requestAccessToken();

			// Wait for the token to be available (poll for up to 30 seconds)
			const startTime = Date.now();
			const checkToken = async () => {
				while (!getAccessToken() && Date.now() - startTime < 30000) {
					await new Promise(resolve => setTimeout(resolve, 500));
				}

				if (!getAccessToken()) {
					createError = 'Authorization was not completed. Please try again.';
					isCreatingTracker = false;
					return;
				}

				// Now create the tracker
				await doCreateTracker();
			};

			checkToken();
			return;
		}

		await doCreateTracker();
	}

	async function doCreateTracker() {
		isCreatingTracker = true;
		createError = null;

		try {
			const newSheetId = await createSpreadsheet('Bus Tracker', auth.user?.email);
			createdSheetId = newSheetId;
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Failed to create tracker';
		} finally {
			isCreatingTracker = false;
		}
	}

	function handleGoToSheet() {
		const id = createdSheetId || enteredSheetId.trim();
		if (id) {
			goto(`/?sheet=${id}`);
		}
	}

	let shareableUrl = $derived(
		createdSheetId ? `${$page.url.origin}/?sheet=${createdSheetId}` : null
	);
</script>

<div class="flex min-h-screen flex-col bg-stone-50">
	<!-- Header - hidden on mobile when in main app view -->
	<header class="bg-bus-400 shadow-sm {auth.user && selectedRole && sheetId ? 'hidden sm:block' : ''}">
		<div class="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<h1 class="flex items-center gap-2 text-2xl font-bold text-stone-900">
					<span class="flex h-8 w-10 items-center justify-center rounded bg-stone-900 text-base">🚌</span>
					BUSted
				</h1>

				{#if auth.user}
					<div class="flex items-center gap-4">
						<div class="text-right hidden sm:block">
							<p class="text-sm font-medium text-stone-900">{auth.user.name}</p>
							<p class="text-xs text-stone-700">{auth.user.email}</p>
						</div>
						{#if auth.user.picture}
							<img
								src={auth.user.picture}
								alt={auth.user.name}
								class="h-10 w-10 rounded-full ring-2 ring-stone-900"
							/>
						{/if}
						<button
							type="button"
							onclick={handleSignOut}
							class="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-bus-400 hover:bg-stone-800"
						>
							Sign out
						</button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 {auth.user && selectedRole && sheetId ? 'sm:mx-auto sm:w-full sm:max-w-5xl sm:px-6 sm:py-8 lg:px-8' : 'mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8'}">
		{#if auth.isLoading}
			<!-- Loading state -->
			<div class="flex items-center justify-center py-12">
				<div class="text-center">
					<div
						class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-bus-600 border-t-transparent"
					></div>
					<p class="mt-4 text-stone-600">Loading...</p>
				</div>
			</div>
		{:else if !auth.user}
			<!-- Sign in view -->
			<div class="mx-auto max-w-md rounded-lg bg-white p-8 shadow-md border border-stone-200">
				<div class="text-center">
					<h2 class="mb-2 text-xl font-semibold text-stone-900">Welcome to BUSted</h2>
					<p class="mb-6 text-stone-600">
						Sign in with your school Google account to continue.
					</p>
					<SignIn />
				</div>
			</div>
		{:else if !selectedRole}
			<!-- Role selection -->
			<div class="mx-auto max-w-md rounded-lg bg-white p-8 shadow-md border border-stone-200">
				<h2 class="mb-6 text-center text-xl font-semibold text-stone-900">Select Your Role</h2>
				<div class="space-y-3">
					<button
						onclick={() => selectRole('teacher')}
						class="block w-full rounded-lg border-2 border-stone-200 bg-white p-4 text-left hover:border-bus-400 hover:bg-bus-50"
					>
						<h3 class="font-medium text-stone-900">Teacher</h3>
						<p class="text-sm text-stone-600">View bus arrival status</p>
					</button>
					<button
						onclick={() => selectRole('monitor')}
						class="block w-full rounded-lg border-2 border-stone-200 bg-white p-4 text-left hover:border-bus-400 hover:bg-bus-50"
					>
						<h3 class="font-medium text-stone-900">Bus Monitor</h3>
						<p class="text-sm text-stone-600">Mark buses as arrived/departed</p>
					</button>
					<button
						onclick={() => selectRole('admin')}
						class="block w-full rounded-lg border-2 border-stone-200 bg-white p-4 text-left hover:border-bus-400 hover:bg-bus-50"
					>
						<h3 class="font-medium text-stone-900">Administrator</h3>
						<p class="text-sm text-stone-600">Manage buses and view statistics</p>
					</button>
				</div>
			</div>
		{:else if !sheetId}
			<!-- No sheet selected - show setup or join options -->
			<div class="mx-auto max-w-md rounded-lg bg-white p-8 shadow-md border border-stone-200">
				<h2 class="mb-6 text-center text-xl font-semibold text-stone-900">Get Started</h2>

				{#if createError}
					<div class="mb-4 rounded-lg bg-red-50 p-3 text-red-700 text-sm">
						{createError}
					</div>
				{/if}

				{#if createdSheetId}
					<!-- Tracker created successfully -->
					<div class="space-y-4">
						<div class="rounded-lg bg-green-50 p-4 text-green-700">
							<p class="font-medium">Tracker created!</p>
							<p class="mt-1 text-sm">Share this URL with your staff:</p>
						</div>
						<div class="rounded-lg border border-stone-300 bg-stone-100 p-3">
							<input
								type="text"
								readonly
								value={shareableUrl}
								data-testid="shareable-url"
								class="w-full bg-transparent text-sm text-stone-700"
								onclick={(e) => (e.target as HTMLInputElement).select()}
							/>
						</div>
						<button
							onclick={handleGoToSheet}
							class="block w-full rounded-lg bg-stone-900 px-4 py-3 text-center font-medium text-bus-400 hover:bg-stone-800"
						>
							Open Tracker
						</button>
					</div>
				{:else if selectedRole === 'admin'}
					<div class="space-y-4">
						<button
							onclick={handleCreateTracker}
							disabled={isCreatingTracker}
							class="block w-full rounded-lg bg-stone-900 px-4 py-3 text-center font-medium text-bus-400 hover:bg-stone-800 disabled:bg-stone-400"
						>
							{isCreatingTracker ? 'Creating...' : 'Create New Tracker'}
						</button>
						<div class="relative">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-stone-300"></div>
							</div>
							<div class="relative flex justify-center text-sm">
								<span class="bg-white px-2 text-stone-500">or</span>
							</div>
						</div>
						<div>
							<label for="sheet-id" class="block text-sm font-medium text-stone-700">
								Enter Sheet ID
							</label>
							<input
								type="text"
								id="sheet-id"
								bind:value={enteredSheetId}
								class="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 shadow-sm focus:border-bus-500 focus:ring-bus-500"
								placeholder="Paste Google Sheet ID"
							/>
							<button
								onclick={handleGoToSheet}
								disabled={!enteredSheetId.trim()}
								class="mt-2 w-full rounded-lg bg-bus-700 px-4 py-2 text-white hover:bg-bus-800 disabled:bg-bus-300"
							>
								Open Existing Tracker
							</button>
						</div>
					</div>
				{:else}
					<div class="text-center text-stone-600">
						<p class="mb-4">
							Ask your administrator for the BUSted URL for your school.
						</p>
						<p class="text-sm">
							The URL will look like:<br />
							<code class="text-xs text-stone-500">
								{$page.url.origin}/?sheet=YOUR_SHEET_ID
							</code>
						</p>
					</div>
				{/if}

				<button
					onclick={() => {
						selectedRole = null;
						createdSheetId = null;
						createError = null;
					}}
					class="mt-6 w-full text-center text-sm text-bus-700 hover:text-bus-900"
				>
					← Change role
				</button>
			</div>
		{:else}
			<!-- Main app view based on role -->
			<!-- Desktop: card layout. Mobile: full width -->
			<div class="bg-white sm:rounded-lg sm:p-6 sm:shadow-md sm:border sm:border-stone-200">
				<!-- Desktop header -->
				<div class="mb-4 hidden items-center justify-between sm:flex">
					<h2 class="text-lg font-semibold text-stone-900">
						{#if selectedRole === 'teacher'}
							Bus Status Board
						{:else if selectedRole === 'monitor'}
							Bus Monitor
						{:else if selectedRole === 'admin'}
							Administration
						{/if}
					</h2>
					<div class="flex items-center gap-2">
						<span class="rounded-full bg-bus-100 px-3 py-1 text-sm text-bus-700">
							{selectedRole}
						</span>
						<button
							type="button"
							onclick={() => (selectedRole = null)}
							class="text-sm text-stone-500 hover:text-stone-700"
						>
							Change
						</button>
					</div>
				</div>

				{#if selectedRole === 'teacher'}
					<TeacherView sheetId={sheetId} />
				{:else if selectedRole === 'monitor'}
					<MonitorView sheetId={sheetId} />
				{:else if selectedRole === 'admin'}
					<AdminView sheetId={sheetId} />
				{/if}
			</div>
		{/if}
	</main>

	<!-- Mobile footer - only shown in main app view -->
	{#if auth.user && selectedRole && sheetId}
		<footer class="border-t border-stone-200 bg-white px-4 py-3 shadow-inner sm:hidden">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					{#if auth.user.picture}
						<img
							src={auth.user.picture}
							alt={auth.user.name}
							class="h-8 w-8 rounded-full ring-2 ring-bus-400"
						/>
					{/if}
					<span class="text-sm text-stone-700">{auth.user.name.split(' ')[0]}</span>
				</div>
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => (selectedRole = null)}
						class="rounded-md bg-bus-100 px-3 py-1.5 text-xs font-medium text-bus-700"
					>
						{selectedRole}
					</button>
					<button
						type="button"
						onclick={handleSignOut}
						class="text-xs text-stone-500"
					>
						Sign out
					</button>
				</div>
			</div>
		</footer>
	{/if}
</div>
