import { test, expect } from '@playwright/test';
import { mockGoogleAuth, mockGoogleAuthLoggedOut } from '../mocks/google-auth';
import { mockSheetsApi } from '../mocks/sheets-api';
import { signInAsMonitor, useSessionClock } from '../helpers/test-setup';
import { populatedTracker } from '../fixtures/populated-tracker';

test.describe('Authentication', () => {
	test('shows sign in with Google button when not logged in', async ({ page }) => {
		await mockGoogleAuthLoggedOut(page);
		await page.goto('/');

		// Should show sign in button
		const signInButton = page.getByTestId('google-signin-button');
		await expect(signInButton).toBeVisible();
		await expect(signInButton).toHaveText('Sign in with Google');
	});

	test('user can log in using school Google account', async ({ page }) => {
		await mockGoogleAuth(page, {
			email: 'teacher@lincoln.edu',
			name: 'Jane Teacher'
		});
		await page.goto('/');

		// Click sign in
		await page.getByTestId('google-signin-button').click();

		// Should show role selection after login
		await expect(page.getByText(/select your role/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
	});

	test('user can bookmark the bus app URL for their specific school', async ({ page }) => {
		await mockGoogleAuth(page);
		await page.goto('/?sheet=abc123');

		// The URL should contain the sheet ID for bookmarking
		expect(page.url()).toContain('sheet=abc123');

		// Page should load without redirecting away from the sheet param
		await page.getByTestId('google-signin-button').click();
		expect(page.url()).toContain('sheet=abc123');
	});
});

test.describe('Silent reauthorization', () => {
	test('signed-in user is authorized silently without an Authorize button', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Buses load without the user ever clicking "Authorize Access"
		await expect(page.getByTestId('bus-1')).toBeVisible();
		await expect(page.getByRole('button', { name: /authorize access/i })).toHaveCount(0);
	});

	test('returning user with an expired token is reauthorized silently on load', async ({
		page
	}) => {
		// Regression test for the daily re-auth bug: monitors open the app the
		// next morning with a stale token and should NOT see any auth prompt.
		await useSessionClock(page, 'PM');
		await mockGoogleAuth(page, { email: 'monitor@lincoln.edu', name: 'Bus Monitor' });
		await mockSheetsApi(page, populatedTracker);

		// Simulate yesterday's session leftovers: signed-in user, expired token
		await page.addInitScript(() => {
			localStorage.setItem(
				'busTracker:user',
				JSON.stringify({ email: 'monitor@lincoln.edu', name: 'Bus Monitor' })
			);
			localStorage.setItem('busTracker:role', 'monitor');
			localStorage.setItem('busTracker:accessToken', 'stale_expired_token');
			localStorage.setItem('busTracker:tokenExpiry', '1');
		});

		await page.goto(`/?sheet=${populatedTracker.spreadsheetId}`);

		// Buses load with no sign-in click and no Authorize button
		await expect(page.getByTestId('bus-1')).toBeVisible();
		await expect(page.getByRole('button', { name: /authorize access/i })).toHaveCount(0);
	});

	test('falls back to an Authorize button when silent auth fails', async ({ page }) => {
		await useSessionClock(page, 'PM');
		await mockGoogleAuth(
			page,
			{ email: 'monitor@lincoln.edu', name: 'Bus Monitor' },
			{ silentAuthFails: true }
		);
		await mockSheetsApi(page, populatedTracker);

		await page.goto(`/?sheet=${populatedTracker.spreadsheetId}&view=monitor`);
		await page.getByTestId('google-signin-button').click();
		await page.getByRole('button', { name: /bus monitor/i }).click();

		// Silent attempt fails, so the interactive fallback is offered
		const authorizeButton = page.getByRole('button', { name: /authorize access/i });
		await expect(authorizeButton).toBeVisible();

		// Interactive authorization succeeds and the app loads
		await authorizeButton.click();
		await expect(page.getByTestId('bus-1')).toBeVisible();
	});

	test('a 401 from the Sheets API is retried after a silent token refresh', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor',
			sheetsOptions: { failFirstRequestWith401: true }
		});

		// The first API call 401s; the app refreshes the token silently and
		// retries, so buses still load with no visible error
		await expect(page.getByTestId('bus-1')).toBeVisible();
		await expect(page.getByText(/error loading buses/i)).toHaveCount(0);
	});
});
