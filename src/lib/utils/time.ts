/**
 * Centralized time utilities for consistent US Eastern timezone handling.
 * All time operations should use these functions to ensure consistency.
 */

export const TIMEZONE = 'America/New_York';

/**
 * Get the current time formatted as HH:MM in US Eastern timezone.
 * Used for recording arrival/departure times.
 */
export function getCurrentTimeEastern(): string {
	return new Date().toLocaleTimeString('en-US', {
		timeZone: TIMEZONE,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

/**
 * Get today's date in YYYY-MM-DD format in US Eastern timezone.
 * Used for identifying which daily sheet to use.
 */
export function getTodayDateEastern(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Format a Date object to display time in US Eastern timezone.
 * Used for "last updated" displays.
 */
export function formatTimeForDisplay(date: Date): string {
	return date.toLocaleTimeString('en-US', {
		timeZone: TIMEZONE,
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	});
}

/**
 * Convert 24-hour time (HH:MM) to 12-hour time with AM/PM.
 * This is a pure formatting function - no timezone conversion needed
 * since the input time is already in the correct timezone.
 */
export function formatTime12Hour(time: string): string {
	if (!time) return '';
	const [hours, minutes] = time.split(':').map(Number);
	if (isNaN(hours) || isNaN(minutes)) return time;
	const period = hours >= 12 ? 'PM' : 'AM';
	const hours12 = hours % 12 || 12;
	return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}
