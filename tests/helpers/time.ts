/**
 * Time utilities for tests - mirrors the app's timezone handling.
 * Tests should use these functions to ensure consistency with the app.
 */

export type Session = 'AM' | 'PM';

export const TIMEZONE = 'America/New_York';

/**
 * Get today's date in YYYY-MM-DD format in US Eastern timezone.
 * Matches the app's getTodayDateEastern() function.
 */
export function getTodayEastern(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Get the session sheet name for today, e.g. "2026-07-08 PM".
 * Matches the app's getSessionSheetName().
 */
export function getTodaySessionSheet(session: Session): string {
	return `${getTodayEastern()} ${session}`;
}

/**
 * A Date within today that falls in the given session in US Eastern time.
 * Used with page.clock.setFixedTime() so the app's clock-derived default
 * session is deterministic regardless of when the tests run.
 * The offsets chosen keep the hour inside the session and the date unchanged
 * in both EST and EDT.
 */
export function fixedTimeForSession(session: Session): Date {
	const today = getTodayEastern();
	// 09:00-04:00 = 08:00 EST / 09:00 EDT (morning either way)
	// 15:00-04:00 = 14:00 EST / 15:00 EDT (afternoon either way)
	return new Date(`${today}T${session === 'AM' ? '09:00' : '15:00'}:00-04:00`);
}
