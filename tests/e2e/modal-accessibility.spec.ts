import { test, expect } from '@playwright/test';
import { signInAsMonitor } from '../helpers/test-setup';
import { populatedTracker } from '../fixtures/populated-tracker';

test.describe('Modal Accessibility', () => {
	function getBackdropClickPoint(
		dialogBox: { x: number; y: number; width: number; height: number },
		viewport: { width: number; height: number }
	) {
		const candidates = [
			{ x: 5, y: 5 },
			{ x: viewport.width - 5, y: 5 },
			{ x: 5, y: viewport.height - 5 },
			{ x: viewport.width - 5, y: viewport.height - 5 }
		];

		for (const point of candidates) {
			const insideX = point.x >= dialogBox.x && point.x <= dialogBox.x + dialogBox.width;
			const insideY = point.y >= dialogBox.y && point.y <= dialogBox.y + dialogBox.height;
			if (!insideX || !insideY) {
				return point;
			}
		}

		return { x: 5, y: 5 };
	}

	test('CoverModal closes on Escape key', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open cover modal
		await page.getByTestId('bus-17').getByRole('button', { name: /cover/i }).click();

		// Verify modal is open
		await expect(page.getByRole('dialog')).toBeVisible();

		// Press Escape
		await page.keyboard.press('Escape');

		// Verify modal is closed
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});

	test('EditBusModal closes on Escape key', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open edit modal
		await page.getByTestId('bus-1').getByRole('button', { name: /edit/i }).click();

		// Verify modal is open
		await expect(page.getByRole('dialog')).toBeVisible();

		// Press Escape
		await page.keyboard.press('Escape');

		// Verify modal is closed
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});

	test('CoverModal closes on backdrop click', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open cover modal
		await page.getByTestId('bus-17').getByRole('button', { name: /cover/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		// Click on the backdrop (dialog element itself, not content)
		const dialog = page.getByRole('dialog');
		const box = await dialog.boundingBox();
		const viewport = page.viewportSize();
		if (box && viewport) {
			const { x, y } = getBackdropClickPoint(box, viewport);
			await page.mouse.click(x, y);
		}

		// Verify modal is closed
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});

	test('EditBusModal closes on backdrop click', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open edit modal
		await page.getByTestId('bus-1').getByRole('button', { name: /edit/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		// Click on the backdrop (dialog element itself, not content)
		const dialog = page.getByRole('dialog');
		const box = await dialog.boundingBox();
		const viewport = page.viewportSize();
		if (box && viewport) {
			const { x, y } = getBackdropClickPoint(box, viewport);
			await page.mouse.click(x, y);
		}

		// Verify modal is closed
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});

	test('CoverModal keeps focus within the dialog once focused', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open cover modal
		await page.getByTestId('bus-17').getByRole('button', { name: /cover/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'B' }).focus();

		// Tab through a few focusable elements
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Tab');

			// Verify focus is still within the dialog
			const focusedWithinDialog = await page.evaluate(() => {
				const dialogElement = document.querySelector('dialog');
				const activeElement = document.activeElement;
				return dialogElement?.contains(activeElement) ?? false;
			});

			expect(focusedWithinDialog).toBe(true);
		}
	});

	test('CoverModal has proper ARIA attributes', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open cover modal
		await page.getByTestId('bus-17').getByRole('button', { name: /cover/i }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Check aria-labelledby points to a valid heading
		const labelledBy = await dialog.getAttribute('aria-labelledby');
		expect(labelledBy).toBeTruthy();

		// The heading should exist and contain relevant text
		const heading = page.locator(`#${labelledBy}`);
		await expect(heading).toContainText(/which bus is covering/i);
	});

	test('EditBusModal has proper ARIA attributes', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open edit modal
		await page.getByTestId('bus-1').getByRole('button', { name: /edit/i }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Check aria-labelledby points to a valid heading
		const labelledBy = await dialog.getAttribute('aria-labelledby');
		expect(labelledBy).toBeTruthy();

		// The heading should exist and contain relevant text
		const heading = page.locator(`#${labelledBy}`);
		await expect(heading).toContainText(/edit bus/i);
	});

	test('CoverModal backspace button has aria-label', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open cover modal and enter something to show backspace
		await page.getByTestId('bus-17').getByRole('button', { name: /cover/i }).click();
		await page.getByRole('dialog').getByRole('button', { name: '1' }).click();

		// Backspace button should be accessible
		const backspaceButton = page.getByRole('dialog').getByRole('button', { name: /backspace/i });
		await expect(backspaceButton).toBeVisible();
	});
});
