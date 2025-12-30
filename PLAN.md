# School Bus Tracking App - Implementation Plan

## Summary
A Svelte SPA for tracking school bus arrivals/departures. Uses Google OAuth for authentication and Google Sheets (via Google Drive API) for data storage. Hosted as static files. Test-driven development with Playwright e2e tests using mocked Google APIs.

## Technology Stack
- **Frontend**: Svelte 5 + SvelteKit (static adapter for SPA)
- **Build**: Vite
- **Styling**: Tailwind CSS (mobile-first)
- **Auth**: Google OAuth 2.0 (via Google Identity Services)
- **Storage**: Google Sheets API (accessed via user's OAuth token)
- **Testing**: Playwright for e2e (with mocked Google APIs), Vitest for unit tests
- **Hosting**: Any static host (Vercel, Netlify, GitHub Pages)
- **State Management**: Svelte 5 Runes (`$state`, `$derived`, `$effect`)

## Testing Strategy

### Mocking Approach
- Mock Google Identity Services (OAuth) at the network level using Playwright's route interception
- Mock Google Sheets API responses to simulate read/write operations
- Create reusable mock fixtures for common scenarios (empty tracker, populated tracker, etc.)

### Test-First Development
Tests are written before or alongside implementation for each phase, not deferred to the end.

## Initial E2E Tests (from User Stories)

### Authentication Tests (`tests/e2e/auth.spec.ts`)
- User can see "Sign in with Google" button when not logged in
- User can log in using school Google account
- User can bookmark the bus app URL for their specific school

### Admin Setup Tests (`tests/e2e/admin-setup.spec.ts`)
- Admin can set up a bus tracker for their school
- Admin receives a shareable URL after setup
- Admin can set up expected bus numbers in advance
- Admin can set expected arrival times for all buses
- Admin can change expected arrival times (for early dismissal days)

### Teacher View Tests (`tests/e2e/teacher.spec.ts`)
- Teacher can see buses grouped by status: pending, arrived, departed
- Teacher can see covered/uncovered buses clearly indicated
- Covered buses show "Bus X (covered by Bus Y)" format
- View auto-refreshes to show updated statuses

### Bus Monitor Tests (`tests/e2e/monitor.spec.ts`)
- Monitor can see all buses by bus number on a single screen
- Monitor can mark a bus as arrived (timestamp recorded)
- Monitor can mark a bus as departed (timestamp recorded)
- Monitor can mark a bus as "covered" by another bus number
- Monitor can edit any bus status after the fact

### Admin Management Tests (`tests/e2e/admin.spec.ts`)
- Admin can mark a bus as "uncovered"
- Admin can view statistics for uncovered buses
- Admin can view average and max arrival delays
- Admin can select custom date ranges for statistics

## Data Model (Google Sheets Structure)

### Sheet: "Config" (tab)
| Column | Description |
|--------|-------------|
| bus_number | e.g., "42", "17A" |
| expected_arrival_time | e.g., "15:30" |

### Sheet: "YYYY-MM-DD" (one tab per day, created automatically)
| Column | Description |
|--------|-------------|
| bus_number | Bus identifier |
| covered_by | If covered, the substitute bus number (empty if not covered) |
| is_uncovered | TRUE if bus is no-show, FALSE by default |
| arrival_time | Timestamp when marked arrived (empty = pending) |
| departure_time | Timestamp when marked departed (empty = still here) |
| last_modified_by | User email |
| last_modified_at | Timestamp |

**Derived status logic:**
- `pending`: arrival_time is empty AND is_uncovered is FALSE AND covered_by is empty
- `arrived`: arrival_time is set AND departure_time is empty
- `departed`: departure_time is set
- `covered`: covered_by is not empty
- `uncovered`: is_uncovered is TRUE

## URL Structure
- `/` - Landing page with "Sign in with Google" + setup flow
- `/?sheet=SHEET_ID` - Main app for a specific school's tracker
- `/?sheet=SHEET_ID&view=monitor` - Bus monitor view (mobile optimized)
- `/?sheet=SHEET_ID&view=teacher` - Teacher view (read-only status board)
- `/?sheet=SHEET_ID&view=admin` - Admin view (config + statistics)

## Implementation Phases

### Phase 1: Project Setup + Test Infrastructure
- Initialize SvelteKit with static adapter
- Configure Tailwind CSS
- Set up Playwright with Google API mocks
- Create mock fixtures for auth and sheets
- Write initial failing tests for auth user story
- Create basic app shell

### Phase 2: Google Auth Integration
- Write/update tests for auth flows
- Implement Google Sign-In button
- Handle OAuth token flow
- Create auth state using Svelte 5 runes (`$state`)
- Verify tests pass

### Phase 3: Google Sheets Integration
- Write tests for sheets operations (using mocks)
- Create sheets API client (using fetch + OAuth token)
- Functions: createSheet, readSheet, updateSheet, createDailyTab
- Handle Sheet permissions errors gracefully
- Verify tests pass

### Phase 4: Admin Setup Flow
- Write/update admin setup tests
- Create new tracker (creates Sheet)
- Configure buses and times
- Display shareable URL
- Verify tests pass

### Phase 5: Bus Monitor View
- Write/update bus monitor tests
- Mobile-optimized bus list
- Status buttons (arrived, departed, covered)
- Cover-by modal for selecting substitute bus
- Edit functionality for corrections
- Polling for concurrent updates
- Verify tests pass

### Phase 6: Teacher View
- Write/update teacher view tests
- Read-only status display
- Grouped by status
- Auto-refresh polling
- Clear visual hierarchy
- Verify tests pass

### Phase 7: Admin Statistics
- Write/update admin statistics tests
- Date range picker
- Uncovered bus report
- Delay statistics calculations
- Simple charts/visualizations
- Verify tests pass

### Phase 8: Polish
- Offline handling
- Error states
- Loading states
- Mobile testing
- Final test coverage review

## Files to Create

```
src/
  routes/
    +page.svelte          # Main entry, handles routing via query params
    +layout.svelte        # App shell, auth provider
  lib/
    components/
      SignIn.svelte       # Google sign-in button
      BusCard.svelte      # Individual bus display
      BusList.svelte      # List of buses with filtering
      StatusBadge.svelte  # Status indicator
      CoverModal.svelte   # Modal for "covered by" selection
      DateRangePicker.svelte
      StatsChart.svelte
    state/
      auth.svelte.ts      # Auth state using $state rune
      buses.svelte.ts     # Bus data state with polling using $state/$effect
      config.svelte.ts    # School config state using $state
    services/
      google-auth.ts      # OAuth implementation
      sheets-api.ts       # Google Sheets CRUD operations
    utils/
      time.ts             # Time formatting utilities
      stats.ts            # Statistics calculations
tests/
  e2e/
    auth.spec.ts          # Authentication tests
    admin-setup.spec.ts   # Admin setup flow tests
    monitor.spec.ts       # Bus monitor action tests
    teacher.spec.ts       # Teacher view tests
    admin.spec.ts         # Admin statistics tests
  mocks/
    google-auth.ts        # Mock Google Identity Services
    sheets-api.ts         # Mock Google Sheets API responses
  fixtures/
    empty-tracker.ts      # Fixture for new tracker setup
    populated-tracker.ts  # Fixture with existing bus data
```

## Key Decisions
1. **No backend server** - Pure SPA using Google APIs directly from browser
2. **OAuth tokens in memory** - Not persisted to storage for security
3. **Role selection via localStorage** - Simple, user can switch roles anytime
4. **One Sheet per school** - Each school has independent data
5. **Daily tabs** - Clean data separation, easy historical queries
6. **Polling over websockets** - Simpler, sufficient for 10s refresh rate
7. **No email notifications** - Out of scope, admins notified externally
8. **Svelte 5 Runes** - Use `$state`, `$derived`, `$effect` instead of stores
9. **Mocked Google APIs in tests** - Playwright route interception for reliable, fast tests
10. **Test-driven development** - Tests written alongside each phase

## Open Questions Resolved
- Auth: Google OAuth with user's own token (no API keys needed)
- Storage: Google Sheets in user's Drive
- Real-time: Polling every 10 seconds
- Roles: Self-selected, stored in localStorage
- Undo: No undo button, just ability to edit any field
- Stats: Configurable date range
- Daily reset: No reset, each day gets new tab
