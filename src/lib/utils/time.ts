/**
 * Centralized time utilities for consistent US Eastern timezone handling.
 * All time operations should use these functions to ensure consistency.
 */

export const TIMEZONE = 'America/New_York';

/**
 * A tracking session. Buses run twice a day: morning drop-off (AM) and
 * afternoon dismissal (PM). Each session has its own daily sheet.
 */
export type Session = 'AM' | 'PM';

/**
 * Get the current session based on US Eastern time.
 * Before noon is the morning (AM) session; noon and later is afternoon (PM).
 */
export function getCurrentSessionEastern(): Session {
	const hour = parseInt(
		new Date().toLocaleTimeString('en-US', {
			timeZone: TIMEZONE,
			hour: '2-digit',
			hour12: false
		}),
		10
	);
	return hour < 12 ? 'AM' : 'PM';
}

/**
 * Get the sheet (tab) name for a date + session, e.g. "2026-07-08 AM".
 */
export function getSessionSheetName(date: string, session: Session): string {
	return `${date} ${session}`;
}

/**
 * Parse a session sheet name back into date + session.
 * Returns null if the name is not a session sheet.
 */
export function parseSessionSheetName(name: string): { date: string; session: Session } | null {
	const match = name.match(/^(\d{4}-\d{2}-\d{2}) (AM|PM)$/);
	if (!match) return null;
	return { date: match[1], session: match[2] as Session };
}

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

/**
 * Normalize a time value read from a spreadsheet cell into strict 24-hour
 * "HH:MM" (zero-padded), the only format <input type="time"> accepts and
 * the only format the rest of the app assumes. Sheet cells can hold times
 * a person typed by hand - missing leading zeros ("8:20"), seconds
 * ("15:10:00"), or 12-hour with AM/PM ("3:10 PM") - which would otherwise
 * silently fail to display. Returns '' if the value isn't a recognizable time.
 */
export function normalizeTimeString(raw: string): string {
	const value = raw.trim();
	if (!value) return '';

	const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(AM|PM)?$/i);
	if (!match) return '';

	let hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);
	const period = match[3]?.toUpperCase();

	if (minutes > 59) return '';

	if (period === 'AM') {
		if (hours < 1 || hours > 12) return '';
		hours = hours === 12 ? 0 : hours;
	} else if (period === 'PM') {
		if (hours < 1 || hours > 12) return '';
		hours = hours === 12 ? 12 : hours + 12;
	} else if (hours > 23) {
		return '';
	}

	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
