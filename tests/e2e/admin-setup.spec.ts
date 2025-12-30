import { test, expect } from '@playwright/test';
import { signInAsAdmin } from '../helpers/test-setup';
import { mockSheetsApi } from '../mocks/sheets-api';
import { mockGoogleAuth } from '../mocks/google-auth';
import { newSchoolSetup } from '../fixtures/empty-tracker';

test.describe('Admin Setup', () => {
	test('admin can set up a bus tracker for their school', async ({ page }) => {
		// For the "create new tracker" flow, we need mocks set up but navigate to / without sheet ID
		await mockGoogleAuth(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin'
		});
		await mockSheetsApi(page, newSchoolSetup);

		await page.goto('/');
		await page.getByTestId('google-signin-button').click();
		await page.getByRole('button', { name: /administrator/i }).click();

		// Should see option to create new tracker
		await expect(page.getByRole('button', { name: /create.*tracker/i })).toBeVisible();

		// Click to create
		await page.getByRole('button', { name: /create.*tracker/i }).click();

		// Should show success and the shareable URL
		await expect(page.getByText(/tracker created/i)).toBeVisible();
	});

	test('admin receives a shareable URL after setup', async ({ page }) => {
		// For the "create new tracker" flow, we need mocks set up but navigate to / without sheet ID
		await mockGoogleAuth(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin'
		});
		await mockSheetsApi(page, newSchoolSetup);

		await page.goto('/');
		await page.getByTestId('google-signin-button').click();
		await page.getByRole('button', { name: /administrator/i }).click();

		await page.getByRole('button', { name: /create.*tracker/i }).click();

		// Should show shareable URL containing the sheet ID
		const shareableUrl = page.getByTestId('shareable-url');
		await expect(shareableUrl).toBeVisible();
		await expect(shareableUrl).toContainText('sheet=');
	});

	test('admin can set up expected bus numbers in advance', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: newSchoolSetup,
			view: 'admin'
		});

		// Navigate to bus configuration
		await page.getByRole('button', { name: /configure buses/i }).click();

		// Add bus numbers
		await page.getByLabel(/bus number/i).fill('42');
		await page.getByRole('button', { name: /add bus/i }).click();

		// Should see bus 42 in the list
		await expect(page.getByText('Bus 42')).toBeVisible();
	});

	test('admin can set expected arrival times for all buses', async ({ page }) => {
		const sheetData = {
			...newSchoolSetup,
			config: [{ bus_number: '42', expected_arrival_time: '' }]
		};
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData,
			view: 'admin'
		});

		// Set arrival time for bus 42
		await page.getByRole('row', { name: /42/i }).getByLabel(/arrival time/i).fill('15:30');
		await page.getByRole('button', { name: /save/i }).click();

		// Should show saved confirmation
		await expect(page.getByText(/saved/i)).toBeVisible();
	});

	test('admin can change expected arrival times for early dismissal days', async ({ page }) => {
		const sheetData = {
			...newSchoolSetup,
			config: [
				{ bus_number: '1', expected_arrival_time: '15:00' },
				{ bus_number: '2', expected_arrival_time: '15:05' }
			]
		};
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData,
			view: 'admin'
		});

		// Find early dismissal option
		await page.getByRole('button', { name: /early dismissal/i }).click();

		// Should be able to adjust all times
		await page.getByLabel(/time adjustment/i).fill('-60'); // 1 hour earlier
		await page.getByRole('button', { name: /apply/i }).click();

		// Bus 1 should now show 14:00
		await expect(page.getByRole('row', { name: /1/i })).toContainText('14:00');
	});
});
