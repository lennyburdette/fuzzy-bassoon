import type { Page, Route } from '@playwright/test';

export interface MockUser {
	email: string;
	name: string;
	picture?: string;
}

export interface MockAuthOptions {
	/**
	 * When true, silent token requests (prompt: '') fail as they would when
	 * the user's Google session has fully expired; only interactive requests
	 * succeed. Used to exercise the "Authorize Access" fallback.
	 */
	silentAuthFails?: boolean;
}

const DEFAULT_USER: MockUser = {
	email: 'teacher@school.edu',
	name: 'Test Teacher',
	picture: 'https://example.com/avatar.png'
};

/**
 * Mock Google Identity Services for testing.
 * Intercepts the GIS library load and provides a mock implementation.
 */
export async function mockGoogleAuth(
	page: Page,
	user: MockUser = DEFAULT_USER,
	options: MockAuthOptions = {}
) {
	const silentAuthFails = options.silentAuthFails ?? false;

	// Mock the Google Identity Services script
	await page.route('https://accounts.google.com/gsi/client', async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: `
				window.google = {
					accounts: {
						id: {
							initialize: function(config) {
								window.__gisConfig = config;
							},
							renderButton: function(element, options) {
								// Create a mock sign-in button
								const button = document.createElement('button');
								button.textContent = 'Sign in with Google';
								button.setAttribute('data-testid', 'google-signin-button');
								button.onclick = function() {
									// Simulate successful sign-in
									if (window.__gisConfig && window.__gisConfig.callback) {
										window.__gisConfig.callback({
											credential: '${createMockJwt(user)}'
										});
									}
								};
								element.appendChild(button);
							},
							prompt: function() {},
							disableAutoSelect: function() {}
						},
						oauth2: {
							initTokenClient: function(config) {
								return {
									requestAccessToken: function(overrideConfig) {
										const isSilent = !!(overrideConfig && overrideConfig.prompt === '');
										if (isSilent && ${silentAuthFails}) {
											// Simulate an expired Google session: silent
											// requests fail without any UI
											if (config.callback) {
												config.callback({ error: 'interaction_required' });
											}
											return;
										}
										if (config.callback) {
											config.callback({
												access_token: 'mock_access_token_' + Date.now(),
												token_type: 'Bearer',
												expires_in: 3600,
												scope: config.scope
											});
										}
									}
								};
							}
						}
					}
				};
			`
		});
	});
}

/**
 * Create a mock JWT token for testing.
 * This is a simplified mock - not a real JWT.
 */
function createMockJwt(user: MockUser): string {
	const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const payload = btoa(
		JSON.stringify({
			iss: 'https://accounts.google.com',
			sub: '123456789',
			email: user.email,
			email_verified: true,
			name: user.name,
			picture: user.picture,
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600
		})
	);
	const signature = btoa('mock_signature');
	return `${header}.${payload}.${signature}`;
}

/**
 * Helper to simulate user being logged out
 */
export async function mockGoogleAuthLoggedOut(page: Page) {
	await page.route('https://accounts.google.com/gsi/client', async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: `
				window.google = {
					accounts: {
						id: {
							initialize: function(config) {
								window.__gisConfig = config;
							},
							renderButton: function(element, options) {
								const button = document.createElement('button');
								button.textContent = 'Sign in with Google';
								button.setAttribute('data-testid', 'google-signin-button');
								element.appendChild(button);
							},
							prompt: function() {},
							disableAutoSelect: function() {}
						},
						oauth2: {
							initTokenClient: function(config) {
								return {
									requestAccessToken: function() {
										// Don't call callback - simulates no token
									}
								};
							}
						}
					}
				};
			`
		});
	});
}

function btoa(str: string): string {
	return Buffer.from(str).toString('base64');
}
