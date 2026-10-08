# Performance optimization measurements

The repository was inspected at origin/main `f839ec0`, with the in-workspace Visitor Contributions implementation retained. No UI redesign, feature removal, dependency installation or database migration was needed for this pass.

Measurements use production builds served by local Vite preview in headless Chrome with deterministic API fixtures. These are measured request counts and bundle sizes, not live-server latency or production database measurements. Development StrictMode can repeat mount effects; the counts below are from the production React build.

| API requests | Before | After |
| --- | ---: | ---: |
| Guest startup at Home | 2 | 2 |
| Authenticated startup at Home | 4 | 4 |
| Guest Home → Explore → Map → Events, additional requests | 6 | 0 |
| Authenticated Home → Explore → Map → Events, additional requests | 9 | 0 |
| Authenticated `/auth/me` requests across startup and these navigations | 4 | 1 |
| Guest Passport requests | 0 | 0 |

Startup loads catalogue and events concurrently in independent effects; authenticated session verification also runs independently. Passport starts after an authenticated user is known and cannot block public content. The previous implementation awaited catalogue completion before starting events and repeated both on every view change.

The in-memory state in App persists during navigation. Separate catalogue/event retry revisions request only the failed resource. Successful Admin mutations refresh the affected public resource; failed multi-step edits also refresh it because earlier requests may already have committed. Authentication responses establish the signed-in user; startup and cross-tab token changes verify the session. Existing session-expiry events, invalid-token cleanup and logout supersession remain intact.

The repository-wide search found one `sf_heritage_sites` occurrence: an unused full-catalogue write. It was removed. Saved heritage/event IDs, custom itinerary IDs, user/session handling and intentional preferences remain unchanged.

| Production JS chunk | Before kB | After kB | After gzip kB |
| --- | ---: | ---: | ---: |
| Main index | 808.03 (224.62 gzip) | 486.56 | 144.05 |
| Map view | Included in main | 32.22 | 9.26 |
| Leaflet runtime | Included in main | 148.76 | 43.39 |
| Admin | Included in main | 87.92 | 17.19 |
| Site Detail, including Visitor Experiences | Included in main | 23.83 | 7.32 |
| Events | Included in main | 12.48 | 3.39 |
| Plan | Included in main | 9.65 | 3.32 |
| Passport | Included in main | 3.57 | 1.38 |

Sizes are Vite's decimal kB output for individual chunks, not total site download sizes. Shared runtime/icon chunks are additional. Main CSS changed from 117.16 kB (23.50 gzip) to 101.03 kB (16.74 gzip); Leaflet's 15.09 kB CSS (6.36 gzip) loads with its runtime. The existing unresolved footer background warning remains.

React lazy/Suspense keeps heavy views outside startup. Explore still uses the existing combined directory/map design, but Leaflet and boundary/tile loading begin only when its Map mode is selected. Plan's map component is also deferred until requested. Production browser checks verify Home loads no Map, Leaflet, Admin, Passport view or Site Detail chunk; Explore does not load Leaflet; Map initializes real Leaflet; authorized Admin and full Site Detail render after navigation.

The public catalogue previously serialized all site fields plus all images and timelines. It now returns `id`, `name`, `category`, `year_built`, `address`, `latitude`, `longitude`, `status`, a description summary of at most 240 characters plus an ellipsis, and `cover_image` (or null). The cover relationship selects explicit `is_cover` first, then `sort_order ASC, id ASC`, and eager-loads one image per site. It never loads galleries or timelines for the index. Detail and protected Admin retrieval retain complete content and ordered relationships.

A repeatable in-memory SQLite fixture with five sites, twenty official images and ten timeline entries measured **27,848 bytes before versus 2,629 bytes after** (uncompressed JSON). The previous response was reconstructed using the original controller query on the same fixture. The new index executes **two queries** regardless of fixture site count and returns no historical text, visitor information, Admin fields, full galleries or timelines. No speculative index was added. Existing event schedule eager loading and contribution user/image eager loading were reviewed and retained.

Search uses a debounced summary endpoint query only while the search dialog is open, preserving matches in full recorded descriptions/history without globally downloading those texts. Stale search responses are ignored. The local chatbot retrieves full detail only when a question identifies a summary site, preserving its recorded history, timeline and visitor-information answers.

Opening `/#/heritage/1` in the measured browser fixture makes the full detail request, existing check-in availability request and that site's contribution request; authenticated visitors additionally request their own contribution status. Contributions are absent from startup and unrelated-site requests. Recommended itineraries continue loading on Plan, and successful visit verification continues refreshing Passport.

Original uploads remain unchanged. Gallery and contribution images retain lazy loading and now have explicit dimensions plus asynchronous decoding; itinerary stop images are lazy with reserved dimensions. Existing CSS provides fixed image containers. The repository has no existing thumbnail generation/backfill pipeline or image processing package. Thumbnail derivatives are a future improvement that would need a separate storage/backfill design; this pass adds no processing dependency and preserves uploaded originals.

Validation:

```sh
cd backend
php artisan test
cd ../frontend
node --test tests/*.test.mjs
npm run build
node tests/contributions-mobile.mjs --performance --assert-optimized
node tests/contributions-mobile.mjs
```

The browser script accepts `CHIS_TEST_CHROME` to override the Chromium executable and uses local, mocked APIs. Backend tests use isolated in-memory SQLite with additive migration commands. Performance tests cover independent startup, navigation request reuse, retries, session events, summary mapping, bounded cover queries, full detail, history search, on-demand Leaflet, and existing heritage/map/events/itinerary/passport/verification/contribution/admin/auth/read-aloud regressions.
