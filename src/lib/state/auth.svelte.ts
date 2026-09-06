/**
 * Authentication state using Svelte 5 runes.
 * Manages Google OAuth authentication and token storage.
 */

export interface User {
	email: string;
	name: string;
	picture?: string;
}

export interface AuthState {
	user: User | null;
	accessToken: string | null;
	isLoading: boolean;
	error: string | null;
}

const STORAGE_KEY_USER = 'busTracker:user';
const STORAGE_KEY_TOKEN = 'busTracker:accessToken';
const STORAGE_KEY_TOKEN_EXPIRY = 'busTracker:tokenExpiry';

// Refresh the token 5 minutes before it expires to avoid mid-session failures
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

// Load initial state from localStorage
function loadStoredUser(): User | null {
	if (typeof window === 'undefined') return null;
	try {
		const stored = localStorage.getItem(STORAGE_KEY_USER);
		return stored ? JSON.parse(stored) : null;
	} catch {
		return null;
	}
}

function loadStoredToken(): { token: string; expiresAt: number } | null {
	if (typeof window === 'undefined') return null;
	try {
		const expiry = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRY);
		const expiresAt = expiry ? parseInt(expiry, 10) : 0;
		if (Date.now() > expiresAt) {
			// Token expired, clear it
			localStorage.removeItem(STORAGE_KEY_TOKEN);
			localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
			return null;
		}
		const token = localStorage.getItem(STORAGE_KEY_TOKEN);
		return token ? { token, expiresAt } : null;
	} catch {
		return null;
	}
}

const storedToken = loadStoredToken();

// Create reactive state using $state rune
let user = $state<User | null>(loadStoredUser());
let accessToken = $state<string | null>(storedToken?.token ?? null);
let isLoading = $state(true);
let error = $state<string | null>(null);

// Expiry timestamp (ms) of the current access token
let tokenExpiresAt = storedToken?.expiresAt ?? 0;

// Token client for getting access tokens
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

// Timer for proactive silent token refresh
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// Resolver for the in-flight acquireToken() promise, if any
let pendingTokenResolve: ((ok: boolean) => void) | null = null;
let pendingTokenTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Save user to localStorage
 */
function saveUser(u: User | null): void {
	if (typeof window === 'undefined') return;
	if (u) {
		localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(u));
	} else {
		localStorage.removeItem(STORAGE_KEY_USER);
	}
}

/**
 * Save access token to localStorage with expiry
 */
function saveToken(token: string | null, expiresIn?: number): void {
	// Default to 1 hour if not specified
	tokenExpiresAt = token ? Date.now() + (expiresIn || 3600) * 1000 : 0;
	if (typeof window === 'undefined') return;
	if (token) {
		localStorage.setItem(STORAGE_KEY_TOKEN, token);
		localStorage.setItem(STORAGE_KEY_TOKEN_EXPIRY, tokenExpiresAt.toString());
	} else {
		localStorage.removeItem(STORAGE_KEY_TOKEN);
		localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
	}
}

/**
 * Parse a JWT token to extract user info.
 * Note: This doesn't verify the signature - that's done by Google.
 */
function parseJwt(token: string): User | null {
	try {
		const base64Url = token.split('.')[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split('')
				.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);
		const payload = JSON.parse(jsonPayload);
		return {
			email: payload.email,
			name: payload.name,
			picture: payload.picture
		};
	} catch {
		return null;
	}
}

/**
 * Initialize Google Identity Services.
 * Should be called once when the app loads.
 * Waits for the Google script to load before initializing.
 */
export function initializeAuth(clientId: string): void {
	if (typeof window === 'undefined') {
		isLoading = false;
		return;
	}

	const doInit = () => {
		// Initialize Google Sign-In
		window.google.accounts.id.initialize({
			client_id: clientId,
			callback: handleCredentialResponse,
			auto_select: true
		});

		// Initialize OAuth2 token client for Sheets API access
		tokenClient = window.google.accounts.oauth2.initTokenClient({
			client_id: clientId,
			scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
			callback: handleTokenResponse,
			error_callback: handleTokenError
		});

		isLoading = false;

		// If the user is already signed in but the token expired (e.g. overnight),
		// warm up a fresh token silently so no authorization prompt is needed.
		if (user && !hasValidToken()) {
			void trySilentTokenAcquisition();
		}
	};

	// If Google script is already loaded, initialize immediately
	if (window.google?.accounts?.id) {
		doInit();
		return;
	}

	// Otherwise, wait for the script to load
	const checkGoogle = setInterval(() => {
		if (window.google?.accounts?.id) {
			clearInterval(checkGoogle);
			doInit();
		}
	}, 100);

	// Timeout after 5 seconds
	setTimeout(() => {
		clearInterval(checkGoogle);
		isLoading = false;
	}, 5000);
}

/**
 * Handle the credential response from Google Sign-In.
 */
function handleCredentialResponse(response: google.accounts.id.CredentialResponse): void {
	if (response.credential) {
		const parsedUser = parseJwt(response.credential);
		if (parsedUser) {
			user = parsedUser;
			saveUser(parsedUser);
			error = null;
			// Don't automatically request access token - wait until user needs it
		}
	}
}

/**
 * Clear the pending refresh timer, if any.
 */
function clearRefreshTimer(): void {
	if (refreshTimer !== null) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}

/**
 * Schedule a silent token refresh to run before the current token expires.
 * @param expiresIn - token lifetime in seconds (defaults to 3600)
 */
function scheduleTokenRefresh(expiresIn: number = 3600): void {
	clearRefreshTimer();

	const refreshInMs = expiresIn * 1000 - REFRESH_BEFORE_EXPIRY_MS;

	// Only schedule if the token lasts long enough for a proactive refresh
	if (refreshInMs <= 0) return;

	refreshTimer = setTimeout(() => {
		void trySilentTokenAcquisition();
	}, refreshInMs);
}

/**
 * Resolve the in-flight acquireToken() promise, if any.
 */
function settlePendingTokenRequest(ok: boolean): void {
	if (pendingTokenTimer !== null) {
		clearTimeout(pendingTokenTimer);
		pendingTokenTimer = null;
	}
	const resolve = pendingTokenResolve;
	pendingTokenResolve = null;
	resolve?.(ok);
}

/**
 * Handle the token response from OAuth2.
 */
function handleTokenResponse(response: google.accounts.oauth2.TokenResponse): void {
	if (response.access_token) {
		accessToken = response.access_token;
		saveToken(response.access_token, response.expires_in);
		error = null;
		// Schedule a proactive silent refresh before this token expires
		scheduleTokenRefresh(response.expires_in);
		settlePendingTokenRequest(true);
	} else {
		if (response.error) {
			error = response.error;
		}
		settlePendingTokenRequest(false);
	}
}

/**
 * Handle errors raised outside the token callback (popup blocked/closed, etc).
 */
function handleTokenError(err: { type?: string; message?: string }): void {
	error = err.message || err.type || 'Authorization failed';
	settlePendingTokenRequest(false);
}

/**
 * Whether the current access token exists and is not about to expire.
 */
export function hasValidToken(): boolean {
	return accessToken !== null && Date.now() < tokenExpiresAt - 30 * 1000;
}

/**
 * Request an access token and resolve once the attempt settles.
 * Silent mode (interactive: false) uses prompt: '' — it succeeds with no UI
 * while the user's Google session and prior consent are still valid.
 * Interactive mode may open the Google consent popup.
 */
function acquireToken(interactive: boolean): Promise<boolean> {
	if (!tokenClient) return Promise.resolve(false);
	return new Promise((resolve) => {
		// A newer request supersedes any in-flight one
		settlePendingTokenRequest(false);
		pendingTokenResolve = resolve;
		// Silent attempts settle fast; interactive ones wait on the user
		pendingTokenTimer = setTimeout(
			() => settlePendingTokenRequest(false),
			interactive ? 60000 : 8000
		);
		tokenClient!.requestAccessToken(interactive ? {} : { prompt: '' });
	});
}

/**
 * Attempt a silent (no-UI) token acquisition.
 */
export function trySilentTokenAcquisition(): Promise<boolean> {
	return acquireToken(false);
}

/**
 * Request a token interactively (may open the Google consent popup).
 */
export function requestInteractiveToken(): Promise<boolean> {
	return acquireToken(true);
}

/**
 * Ensure a usable access token exists, refreshing silently if needed.
 * Returns false only when silent acquisition fails — callers should then
 * surface an interactive "Authorize" action.
 */
export async function ensureFreshToken(): Promise<boolean> {
	if (hasValidToken()) return true;
	if (accessToken) {
		// Expired token still in memory — drop it before re-acquiring
		accessToken = null;
		saveToken(null);
	}
	return trySilentTokenAcquisition();
}

/**
 * Render the Google Sign-In button in the specified element.
 */
export function renderSignInButton(element: HTMLElement): void {
	if (typeof window === 'undefined' || !window.google) {
		return;
	}

	window.google.accounts.id.renderButton(element, {
		theme: 'outline',
		size: 'large',
		type: 'standard',
		text: 'signin_with'
	});
}

/**
 * Sign out the current user.
 */
export function signOut(): void {
	clearRefreshTimer();
	settlePendingTokenRequest(false);
	user = null;
	accessToken = null;
	saveUser(null);
	saveToken(null);
	if (typeof window !== 'undefined' && window.google) {
		window.google.accounts.id.disableAutoSelect();
	}
}

/**
 * Get the current auth state (reactive getters).
 */
export function getAuthState(): AuthState {
	return {
		get user() {
			return user;
		},
		get accessToken() {
			return accessToken;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		}
	};
}

/**
 * Get current user.
 */
export function getCurrentUser(): User | null {
	return user;
}

/**
 * Get current access token.
 */
export function getAccessToken(): string | null {
	return accessToken;
}

// TypeScript declarations for Google Identity Services
declare global {
	interface Window {
		google: typeof google;
		__gisConfig?: {
			callback: (response: google.accounts.id.CredentialResponse) => void;
		};
	}

	namespace google {
		namespace accounts {
			namespace id {
				interface CredentialResponse {
					credential: string;
					select_by?: string;
				}

				interface GsiButtonConfiguration {
					theme?: 'outline' | 'filled_blue' | 'filled_black';
					size?: 'large' | 'medium' | 'small';
					type?: 'standard' | 'icon';
					text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
				}

				function initialize(config: {
					client_id: string;
					callback: (response: CredentialResponse) => void;
					auto_select?: boolean;
				}): void;

				function renderButton(element: HTMLElement, config: GsiButtonConfiguration): void;
				function prompt(): void;
				function disableAutoSelect(): void;
			}

			namespace oauth2 {
				interface TokenResponse {
					access_token?: string;
					token_type?: string;
					expires_in?: number;
					scope?: string;
					error?: string;
				}

				interface TokenClientConfig {
					prompt?: string;
				}

				interface TokenClient {
					requestAccessToken(overrideConfig?: TokenClientConfig): void;
				}

				function initTokenClient(config: {
					client_id: string;
					scope: string;
					callback: (response: TokenResponse) => void;
					error_callback?: (error: { type?: string; message?: string }) => void;
				}): TokenClient;
			}
		}
	}
}
