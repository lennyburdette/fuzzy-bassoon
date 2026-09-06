import { expect, type Page } from '@playwright/test';
import { mockGoogleAuth, type MockAuthOptions } from '../mocks/google-auth';
import { mockSheetsApi, type MockSheetData, type MockSheetsOptions } from '../mocks/sheets-api';
import { fixedTimeForSession, type Session } from './time';

type Role = 'teacher' | 'monitor' | 'admin';

interface SetupOptions {
	email?: string;
	name?: string;
	sheetData?: MockSheetData;
	view?: Role;
	/**
	 * Which session the app should land on. Pins the page clock so the
	 * clock-derived default session is deterministic. Defaults to PM.
	 */
	session?: Session;
	authOptions?: MockAuthOptions;
	sheetsOptions?: MockSheetsOptions;
}

/**
 * Pin the page's clock inside the given session (Date only; timers run normally).
 */
export async function useSessionClock(page: Page, session: Session = 'PM') {
	await page.clock.setFixedTime(fixedTimeForSession(session));
}

/**
 * Complete test setup: mock auth, mock sheets API, navigate, sign in, select role
 */
export async function setupAuthenticatedUser(
	page: Page,
	role: Role,
	options: SetupOptions = {}
) {
	const { email, name, sheetData, view, session, authOptions, sheetsOptions } = options;

	await useSessionClock(page, session ?? 'PM');

	// Setup mocks
	await mockGoogleAuth(
		page,
		{
			email: email ?? `${role}@school.edu`,
			name: name ?? `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`
		},
		authOptions
	);

	let mockData: MockSheetData | undefined;
	if (sheetData) {
		mockData = await mockSheetsApi(page, sheetData, sheetsOptions);
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

	// With silent token acquisition this button normally never appears; it is
	// only shown (and clicked) when silent auth fails
	const authorizeButton = page.getByRole('button', { name: /authorize access/i });
	if (await authorizeButton.count()) {
		await authorizeButton.click();
		await expect(authorizeButton).toBeHidden({ timeout: 10000 });
	}

	return mockData;
}

// Convenience functions
export const signInAsAdmin = (page: Page, options?: SetupOptions) =>
	setupAuthenticatedUser(page, 'admin', options);

export const signInAsTeacher = (page: Page, options?: SetupOptions) =>
	setupAuthenticatedUser(page, 'teacher', options);

export const signInAsMonitor = (page: Page, options?: SetupOptions) =>
	setupAuthenticatedUser(page, 'monitor', options);
