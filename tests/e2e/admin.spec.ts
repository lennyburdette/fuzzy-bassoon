import { test, expect } from '@playwright/test';
import { signInAsAdmin } from '../helpers/test-setup';
import { populatedTracker, trackerWithHistory } from '../fixtures/populated-tracker';

test.describe('Admin Management', () => {
	test('admin can mark a bus as uncovered', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: populatedTracker,
			view: 'admin'
		});

		// Find a pending bus (Bus 17 is pending in fixture)
		await page.getByTestId('bus-17').getByRole('button', { name: /uncovered|no.?show/i }).click();

		// Should mark as uncovered
		await expect(page.getByTestId('bus-17')).toHaveAttribute('data-status', 'uncovered');
		await expect(page.getByTestId('bus-17')).toContainText(/uncovered/i);
	});

	test('admin can view statistics for uncovered buses', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithHistory,
			view: 'admin'
		});

		// Navigate to statistics
		await page.getByRole('button', { name: /statistics|stats/i }).click();

		// Should show uncovered bus stats
		await expect(page.getByText(/uncovered/i)).toBeVisible();

		// From fixture: Bus 3 was uncovered on 2024-01-10
		await expect(page.getByText(/Bus 3/i)).toBeVisible();
	});

	test('admin can view average and max arrival delays', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithHistory,
			view: 'admin'
		});

		await page.getByRole('button', { name: /statistics|stats/i }).click();

		// Should show delay statistics
		await expect(page.getByText(/average.*delay/i)).toBeVisible();
		await expect(page.getByText(/max.*delay/i)).toBeVisible();

		// From fixture data:
		// Bus 1 expected 15:00, arrivals: 15:05 (+5), 15:02 (+2), 15:00 (0) = avg 2.33 min
		// Bus 2 expected 15:05, arrivals: 15:10 (+5), 15:03 (-2), covered = avg 1.5 min (or just +5 if we don't count early)
		// Should show some delay numbers
		await expect(page.locator('text=/\\d+\\s*(min|minutes)/i')).toBeVisible();
	});

	test('admin can select custom date ranges for statistics', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithHistory,
			view: 'admin'
		});

		await page.getByRole('button', { name: /statistics|stats/i }).click();

		// Should have date range picker
		const startDate = page.getByLabel(/start.*date|from/i);
		const endDate = page.getByLabel(/end.*date|to/i);

		await expect(startDate).toBeVisible();
		await expect(endDate).toBeVisible();

		// Set custom range
		await startDate.fill('2024-01-10');
		await endDate.fill('2024-01-11');

		await page.getByRole('button', { name: /apply|filter/i }).click();

		// Stats should update based on filtered range
		// Only data from 2024-01-10 and 2024-01-11 should be included
		await expect(page.getByText(/2024-01-10.*2024-01-11|jan 10.*jan 11/i)).toBeVisible();
	});
});
