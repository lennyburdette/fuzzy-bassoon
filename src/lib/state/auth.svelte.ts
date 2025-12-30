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

function loadStoredToken(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const expiry = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRY);
		if (expiry && Date.now() > parseInt(expiry, 10)) {
			// Token expired, clear it
			localStorage.removeItem(STORAGE_KEY_TOKEN);
			localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
			return null;
		}
		return localStorage.getItem(STORAGE_KEY_TOKEN);
	} catch {
		return null;
	}
}

// Create reactive state using $state rune
let user = $state<User | null>(loadStoredUser());
let accessToken = $state<string | null>(loadStoredToken());
let isLoading = $state(true);
let error = $state<string | null>(null);

// Token client for getting access tokens
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

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
	if (typeof window === 'undefined') return;
	if (token) {
		localStorage.setItem(STORAGE_KEY_TOKEN, token);
		// Default to 1 hour if not specified
		const expiryMs = Date.now() + (expiresIn || 3600) * 1000;
		localStorage.setItem(STORAGE_KEY_TOKEN_EXPIRY, expiryMs.toString());
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
			callback: handleTokenResponse
		});

		isLoading = false;
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
 * Handle the token response from OAuth2.
 */
function handleTokenResponse(response: google.accounts.oauth2.TokenResponse): void {
	if (response.access_token) {
		accessToken = response.access_token;
		saveToken(response.access_token, response.expires_in);
		error = null;
	} else if (response.error) {
		error = response.error;
	}
}

/**
 * Request an access token for API calls.
 */
export function requestAccessToken(): void {
	if (tokenClient) {
		tokenClient.requestAccessToken();
	}
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
 * Check if user is authenticated.
 */
export function isAuthenticated(): boolean {
	return user !== null;
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

				interface TokenClient {
					requestAccessToken(): void;
				}

				function initTokenClient(config: {
					client_id: string;
					scope: string;
					callback: (response: TokenResponse) => void;
				}): TokenClient;
			}
		}
	}
}
