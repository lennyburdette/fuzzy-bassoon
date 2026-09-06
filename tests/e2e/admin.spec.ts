import { test, expect } from '@playwright/test';
import { signInAsAdmin } from '../helpers/test-setup';
import {
	populatedTracker,
	trackerWithExtendedHistory,
	lowUncoveredTracker
} from '../fixtures/populated-tracker';
import { trackerWithEmptyDailySheet } from '../fixtures/empty-daily-sheet';

test.describe('Admin Management', () => {
	test('admin can mark a bus as uncovered', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: populatedTracker,
			view: 'admin'
		});

		// Open edit modal for a pending bus (Bus 17 is pending in fixture)
		await page.getByTestId('bus-17').getByRole('button', { name: /edit/i }).click();
		await page.getByRole('dialog').getByRole('button', { name: /mark as uncovered/i }).click();
		await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();

		// Should mark as uncovered
		await expect(page.getByTestId('bus-17')).toHaveAttribute('data-status', 'uncovered');
		await expect(page.getByTestId('bus-17')).toContainText(/uncovered/i);
	});

	test('admin can mark bus uncovered when session sheet has no bus rows', async ({ page }) => {
		// This tests the fix for "Bus not found" errors when:
		// - Config has buses configured
		// - Session sheet exists but was never populated with bus rows
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithEmptyDailySheet,
			view: 'admin'
		});

		// Open edit modal for B157
		await page.getByTestId('bus-B157').getByRole('button', { name: /edit/i }).click();
		await page.getByRole('dialog').getByRole('button', { name: /mark as uncovered/i }).click();
		await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();

		// Should succeed without "Bus not found" error
		await expect(page.getByTestId('bus-B157')).toHaveAttribute('data-status', 'uncovered');
	});

	test('admin sees no report message when no statistics generated', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: populatedTracker, // No statisticsData
			view: 'admin'
		});

		// Navigate to statistics
		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();

		// Should show "no report" state with recalculate button
		await expect(page.getByText(/no statistics report has been generated/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /recalculate/i })).toBeVisible();
	});

	test('admin can generate statistics report', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();
		await page.getByRole('button', { name: /recalculate/i }).click();

		// Should show report after generation
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });
	});

	test('admin sees the uncovered rate flagged when it exceeds the district average', async ({
		page
	}) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// Fixture: 60 historical runs + 5 in today's auto-created sheet,
		// 3 uncovered => 4.6%
		await expect(page.getByTestId('uncovered-rate')).toHaveText('4.6%');
		await expect(page.getByTestId('district-verdict')).toContainText(
			/above the district average of 1\.6%/i
		);
	});

	test('admin sees the uncovered rate cleared when it is below the district average', async ({
		page
	}) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: lowUncoveredTracker,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// Fixture: 120 historical runs + 5 in today's auto-created sheet,
		// 1 uncovered => 0.8%
		await expect(page.getByTestId('uncovered-rate')).toHaveText('0.8%');
		await expect(page.getByTestId('district-verdict')).toContainText(
			/at or below the district average of 1\.6%/i
		);
	});

	test('admin can view uncovered incidents with their session', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		// Navigate to statistics
		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();

		// Generate report first
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// Should show uncovered incidents section
		await expect(page.getByRole('heading', { name: /uncovered incidents/i })).toBeVisible();

		// From fixture: Bus 3 (2024-01-10 PM), Bus 5 (2024-01-16 PM), Bus 2 (2024-01-17 AM)
		const uncoveredSection = page.getByRole('heading', { name: /uncovered incidents/i }).locator('..');
		await expect(uncoveredSection.getByText('Bus 3')).toBeVisible();
		await expect(uncoveredSection.getByText('2024-01-10 PM')).toBeVisible();
		await expect(uncoveredSection.getByText('Bus 5')).toBeVisible();
		await expect(uncoveredSection.getByText('Bus 2')).toBeVisible();
		await expect(uncoveredSection.getByText('2024-01-17 AM')).toBeVisible();
	});

	test('admin sees the uncovered-rate trend chart', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// The report has a single chart: uncovered rate over time vs district average
		await expect(page.locator('canvas')).toHaveCount(1);
	});
});
