# Visitor Detail, Passport and OSRM changes

Implemented against the current local working tree, preserving the earlier uncommitted contributions, performance and Admin changes. Reference images were not available in this conversation; the written visual direction was used.

## Heritage Detail

Warm paper, thin archival borders, category/year metadata, a dominant official hero image and a Playfair title below it. Compact Directions, Add to Plan, Save and Share controls preserve their existing actions. Description/history use real detail data; Read Aloud follows history. Timeline records now retain their database IDs. The official gallery remains lazy-loaded and separate from Visitor Experiences. Practical information is a responsive grid containing populated fields only. No archival facts, classifications, dates, plaques or badges were invented.

## Passport and Profile

Profile opens a centered dark charcoal Passport modal with muted gold borders and cream text. It has a fixed close control, internal scrolling, Escape handling, focus trapping/return to the Profile button, and an inert background. Desktop maximum width is 680px; maximum height is 90dvh. Eligible sites form a two-column mobile / three-column wider stamp grid. Stamps, dates, progress and points use existing Passport data; historical stamps remain available. No invented passport identifier or Share/QR/badge controls were added.

Passport no longer renders as a regular page or appears in Plan navigation. Opening an old `#/passport` address does not automatically open Passport or fetch its data. Legacy navigation requests lead to Profile; Passport opens only through its authenticated “View Heritage Passport” action. The verification section's View Passport action opens Profile. Guests never request Passport. Authenticated users fetch it on first modal open and reuse it in memory. Verification invalidates the cached view; an open modal refreshes automatically, or the next open fetches updated stamps. Logout/session expiration clear the state. Closing restores Profile focus without changing the underlying page or scroll position. The prior profile-derived Level was replaced with actual heritage points.

## OSRM

`frontend/.env.example` documents `VITE_OSRM_BASE_URL`. It defaults to `https://router.project-osrm.org`. Requests use `/route/v1/driving/{longitude,latitude;...}?overview=full&geometries=geojson&steps=false`.

Only opening an itinerary map with at least two valid-coordinate stops requests routing. Invalid/unmapped stops are excluded with an explanatory message. Only public heritage coordinates are sent; no GPS fix, auth headers, account, Passport or contribution data is sent. Distance and driving time are estimates without live traffic. Existing individual Google Maps directions remain unchanged.

Successful/pending results are cached by base URL and ordered coordinate sequence during the app session. Edits close the custom itinerary map and remove stale geometry from view; reopening requests/reuses the new sequence. Failed responses are evicted so reopening can retry. The public demo is paced at one request per second per session. Requests time out after 15 seconds; stale consumers ignore responses after navigation/unmount.

The map draws only validated OSRM geometry, numbers stops in itinerary order and fits route bounds while retaining markers, selection and the city boundary. Offline, rate limit, timeout, malformed/no-route responses leave the ordered list and map available with: “Road route is temporarily unavailable. Heritage stops are still shown on the map.” No substitute straight-line driving route is drawn.

The demo service has no production uptime, latency or update guarantees. Configure your own compatible service for production. References: [OSRM API](https://project-osrm.org/docs/v5.24.0/api/) and [demo usage policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server).

## Exact files changed in this task

- `frontend/.env.example`
- `frontend/src/App.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/components/AuthModal.tsx`
- `frontend/src/components/HeritageReadAloud.tsx`
- `frontend/src/components/PassportModal.tsx` (new)
- `frontend/src/components/VisitorExperiences.tsx` (presentation only)
- `frontend/src/index.css`
- `frontend/src/types.ts`
- `frontend/src/utils/osrm.ts` (new)
- `frontend/src/views/MapView.tsx`
- `frontend/src/views/PassportView.tsx`
- `frontend/src/views/PlanView.tsx`
- `frontend/src/views/SiteDetailView.tsx`
- `frontend/src/views/heritageMap.css`
- `frontend/tests/contributions-mobile.mjs`
- `frontend/tests/fixtures/visitor-design.html` (new, controlled test data)
- `frontend/tests/heritage.test.mjs`
- `frontend/tests/read-aloud.test.mjs`
- `VISITOR_DESIGN_OSRM.md` (this report)

## Validation

- Backend: `php artisan test` — **157 passed, 1,579 assertions**. Tests use isolated test databases; the application database was not reset or modified.
- Frontend: `npm test` — **205 passed** after the Profile-only access follow-up. Coverage includes route coordinate order, cache reuse, malformed/offline/429/timeout/no-route fallback, on-demand/custom route requests, polyline/bounds/numbered markers, real detail content, Profile modal caching, guest/legacy access prevention, and closed-cache invalidation after verification. Existing verification, contribution, Map, Admin, Events, itinerary, authentication and speech tests pass.
- `npm run build` — passed. Existing missing `/images/background/background.png` warning remains.
- Targeted ESLint — the new modal/routing code and edited Detail, Passport, Plan, Map, Read Aloud, Visitor Experiences and types pass. Whole changed-file lint retains **12 pre-existing errors**: App (3), API client (8), AuthModal (1). These concern existing synchronous effects, existing `any` types, an unused variable and a redundant assignment; no new errors were introduced.
- `git diff --check` — passed; Windows line-ending notices remain.
- Chrome `--design` — Detail, Passport and OSRM map checked at **320, 375, 390, 768, 1024 and 1440px**, with no horizontal overflow or captured console errors. Profile → modal, unchanged underlying URL, focus/Escape/inert behavior and one Passport fetch across reopening were checked. The browser route response was controlled test data.
- Existing Chrome verification/contribution suite — passed, including browser geolocation, eligibility/Passport callback, submission and moderation.
- One live public-coordinate OSRM demo request — `Ok`, LineString with 25 points, 519.7m and 43.4s. This confirms connectivity/API shape, not production availability or field navigation accuracy.
- Physical phones, hardware GPS and on-road navigation were not tested. No screenshots were available for a direct visual comparison.

No Admin redesign, backend/data/schema changes, migration, destructive reset or deletion. Geofence, accuracy, duplicate prevention, 100-point rewards, eligible-site rules, authentication/security and contribution moderation are unchanged. Visitor photos remain separate from official Gallery. No QR was restored.
