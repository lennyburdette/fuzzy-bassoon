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

	test('admin can add early dismissal for a specific date', async ({ page }) => {
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

		// Click Add Early Dismissal button
		await page.getByRole('button', { name: /add early dismissal/i }).click();

		// Modal should open
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByText('Add Early Dismissal')).toBeVisible();

		// Fill in date and time
		await page.getByLabel(/date/i).fill('2025-02-15');
		await page.getByLabel(/new arrival time/i).fill('14:00');

		// All buses should be selected by default
		await expect(page.getByText(/2 of 2/)).toBeVisible();

		// Click Add Early Dismissal in the modal
		await page.getByRole('button', { name: /add early dismissal/i }).last().click();

		// Modal should close
		await expect(page.getByRole('dialog')).not.toBeVisible();

		// Should show scheduled override
		await expect(page.getByText(/scheduled overrides/i)).toBeVisible();
		await expect(page.getByText(/Feb 15/)).toBeVisible();
		await expect(page.getByText(/2 bus\(es\) affected/)).toBeVisible();
	});

	test('admin can select specific buses for early dismissal', async ({ page }) => {
		const sheetData = {
			...newSchoolSetup,
			config: [
				{ bus_number: '1', expected_arrival_time: '15:00' },
				{ bus_number: '2', expected_arrival_time: '15:05' },
				{ bus_number: '3', expected_arrival_time: '15:10' }
			]
		};
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData,
			view: 'admin'
		});

		await page.getByRole('button', { name: /add early dismissal/i }).click();

		// All buses should be selected by default
		await expect(page.getByText(/3 of 3/)).toBeVisible();

		// Click None to deselect all
		await page.getByRole('button', { name: /none/i }).click();
		await expect(page.getByText(/0 of 3/)).toBeVisible();

		// Select only bus 1
		await page.getByLabel(/Bus 1/).click();
		await expect(page.getByText(/1 of 3/)).toBeVisible();

		// Fill in date and time
		await page.getByLabel(/date/i).fill('2025-03-01');
		await page.getByLabel(/new arrival time/i).fill('13:30');

		// Save
		await page.getByRole('button', { name: /add early dismissal/i }).last().click();

		// Should show 1 bus affected
		await expect(page.getByText(/1 bus\(es\) affected/)).toBeVisible();
	});

	test('admin can remove an early dismissal override', async ({ page }) => {
		const sheetData = {
			...newSchoolSetup,
			config: [
				{
					bus_number: '1',
					expected_arrival_time: '15:00',
					early_dismissal_overrides: { '2025-02-15': '14:00' }
				},
				{
					bus_number: '2',
					expected_arrival_time: '15:05',
					early_dismissal_overrides: { '2025-02-15': '14:00' }
				}
			]
		};
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData,
			view: 'admin'
		});

		// Should show existing override
		await expect(page.getByText(/Feb 15/)).toBeVisible();

		// Click Remove
		await page.getByRole('button', { name: /remove/i }).click();

		// Override should be removed
		await expect(page.getByText(/Feb 15/)).not.toBeVisible();
		await expect(page.getByText(/scheduled overrides/i)).not.toBeVisible();
	});

	test('early dismissal save button is disabled without required fields', async ({ page }) => {
		const sheetData = {
			...newSchoolSetup,
			config: [{ bus_number: '1', expected_arrival_time: '15:00' }]
		};
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData,
			view: 'admin'
		});

		await page.getByRole('button', { name: /add early dismissal/i }).click();

		// Deselect all buses
		await page.getByRole('button', { name: /none/i }).click();

		// Save button should be disabled (no time entered, no buses selected)
		const saveButton = page.getByRole('dialog').getByRole('button', { name: /add early dismissal/i });
		await expect(saveButton).toBeDisabled();

		// Select a bus but still no time
		await page.getByLabel(/Bus 1/).click();
		await expect(saveButton).toBeDisabled();

		// Add time, should now be enabled
		await page.getByLabel(/new arrival time/i).fill('14:00');
		await expect(saveButton).toBeEnabled();
	});
});
