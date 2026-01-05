import { test, expect } from '@playwright/test';
import { signInAsAdmin } from '../helpers/test-setup';
import { populatedTracker, trackerWithHistory, trackerWithExtendedHistory } from '../fixtures/populated-tracker';

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

		// Should show loading state
		await expect(page.getByText(/calculating/i)).toBeVisible();

		// Should show report after generation
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });
	});

	test('admin can view statistics for uncovered buses', async ({ page }) => {
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

		// From fixture: Bus 3 was uncovered on 2024-01-10, Bus 5 on 2024-01-16
		const uncoveredSection = page.getByRole('heading', { name: /uncovered incidents/i }).locator('..');
		await expect(uncoveredSection.getByText('Bus 3')).toBeVisible();
		await expect(uncoveredSection.getByText('Bus 5')).toBeVisible();
	});

	test('admin can view average and max arrival delays', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();

		// Generate report
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// Should show per-bus performance table with delay info
		await expect(page.getByText(/per-bus.*performance/i)).toBeVisible();
		await expect(page.getByText(/avg.*delay/i)).toBeVisible();
		await expect(page.getByText(/max.*delay/i)).toBeVisible();

		// Should show some delay numbers
		await expect(page.locator('text=/\\d+\\s*min/i').first()).toBeVisible();
	});

	test('admin sees summary cards with statistics', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// Should show summary cards
		await expect(page.getByText(/total.*days/i)).toBeVisible();
		await expect(page.getByText(/on-time.*rate/i)).toBeVisible();

		// From fixture: 10 historical days + today's sheet auto-created
		const totalDaysCard = page.getByText('Total Days').locator('..');
		await expect(totalDaysCard).toContainText('11');
	});

	test('admin sees charts after generating statistics', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// Should have rendered at least 2 charts (daily trend + on-time pie)
		await expect(page.locator('canvas')).toHaveCount(3);
	});

	test('admin can view coverage summary', async ({ page }) => {
		await signInAsAdmin(page, {
			email: 'admin@lincoln.edu',
			name: 'School Admin',
			sheetData: trackerWithExtendedHistory,
			view: 'admin'
		});

		await page.locator('nav').getByRole('button', { name: /statistics/i }).click();
		await page.getByRole('button', { name: /recalculate/i }).click();
		await expect(page.getByText(/last generated:/i)).toBeVisible({ timeout: 10000 });

		// Should show coverage summary section
		await expect(page.getByText(/coverage.*summary/i)).toBeVisible();

		// From fixture: Bus 1 covers Bus 2 and Bus 3
		await expect(page.getByText(/Bus 1 covered Bus 2/i)).toBeVisible();
		await expect(page.getByText(/Bus 1 covered Bus 3/i)).toBeVisible();
	});
});
