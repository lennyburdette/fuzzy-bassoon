/**
 * Time utilities for tests - mirrors the app's timezone handling.
 * Tests should use these functions to ensure consistency with the app.
 */

export const TIMEZONE = 'America/New_York';

/**
 * Get today's date in YYYY-MM-DD format in US Eastern timezone.
 * Matches the app's getTodayDateEastern() function.
 */
export function getTodayEastern(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}
