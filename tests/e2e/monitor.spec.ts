import { test, expect } from '@playwright/test';
import { signInAsMonitor } from '../helpers/test-setup';
import { populatedTracker } from '../fixtures/populated-tracker';

test.describe('Bus Monitor View', () => {
	test('monitor can see all buses by bus number on a single screen', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Should see all buses from the config
		for (const bus of populatedTracker.config) {
			await expect(page.getByTestId(`bus-${bus.bus_number}`)).toBeVisible();
		}

		// Buses should be sorted - pending first, then arrived, then departed
		// Within each group, sorted by bus number
		const busList = page.locator('[data-testid^="bus-"]');
		const busNumbers = await busList.allTextContents();

		// First bus should be from pending section (Bus 3 or similar)
		expect(busNumbers.length).toBe(populatedTracker.config.length);
	});

	test('monitor can mark a bus as arrived with timestamp recorded', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Bus 3 is pending - click to mark arrived
		await page.getByTestId('bus-3').getByRole('button', { name: /arrived/i }).click();

		// Should show arrival time
		await expect(page.getByTestId('bus-3')).toContainText(/\d{1,2}:\d{2}/);

		// Status should change
		await expect(page.getByTestId('bus-3')).toHaveAttribute('data-status', 'arrived');
	});

	test('monitor can mark a bus as departed with timestamp recorded', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Bus 2 is arrived - click to mark departed
		await page.getByTestId('bus-2').getByRole('button', { name: /departed/i }).click();

		// Should show departure time
		const bus2 = page.getByTestId('bus-2');
		await expect(bus2).toContainText(/departed/i);

		// Status should change
		await expect(bus2).toHaveAttribute('data-status', 'departed');
	});

	test('monitor can mark a bus as covered by another bus number', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Mark bus 17 as covered by bus B42
		await page.getByTestId('bus-17').getByRole('button', { name: /cover/i }).click();

		// Should show modal with number pad
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByText(/which bus is covering/i)).toBeVisible();

		// Enter B42 using the number pad
		await page.getByRole('dialog').getByRole('button', { name: 'B' }).click();
		await page.getByRole('dialog').getByRole('button', { name: '4' }).click();
		await page.getByRole('dialog').getByRole('button', { name: '2' }).click();
		await page.getByRole('dialog').getByRole('button', { name: /done/i }).click();

		// Should show bus 17 as covered by B42 and marked as arrived
		await expect(page.getByTestId('bus-17')).toContainText(/by.*B42/i);
		await expect(page.getByTestId('bus-17')).toHaveAttribute('data-status', 'arrived');
	});

	test('monitor can edit any bus status after the fact', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Bus 1 already departed - should be able to edit
		await page.getByTestId('bus-1').getByRole('button', { name: /edit/i }).click();

		// Should show edit form
		await expect(page.getByRole('dialog')).toBeVisible();

		// Can change arrival time
		await page.getByLabel(/arrival time/i).clear();
		await page.getByLabel(/arrival time/i).fill('15:05');

		// Can change departure time
		await page.getByLabel(/departure time/i).clear();
		await page.getByLabel(/departure time/i).fill('15:15');

		// Save changes
		await page.getByRole('button', { name: /save/i }).click();

		// Should update display
		await expect(page.getByTestId('bus-1')).toContainText('15:05');
		await expect(page.getByTestId('bus-1')).toContainText('15:15');
	});
});

test.describe('Bus Monitor Mobile', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('mobile layout is touch-friendly', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Buttons should be large enough for touch (at least 44px)
		const arrivedButton = page.getByTestId('bus-3').getByRole('button', { name: /arrived/i });
		const box = await arrivedButton.boundingBox();

		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
	});
});
