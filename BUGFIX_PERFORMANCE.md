CHIS local bug-fix and performance report — 9 October 2026

This pass inspected the current local working tree, including the uncommitted Visitor Contributions and performance work. It did not replace that work with the GitHub version. Measurements below distinguish live HTTP, browser fixtures, source inspection, and an in-process read-only diagnostic. Single samples are diagnostic observations, not statistical benchmarks.

1. Root causes: itinerary endpoints still loaded complete heritage models, galleries and timelines. Plan discarded routes on unmount and downloaded detail already present in the list. Development effect replay duplicated concurrent requests. The local PHP server queued otherwise concurrent browser requests, and MySQL query/connection time dominated request duration. Passport loaded galleries, moderation counts used one query per config, and eligibility queried the same verified visit twice.

2. Plan was slow because of the payload, repeated downloads, lazy-chunk delay before starting its request, and the development server queue. Public list and detail now share ordered summaries with one cover image. Session promise caches share pending requests and completed data; the list populates the detail cache. Requests start only when Plan is requested, before its chunk arrives. Retry refetches explicitly, failures are not cached, and successful itinerary Admin mutations invalidate the cache. Browser refresh starts a new session. Map/Leaflet remains behind View on Map.

3. Visit Verification already had a small availability response, but it required another HTTP/database round trip. Full public Site Detail now includes only `visit_verification_enabled`, computed with an existence subquery alongside its site query. The compatibility availability endpoint now needs one query and returns only `enabled`. Radius, legacy tokens and visitor information remain private. Geolocation errors, including synchronous browser failures, release the busy state; permission, timeout, outside and accuracy retries are tested.

4. Visitor Experiences already started public and authenticated reads independently; it was not a frontend waterfall between those calls. Development effect replay and the serial local server made them appear sequential and slow. Concurrent identical GETs now share transport, using request headers to separate sessions. This sharing lasts only while a request is pending. The personal status endpoint checks the verified visit once. Guests skip personal status; contributions remain scoped to the open site. Its loading status is compact. API transport has a bounded timeout: 30 seconds for ordinary requests and 120 seconds for multipart uploads.

5. The contribution Verify My Visit CTA only searched for a DOM ID and tried to scroll/focus it. It silently did nothing if availability had not produced that button, and never invoked verification. Site Detail now shares the real action's ref; the CTA scrolls, focuses and synchronously clicks that action. There is no second geolocation implementation. Successful verification refreshes contribution eligibility and App Passport immediately. A known verified visitor is not asked for location again; an unavailable verification configuration is explained rather than offering an ineffective CTA.

6. The reported `34-4` and `27-4` keys came from sibling VisitVerification and VisitorExperiences elements, both using the same `${site.id}-${user.id}` key. They now use separate `verification:` and `experiences:` prefixes. Recommended stop rows also use the database stop ID. The final live Chrome run recorded no React console errors. A baseline warning counter was not captured; the original duplicate source and the reported warnings are distinguished from the measured after result.

7. The event 403 reproduced against the local backend. `public/storage` was absent, so the URL reached Laravel's signed private-file route. The database referenced an event JPEG that was also absent from the public disk. The frontend fallback `/images/events/giant-lantern-fest.jpg` was missing, and its handler reassigned that missing fallback without a guard. The local public storage junction is restored. Public disk serving and private signed serving now use separate URLs, so missing public files return 404 and private files remain protected. Event URLs use the existing storage URL helper. Home/Events use the existing guarded handler and the guaranteed local heritage placeholder. The final live browser made one event image request (404), displayed the fallback, and made no repeated request or 403. The original photo cannot be recovered from this checkout: restore its upload or upload a replacement through Admin.

8. Query optimizations: itinerary list/detail use four bounded eager-loading queries, independent of route count, and omit long site content and Admin fields. Availability uses one query. Public full detail retains galleries/history/timeline and adds availability without another query. Passport uses covers only. Config visitor counts use `withCount`, preserving their meaning. Contribution eligibility uses one verified-visit lookup. Existing cover selection and stop ordering are retained. Images stay lazy with constrained containers/dimensions; no image-processing dependency or original-file transformation was added.

9. Application files changed in this pass:

| Area | Files |
|---|---|
| Backend | `backend/app/Http/Controllers/ItineraryController.php`, `HeritageSiteController.php`, `HeritageCheckinController.php`, `HeritageContributionController.php` |
| Relationships/config | `backend/app/Models/HeritageSite.php`, `HeritageCheckinConfig.php`, `backend/config/filesystems.php` |
| Frontend state/API | `frontend/src/App.tsx`, `frontend/src/api/client.ts`, `frontend/src/types.ts`, `frontend/package.json` |
| Views/components | `frontend/src/views/PlanView.tsx`, `SiteDetailView.tsx`, `HomeView.tsx`, `EventsView.tsx`, `frontend/src/components/VisitVerification.tsx`, `VisitorExperiences.tsx` |
| Diagnostic/report | `backend/tools/measure-public-requests.php`, `BUGFIX_PERFORMANCE.md` |

10. Tests changed: `backend/tests/Feature/ItineraryTest.php`, `HeritagePassportTest.php`, `HeritageContributionsTest.php`; added `PublicStorageTest.php`. Frontend coverage is in `frontend/tests/heritage.test.mjs`, `contributions-mobile.mjs`, and `fixtures/contributions.html`. Tests cover lightweight payloads, bounded queries, covers/order, session caches/retry, concurrent reads, action refs and unique keys, one geolocation implementation, busy recovery, immediate eligibility/Passport refresh, fallback loops, and protected storage. The existing contribution privacy/submission/moderation, Heritage, Map, Events, itinerary, auth, Admin and Read Aloud tests remain in the suites.

11. Backend: `cd backend; php artisan test` — 150 tests passed, 1,492 assertions. Database-mutating tests use isolated in-memory SQLite and additive migrations. The environment still emits its pre-existing blocked optional sqlite3 DLL startup warning; PDO SQLite works and the tests pass.

12. Frontend: `cd frontend; npm test` — 177 tests passed, zero failures. Added the test script so the requested command runs the existing Node test suite.

13. Build: `npm run build` passed. Main JS is 487.26 kB / gzip 144.33 kB; Plan 9.74 kB, Site Detail 24.98 kB, Map 32.22 kB, Leaflet 148.76 kB, Admin 87.92 kB, Passport 3.57 kB. Leaflet and heavy views remain separate chunks. The pre-existing unresolved `/images/background/background.png` warning remains.

14. Lint: PHP syntax lint passed for every changed PHP file; changed Node test scripts passed syntax checks. ESLint passes for the changed verification/contribution components, Plan, Site Detail, Home, Events and types. Targeting all changed TypeScript files in the working tree reports 46 existing errors: App 3, API client 8, HeritageChatbot 4, AdminView 31. Full lint reports 56 existing errors and one existing warning, including unrelated components. These are existing state-in-effect, explicit-any and unused-value issues; no new lint error from this pass remains. Full lint does not pass.

15. `git diff --check` passed. Git emits existing Windows line-ending conversion warnings, which are separate from whitespace errors.

16. Plan measurements against `http://127.0.0.1:8000`:

| Request | Before bytes | After bytes | Before HTTP ms | After HTTP ms |
|---|---:|---:|---:|---:|
| `/api/itineraries` | 24,613 | 6,279 | 3,609 | 3,282 |
| `/api/itineraries/1` | 9,773 | 2,350 | 3,496 | 3,195 |

The original browser baseline timed out before reliable route-card timing was recorded; there is no invented before value. During diagnosis, the version before request prioritization showed cards at 8,398 ms. The final live development-browser run showed first cards at 4,083 ms, including frontend startup, and return cards at 40.3 ms. Across first Plan open, itinerary open, leaving and returning, it made one list request and zero detail/revisit requests. Before caching, source inspection confirmed list fetch on every mount and a separate detail fetch. No Leaflet module was requested until View on Map.

17. Site Detail measurements:

| Request | Before bytes/ms | After bytes/ms |
|---|---:|---:|
| `/api/heritage-sites/1` | 1,582 / 2,722 | 1,617 / 2,909 |
| Compatibility availability endpoint | 17 / 2,195 | 17 / 1,948 |
| Public contributions, empty sample for site 1 | 2 / 2,378 | 2 / 2,059 |

The separate availability call is eliminated on updated Site Detail. Before, source inspection showed two secondary reads for guests and three for authenticated visitors. After, live guest Chrome measured one secondary read; production Chrome with controlled authenticated responses measured two (public and personal status). They start independently; public experiences render while status remains pending. Passport is not part of the detail dependency chain. The final live run's contribution response was 2,467 ms. Its detail request was 5,908 ms when queued behind ongoing startup catalogue/events requests, demonstrating the remaining local server constraint. Authenticated status latency against a real user was not measured; that flow was tested with controlled responses.

The read-only in-process diagnostic against the configured live database produced:

| Endpoint | Queries | Request ms | DB query ms |
|---|---:|---:|---:|
| List | 4 | 2,851.35 | 2,786.12 |
| Detail 1 | 4 | 1,643.95 | 1,639.22 |
| Availability 1 | 1 | 422.46 | 417.83 |
| Contributions 1 | 2 | 845.76 | 840.70 |

Those later diagnostic requests reuse the connection within one process and must not be confused with cold HTTP timings. Database connection/query latency dominates; its exact hosting/network cause was not established. Run `cd backend; php tools/measure-public-requests.php` to reproduce this read-only check.

18. Browser checks: live Plan/detail layouts passed at 320, 375, 390, 768 and 1440 pixels; Plan caches and map lazy loading passed. Chrome fixture checks passed at those widths for guests, unverified/verified visitors, Admin moderation and full Site Detail. The full detail fixture reached actual Chrome geolocation with a controlled location and verified the refresh callbacks; unit tests verify the actual App Passport API refresh. Production navigation regression checks retained two guest startup calls and four authenticated startup calls; Home → Explore → Map → Events produced zero repeat catalogue/event/auth calls. Real Google OAuth and extension scripts were not exercised. No CHIS change was made to hide wallet/extension or COOP warnings. Missing local event/background assets and database/server latency remain local concerns, without image retry loops.

19. No new migration is required for this pass. Existing uncommitted Visitor Contributions migrations are preserved; no old migration was edited and no shared database migration was run.

20. No application data or original uploads were deleted. Only isolated test data was used for mutations. Local public storage setup was repaired without changing its target files.

21. The geofence calculation, accuracy gate, transient-coordinate handling, unique visit/reward behavior and first verified visit's 100 points are unchanged. High accuracy, maximumAge 0 and 20-second geolocation timeout remain.

22. Visitor Contribution authorization and moderation are unchanged: backend verified-visit enforcement, route site authority, upload validation, pending/rejected privacy, approved-only public output, Admin authorization and safe managed-file cleanup remain covered by passing tests.

23. QR was not reintroduced. Official content, saved IDs/custom itinerary ordering, full Site Detail, error boundaries/retry/session expiration, Google authentication and Read Aloud behavior are preserved. No feature or UI redesign was added.
