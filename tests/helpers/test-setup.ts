import { expect, type Page } from '@playwright/test';
import { mockGoogleAuth } from '../mocks/google-auth';
import { mockSheetsApi, type MockSheetData } from '../mocks/sheets-api';

type Role = 'teacher' | 'monitor' | 'admin';

interface SetupOptions {
	email?: string;
	name?: string;
	sheetData?: MockSheetData;
	view?: Role;
}

/**
 * Complete test setup: mock auth, mock sheets API, navigate, sign in, select role
 */
export async function setupAuthenticatedUser(
	page: Page,
	role: Role,
	options: SetupOptions = {}
) {
	const { email, name, sheetData, view } = options;

	// Setup mocks
	await mockGoogleAuth(page, {
		email: email ?? `${role}@school.edu`,
		name: name ?? `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`
	});

	if (sheetData) {
		await mockSheetsApi(page, sheetData);
	}

	// Navigate
	const url = sheetData
		? `/?sheet=${sheetData.spreadsheetId}${view ? `&view=${view}` : ''}`
		: '/';
	await page.goto(url);

	// Sign in
	await page.getByTestId('google-signin-button').click();

	// Select role
	const roleButtonName = {
		teacher: /teacher/i,
		monitor: /bus monitor/i,
		admin: /administrator/i
	}[role];
	await page.getByRole('button', { name: roleButtonName }).click();

	const authorizeButton = page.getByRole('button', { name: /authorize access/i });
	if (await authorizeButton.count()) {
		await authorizeButton.click();
		await expect(authorizeButton).toBeHidden({ timeout: 10000 });
	}
}

// Convenience functions
export const signInAsAdmin = (page: Page, options?: SetupOptions) =>
	setupAuthenticatedUser(page, 'admin', options);

export const signInAsTeacher = (page: Page, options?: SetupOptions) =>
	setupAuthenticatedUser(page, 'teacher', options);

export const signInAsMonitor = (page: Page, options?: SetupOptions) =>
	setupAuthenticatedUser(page, 'monitor', options);
