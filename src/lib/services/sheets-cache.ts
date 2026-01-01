/**
 * In-memory caching layer for Google Sheets API to reduce API calls.
 * Caches persist for the page session (cleared on reload or when switching spreadsheets).
 */

interface RowIndexMap {
	[busNumber: string]: number; // Maps bus_number to row index (0-based, excluding header)
}

// Sheet existence cache: key = "spreadsheetId:date"
const sheetExistsCache = new Set<string>();

// Row index cache: key = "spreadsheetId:date"
const rowIndexCache = new Map<string, RowIndexMap>();

// Pending requests for deduplication: key = request identifier
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Check if a daily sheet is known to exist (from cache).
 */
export function isSheetCached(spreadsheetId: string, date: string): boolean {
	return sheetExistsCache.has(`${spreadsheetId}:${date}`);
}

/**
 * Mark a daily sheet as existing in the cache.
 */
export function cacheSheetExists(spreadsheetId: string, date: string): void {
	sheetExistsCache.add(`${spreadsheetId}:${date}`);
}

/**
 * Get cached row index for a bus.
 * Returns null if not cached.
 */
export function getCachedRowIndex(
	spreadsheetId: string,
	date: string,
	busNumber: string
): number | null {
	const key = `${spreadsheetId}:${date}`;
	const indexMap = rowIndexCache.get(key);
	if (indexMap && busNumber in indexMap) {
		return indexMap[busNumber];
	}
	return null;
}

/**
 * Update row index cache from bus data.
 */
export function updateRowIndexCache(
	spreadsheetId: string,
	date: string,
	buses: Array<{ bus_number: string }>
): void {
	const key = `${spreadsheetId}:${date}`;
	const indexMap: RowIndexMap = {};
	buses.forEach((bus, index) => {
		indexMap[bus.bus_number] = index;
	});
	rowIndexCache.set(key, indexMap);
}

/**
 * Deduplicate concurrent identical requests.
 * If a request with the same key is already in flight, return its promise.
 * Otherwise, execute the request function and cache the promise until it resolves.
 */
export async function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
	const pending = pendingRequests.get(key);
	if (pending) {
		return pending as Promise<T>;
	}

	const promise = requestFn().finally(() => {
		pendingRequests.delete(key);
	});

	pendingRequests.set(key, promise);
	return promise;
}

/**
 * Clear all caches. Call this when switching spreadsheets or resetting state.
 */
export function clearAllCaches(): void {
	sheetExistsCache.clear();
	rowIndexCache.clear();
	pendingRequests.clear();
	resetThrottleState();
}

// Adaptive throttling state
let rateLimitHits = 0;
let lastRateLimitTime = 0;
const RATE_LIMIT_COOLDOWN_MS = 60000; // 1 minute cooldown
const BASE_POLL_INTERVAL_MS = 10000;
const MAX_POLL_INTERVAL_MS = 60000;

/**
 * Record a rate limit (429) error.
 * Call this when the API returns a 429 status.
 */
export function recordRateLimitHit(): void {
	rateLimitHits++;
	lastRateLimitTime = Date.now();
}

/**
 * Record a successful API call.
 * Gradually reduces throttling after successful calls.
 */
export function recordSuccessfulCall(): void {
	// If we're past the cooldown period, gradually reduce the hit count
	if (Date.now() - lastRateLimitTime > RATE_LIMIT_COOLDOWN_MS && rateLimitHits > 0) {
		rateLimitHits = Math.max(0, rateLimitHits - 1);
	}
}

/**
 * Get the recommended polling interval based on rate limit history.
 * Returns longer intervals when we've recently hit rate limits.
 */
export function getRecommendedPollInterval(): number {
	if (rateLimitHits === 0) {
		return BASE_POLL_INTERVAL_MS;
	}

	// Exponential backoff: double the interval for each hit, up to max
	const backoffMultiplier = Math.pow(2, Math.min(rateLimitHits, 4));
	return Math.min(BASE_POLL_INTERVAL_MS * backoffMultiplier, MAX_POLL_INTERVAL_MS);
}

/**
 * Check if we should skip this poll due to rate limiting.
 * Returns true if we're in a cooldown period.
 */
export function shouldThrottlePoll(): boolean {
	if (rateLimitHits === 0) return false;

	// If we hit a rate limit recently, check if we're still in cooldown
	const timeSinceLimit = Date.now() - lastRateLimitTime;
	const cooldownMultiplier = Math.min(rateLimitHits, 4);
	const cooldownPeriod = RATE_LIMIT_COOLDOWN_MS * cooldownMultiplier;

	return timeSinceLimit < cooldownPeriod;
}

/**
 * Reset throttle state.
 */
export function resetThrottleState(): void {
	rateLimitHits = 0;
	lastRateLimitTime = 0;
}
