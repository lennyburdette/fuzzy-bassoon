import { test, expect } from '@playwright/test';
import { signInAsTeacher } from '../helpers/test-setup';
import { getTodayEastern } from '../helpers/time';
import { mockGoogleAuth } from '../mocks/google-auth';
import { mockSheetsApi } from '../mocks/sheets-api';
import { populatedTracker } from '../fixtures/populated-tracker';

test.describe('Teacher View', () => {
	test('teacher can see buses grouped by status: pending, arrived, departed', async ({
		page
	}) => {
		await signInAsTeacher(page, {
			email: 'teacher@lincoln.edu',
			name: 'Jane Teacher',
			sheetData: populatedTracker,
			view: 'teacher'
		});

		// Bus 1 should be in departed (has both arrival and departure time)
		const departedSection = page.locator('[data-testid="done-section"]');
		await expect(departedSection.getByTestId('bus-1')).toBeVisible();

		// Bus 2 should be in arrived/here (has arrival but no departure)
		const arrivedSection = page.locator('[data-testid="arrived-section"]');
		await expect(arrivedSection.getByTestId('bus-2')).toBeVisible();

		// Bus 3 should be in pending (no arrival time, not covered, not uncovered)
		const pendingSection = page.locator('[data-testid="pending-section"]');
		await expect(pendingSection.getByTestId('bus-3')).toBeVisible();
	});

	test('teacher can see covered/uncovered buses clearly indicated', async ({ page }) => {
		await signInAsTeacher(page, {
			email: 'teacher@lincoln.edu',
			name: 'Jane Teacher',
			sheetData: populatedTracker,
			view: 'teacher'
		});

		// Bus 4 is covered by 17 - covered is orthogonal to status, so it shows as arrived
		const coveredBus = page.locator('[data-testid="bus-4"]');
		await expect(coveredBus).toHaveAttribute('data-status', 'arrived');
		// Should also show covering bus number
		await expect(coveredBus).toContainText('17');

		// Bus 5 is uncovered - should show special styling
		const uncoveredBus = page.locator('[data-testid="bus-5"]');
		await expect(uncoveredBus).toHaveAttribute('data-status', 'uncovered');
	});

	test('covered buses show "Bus X (covered by Bus Y)" format', async ({ page }) => {
		await signInAsTeacher(page, {
			email: 'teacher@lincoln.edu',
			name: 'Jane Teacher',
			sheetData: populatedTracker,
			view: 'teacher'
		});

		// Bus 4 is covered by 17
		await expect(page.getByTestId('bus-4')).toContainText('17');
	});

	test('view auto-refreshes to show updated statuses', async ({ page }) => {
		// This test needs direct access to sheetData to modify it during the test
		await mockGoogleAuth(page, {
			email: 'teacher@lincoln.edu',
			name: 'Jane Teacher'
		});
		const sheetData = await mockSheetsApi(page, populatedTracker);

		await page.goto(`/?sheet=${populatedTracker.spreadsheetId}&view=teacher`);
		await page.getByTestId('google-signin-button').click();
		await page.getByRole('button', { name: /teacher/i }).click();
		const authorizeButton = page.getByRole('button', { name: /authorize access/i });
		await authorizeButton.click();
		await expect(authorizeButton).toBeHidden({ timeout: 10000 });

		// Initially Bus 3 is pending
		await expect(
			page.locator('[data-testid="pending-section"]').getByTestId('bus-3')
		).toBeVisible();

		// Simulate bus 3 arriving (modify mock data)
		const today = getTodayEastern();
		const bus3 = sheetData.dailyData[today]?.find((b) => b.bus_number === '3');
		if (bus3) {
			bus3.arrival_time = '15:12';
		}

		// Wait for auto-refresh (10 seconds polling)
		await page.waitForTimeout(11000);

		// Bus 3 should now be in arrived section
		await expect(
			page.locator('[data-testid="arrived-section"]').getByTestId('bus-3')
		).toBeVisible();
	});
});
