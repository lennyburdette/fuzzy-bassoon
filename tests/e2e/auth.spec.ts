import { test, expect } from '@playwright/test';
import { mockGoogleAuth, mockGoogleAuthLoggedOut } from '../mocks/google-auth';

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

		// Should show user is logged in
		await expect(page.getByText('Jane Teacher')).toBeVisible();
		await expect(page.getByText('teacher@lincoln.edu')).toBeVisible();
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
