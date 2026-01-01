import { test, expect } from '@playwright/test';
import { signInAsMonitor } from '../helpers/test-setup';
import { populatedTracker } from '../fixtures/populated-tracker';

test.describe('Modal Accessibility', () => {
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
		if (box) {
			// Click near top-left corner of dialog (backdrop area)
			await page.mouse.click(box.x + 10, box.y + 10);
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
		if (box) {
			// Click near top-left corner of dialog (backdrop area)
			await page.mouse.click(box.x + 10, box.y + 10);
		}

		// Verify modal is closed
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});

	test('CoverModal traps focus within the dialog', async ({ page }) => {
		await signInAsMonitor(page, {
			email: 'monitor@lincoln.edu',
			name: 'Bus Monitor',
			sheetData: populatedTracker,
			view: 'monitor'
		});

		// Open cover modal
		await page.getByTestId('bus-17').getByRole('button', { name: /cover/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		// Tab through all focusable elements multiple times
		// Focus should stay within the dialog (native <dialog> with showModal() provides this)
		for (let i = 0; i < 20; i++) {
			await page.keyboard.press('Tab');

			// Verify focus is still within the dialog
			const focusedWithinDialog = await page.evaluate(() => {
				const dialog = document.querySelector('dialog');
				const activeElement = document.activeElement;
				return dialog?.contains(activeElement) ?? false;
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
