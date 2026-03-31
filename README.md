# BUSted — School Bus Tracker

A real-time school bus arrival/departure tracker. Teachers see live bus status,
bus monitors mark arrivals and departures, and administrators manage bus
configuration and view historical statistics.

**No backend.** Data lives in a Google Sheet; auth is Google OAuth.

## Architecture

```
src/
  routes/
    +page.svelte          # Entry point: auth flow, role selection, view routing
  lib/
    state/
      auth.svelte.ts      # Google OAuth state (sign-in, access token)
      buses.svelte.ts     # Bus data state + polling
    services/
      sheets-api.ts       # Google Sheets API v4 client
      sheets-cache.ts     # In-memory cache + adaptive rate-limit throttling
    utils/
      time.ts             # US Eastern timezone helpers
      stats.ts            # Statistics calculation
    components/           # Svelte UI components (role views, modals, etc.)
tests/
  e2e/                    # Playwright end-to-end tests
  mocks/                  # Google Auth + Sheets API mocks
  fixtures/               # Test data fixtures
```

## Prerequisites

- Node.js (see `.nvmrc` or `mise.toml` for version)
- A Google Cloud project with the Sheets API and Drive API enabled
- A Google OAuth 2.0 Client ID (Web application type)

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```

2. Copy the environment template and fill in your Client ID:
   ```sh
   cp .env.example .env
   ```

3. Run the dev server:
   ```sh
   npm run dev
   ```

## Usage

1. Open the app and sign in with a Google account.
2. **Administrator**: Create a new tracker (this creates a Google Sheet) and
   share the generated URL with staff.
3. **Bus monitor / Teacher**: Use the URL the admin shared to open the tracker.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (output: `build/`) |
| `npm run preview` | Preview the production build locally |
| `npm run check` | Run TypeScript + Svelte type checks |
| `npm test` | Run Playwright end-to-end tests |

## Testing

E2E tests use Playwright with mocked Google Auth and Sheets APIs.

```sh
npm test
```

Tests run against a production preview build (`vite preview`). The
`playwright.config.ts` starts the preview server automatically.

## Known Issues

- Several transitive dependencies have known CVEs (see `npm audit`). The
  high-severity `@sveltejs/kit` and `svelte` findings are SSR-only and do not
  affect this static deployment. Run `npm audit fix` during the next dependency
  upgrade pass.
- The ngrok tunnel URL in `vite.config.ts` (`allowedHosts`) is a development
  convenience and should be removed or updated before sharing the config.
