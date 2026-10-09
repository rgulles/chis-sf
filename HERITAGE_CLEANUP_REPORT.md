CHIS-SF focused heritage cleanup ? 9 October 2026

Application changes are implemented. Official detail reconciliation is pending: only docs/CHIS-SF.pdf is present locally; CHIS-SF(1).pdf has not been supplied. The name audit uses the user's explicit 39-entry Heritage District list. OFFICIAL_MATCH and OFFICIAL_ALIAS verify names against that list, not the replacement PDF's detail fields. No historical text, coordinates or visitor facts were invented or overwritten.

1. Current inventory: the initial database snapshot had 37 heritage rows. The final snapshot has 38 (36 active, 2 archived); an additional active Test record, ID 38, appeared between read-only snapshots. All initial 37 rows' audited fields and all 18 itinerary references remain unchanged. Import metadata has 35 location entries; the old prototype had 9 records. Runtime catalogue, maps, guide and itinerary site data come from Laravel/MySQL.

2. Official matches: 34 distinct listed location identities are represented. The DB audit reports 29 OFFICIAL_MATCH rows, 4 OFFICIAL_ALIAS rows, 2 rows in one DUPLICATE group, 3 NOT_IN_OFFICIAL_SOURCE rows, and one MISSING_FROM_DATABASE entry. The 35 metadata entries produce 29 matches, 5 aliases and one REVIEW_REQUIRED Cuyugan entry.

3. Aliases: recognition now covers the Cathedral names and the supplied house/residence and Giant Lantern variants. Four name changes are prepared for IDs 22, 25, 30 and 36. No DB name correction was applied. The Cathedral alias cannot be corrected automatically while two records represent its identity.

4. Unsupported records: Test IDs 2 and 37 were already archived. New active Test ID 38 is flagged for reviewed archival; it contains Test text, visitor values of 10, and coordinates 10,10. It was left untouched. The old standalone PASUDECO Sugar Central prototype is absent from the listed locations; do not conflate it with Megaworld Capital Town. Other embellished prototype names require manual identity review.

5. Duplicates: active Cathedral IDs 1 and 18 resolve to the same listed identity. Their addresses, histories, dates and coordinate pairs differ. ID 18 is referenced in an itinerary. Preserve both IDs and all relationships until an admin resolves their identity and factual conflicts; no merge or deletion occurred.

6. Missing official records: the grouped Cuyugan house / Vivencio Cuyugan monument entry is absent from the DB. It must be reviewed before creating any physical record. National Heroes, Local Heroes, Kalesa Tour and Lantern Making remain excluded from the location catalogue; no separate experience model was introduced.

7. Manual review: Cuyugan house/monument identity and coordinates; the duplicate Cathedral records; the replacement PDF's descriptions, histories, addresses, dates and registry statements; and active Test ID 38. All DB detail fields and existing coordinates are captured for review in OFFICIAL_HERITAGE_DRY_RUN.json. Six embellished legacy identities are marked REVIEW_REQUIRED in backend/database/data/legacy_heritage_audit.json.

8. Official details populated/cleaned: no runtime historical/address/date/registry changes were made because the requested replacement PDF is missing and runtime apply was expressly prohibited. Existing import narratives were preserved. The new official name index contains only names, aliases and exclusions, with an explicit provenance limitation; it does not supply details or coordinates. Field-by-field source verification and source-backed detail corrections remain outstanding.

9. Detail cleanup: verified that About, history, Admin timeline, official image gallery and populated visitor fields are conditional. Hero image now precedes category/identity. Fake plaque, duration, best-time, guide, household-vault, etiquette, audio-story, panorama, scan-count and site-badge metadata were removed from the live types. No fake character, did-you-know or annotation section is rendered. Real API compatibility fields that map to empty arrays remain. The 9 prototype records are preserved in backend/database/data/legacy_heritage_prototype_archive.json; the frontend compatibility export is empty and cannot act as a catalogue fallback. Uploaded images, contributions, visits and Passport relationships were not changed.

10. Katulung problems: every lookup dumped all fields; matching relied on broad name/category words; ambiguity was unhelpful; the interface claimed unsupported languages; persistent replies could become stale; mobile used a desktop-sized window and excessive decorative animation.

11. Katulung fixes: honest KATULUNG / San Fernando Heritage Guide branding; deterministic history, address, hours, fee, directions, category, catalogue and visit-planning answers; canonical aliases and unique name tokens; up to five explicit choices for ambiguous records; no guessing on generic house/city/san/fernando/heritage words; explicit missing-data responses; active records only; no popularity or translation claim and no paid/external LLM. This-site questions can use the currently open detail record. Full detail is requested only after a summary match. Replies stay in component memory, and choices open the selected record by ID.

12. Directions cleanup: removed all hardcoded jeepney/tricycle prices, Manila/Clark durations, terminal/drop-off suggestions and the primary Google Maps navigation link. There is no external maps link in the new flow.

13. Internal routing: Site Detail, Directory, main Map card and Katulung reuse one lazy DirectionsModal/DirectionsPanel. Geolocation runs only after USE MY CURRENT LOCATION. It uses high accuracy, a 12-second location timeout and a 30-second maximum age, and handles permission denial, unavailable position, timeout, insecure context and unsupported browsers. Destination information comes from the saved site record. OSRM uses VITE_OSRM_BASE_URL or https://router.project-osrm.org and /route/v1/driving/startLon,startLat;destLon,destLat?overview=full&geometries=geojson&steps=true.

14. Metrics: distance and duration come from the validated OSRM response. Formats include 650 m, 4.8 km, 12 min and 1 hr 15 min. The label is Estimated driving time; live traffic is not claimed.

15. Route steps: OSRM legs/steps are parsed and formatted from returned maneuver type, modifier, road name and distance. Missing names use neutral Continue for ? guidance. The turn list scrolls independently. Leaflet renders the returned road geometry, start/current-location and destination markers, and fits bounds to include both markers and the road. Failure keeps the markers, shows Road directions are temporarily unavailable., and renders neither a straight-line route nor fabricated metrics. This is a preview, not live GPS navigation.

16. Privacy: routing coordinates are never sent to CHIS APIs, profiles, analytics, localStorage or sessionStorage. They and the local route cache are discarded on close/unmount. The UI states Your location is used to calculate this route and is not saved by CHIS, and explicitly says the routing service receives coordinates. External routing fetches omit credentials and referrer information.

17. Responsiveness: headless Chrome passed at 320, 375, 390, 768, 1024 and 1440px for Site Detail, Katulung header/close/input, Directions header, map, turn list, Directory cards, main Map and selected card. No horizontal overflow or browser console errors were found. Map stacking is isolated, and hit-testing confirmed that map controls cannot cover the Directions close button at any tested width. Mobile guide and Directions use nearly full-screen panels; map height is at least 280px. Guide messages scroll independently and visualViewport handling keeps the input in the visible mobile viewport where supported. Physical keyboard/browser behavior still needs phone testing.

18. Performance/network: DirectionsPanel, OSRM and RouteMap/Leaflet are separate lazy chunks. No routing request runs before a successful explicit location fix. Visitor routes cache only inside the modal, keyed by rounded start coordinates plus destination. Closing aborts routing, clears the cache and ignores late geolocation/results. New requests supersede old ones; a changed destination ID or coordinates remounts the panel. OSRM has a 15-second timeout and public-demo pacing. Main-map Leaflet loads only for the map view. Browser routing tests use controlled fixtures; public OSRM availability and phone GPS were not live-tested.

19. Tests: php artisan test passed 161 tests (1,599 assertions); npm test passed 222 tests. Added official matching/exclusion/alias/duplicate/unsupported tests, safe default dry-run, explicit reviewed archival, stale fingerprint protection and preservation checks. Added guide intent/category/ambiguity/context tests and location/routing/geometry/steps/failure/close/stale/privacy tests. PHP database tests explicitly guard in-memory SQLite and use plain migrate, not migrate:fresh; S3 is isolated to fake test storage. Browser check: cd frontend; node tests/heritage-cleanup-browser.mjs.

20. Build: npm run build passed. DirectionsPanel, OSRM and Leaflet stayed split from startup. Fixed the existing Admin form callback TypeScript errors with a narrow form-state type. One existing background-image resolution warning remains for /images/background/background.png.

21. Lint: 12 focused changed frontend source files passed ESLint with zero errors/warnings. App.tsx retains the same 3 pre-existing effect-state lint errors as HEAD; AdminView.tsx has 21 existing errors versus 22 at HEAD (no-explicit-any and effect-state rules). No new lint errors were introduced. Changed PHP files passed Laravel Pint.

22. git diff --check: passed; only Git's Windows LF/CRLF conversion notices appeared. New text artifacts are UTF-8.

23. Database safety: no runtime database reset, migrate:fresh, runtime migration, reconciliation apply, destructive deletion or production/demo data cleanup was run. The explicit apply code was tested only on synthetic in-memory fixtures. All runtime heritage commands were read-only.

24. QR: no QR was added or restored.

25. Tomorrow's phone checks: Android Chrome and iOS Safari over HTTPS; allow/deny/revoke geolocation; weak GPS and timeout; actual public OSRM/network failure; road snap and destination correctness after coordinate review; keyboard-open input visibility at 320/375/390, safe areas, independent scrolling, close/back/focus behavior and map gestures. Supply CHIS-SF(1).pdf for the remaining official field audit, then review Cathedral/Cuyugan and the new Test row before any explicit apply.

Safe commands from backend:

```text
php artisan heritage:audit-official
php artisan heritage:audit-official --json
php artisan heritage:reconcile-official --dry-run
```

Only after reviewing a fresh preview, a real admin may run the following. This pass did not run it:

```text
php artisan heritage:reconcile-official --apply --created-by=ADMIN_ID --reviewed-fingerprint=FINGERPRINT_FROM_FRESH_DRY_RUN
```

The fingerprint includes the name index and catalogue snapshot. New or changed rows invalidate a previous preview. Apply only archives unsupported active records and corrects unambiguous aliases; it never deletes, rewrites historical/visitor detail, creates missing sites or resolves duplicates. OFFICIAL_RECONCILE_DRY_RUN.txt contains the final preview (four name changes and archival of active Test ID 38).

Complete DB name audit (snapshot: 38 records):

| DB ID | Current Name | Official Match | Status | Recommended Action |
| --- | --- | --- | --- | --- |
| 1 | San Fernando Cathedral | Metropolitan Cathedral of San Fernando, Pampanga | DUPLICATE | Manual duplicate review; preserve IDs and all relationships. Do not merge or delete automatically. |
| 2 | Test | ? | NOT_IN_OFFICIAL_SOURCE | Already archived; preserve record and relationships. Never delete. |
| 3 | Heroes Hall and Heroes Park | Heroes Hall and Heroes Park | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 4 | Pampanga Provincial Capitol | Pampanga Provincial Capitol | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 5 | Arnedo Park | Arnedo Park | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 6 | Megaworld Capital Town | Megaworld Capital Town | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 7 | Presidio (Pampanga Provincial Jail) | Presidio (Pampanga Provincial Jail) | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 8 | Santungan ning Kulturang Kapampangan | Santungan ning Kulturang Kapampangan | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 9 | Death March Marker | Death March Marker | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 10 | San Fernando Train Station | San Fernando Train Station | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 11 | Lazatin House | Lazatin House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 12 | Consunji House | Consunji House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 13 | Tabacalera House | Tabacalera House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 14 | Hizon-Ocampo House | Hizon-Ocampo House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 15 | Hizon-Singian House | Hizon-Singian House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 16 | Augusto P. Hizon House | Augusto P. Hizon House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 17 | Pampanga Hotel | Pampanga Hotel | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 18 | Metropolitan Cathedral of San Fernando | Metropolitan Cathedral of San Fernando, Pampanga | DUPLICATE | Manual duplicate review; preserve IDs and all relationships. Do not merge or delete automatically. |
| 19 | City Hall of San Fernando | City Hall of San Fernando | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 20 | City Market Plaza | City Market Plaza | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 21 | Baluyut Bridge | Baluyut Bridge | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 22 | Dayrit-Galang House | Dayrit-Galang Residence | OFFICIAL_ALIAS | Review canonical name correction; preserve record ID and relationships. |
| 23 | Hizon-Paras House | Hizon-Paras House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 24 | Henson-Hizon House | Henson-Hizon House | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 25 | Datu-Bundalian House | Datu-Bundalian Residence | OFFICIAL_ALIAS | Review canonical name correction; preserve record ID and relationships. |
| 26 | San Fernando Leaning Water Tower | San Fernando Leaning Water Tower | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 27 | Pampanga High School | Pampanga High School | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 28 | San Fernando Elementary School | San Fernando Elementary School | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 29 | Arzobispado de Pampanga | Arzobispado de Pampanga | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 30 | Dayrit-Cuyugan House | Dayrit-Cuyugan Residence | OFFICIAL_ALIAS | Review canonical name correction; preserve record ID and relationships. |
| 31 | Monumento Fernandino | Monumento Fernandino | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 32 | Everybody's Cafe | Everybody's Cafe | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 33 | Mother of Good Counsel Seminary | Mother of Good Counsel Seminary | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 34 | Archdiocesan Museum and Archives | Archdiocesan Museum and Archives | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 35 | Heritage Parochial Church, Complex of San Vicente Ferrer | Heritage Parochial Church, Complex of San Vicente Ferrer | OFFICIAL_MATCH | Preserve; compare detail fields with supplied replacement PDF before changes. |
| 36 | City of San Fernando Giant Lantern and Tourist Information Center | City of San Fernando Giant Lantern Center | OFFICIAL_ALIAS | Review canonical name correction; preserve record ID and relationships. |
| 37 | Test | ? | NOT_IN_OFFICIAL_SOURCE | Already archived; preserve record and relationships. Never delete. |
| 38 | Test | ? | NOT_IN_OFFICIAL_SOURCE | Review then archive; preserve images, contributions, visits and itinerary history. Never delete. |
| ? | ? | Cuyugan House | MISSING_FROM_DATABASE | Manual Cuyugan house/monument review before creating any location. |

Complete import-metadata name audit:

| Source # | Metadata Name | Official Match | Status |
| --- | --- | --- | --- |
| 1 | Heroes Hall and Heroes Park | Heroes Hall and Heroes Park | OFFICIAL_MATCH |
| 4 | Pampanga Provincial Capitol | Pampanga Provincial Capitol | OFFICIAL_MATCH |
| 5 | Arnedo Park | Arnedo Park | OFFICIAL_MATCH |
| 6 | Megaworld Capital Town | Megaworld Capital Town | OFFICIAL_MATCH |
| 7 | Presidio (Pampanga Provincial Jail) | Presidio (Pampanga Provincial Jail) | OFFICIAL_MATCH |
| 8 | Santungan ning Kulturang Kapampangan | Santungan ning Kulturang Kapampangan | OFFICIAL_MATCH |
| 9 | Death March Marker | Death March Marker | OFFICIAL_MATCH |
| 10 | San Fernando Train Station | San Fernando Train Station | OFFICIAL_MATCH |
| 11 | Lazatin House | Lazatin House | OFFICIAL_MATCH |
| 12 | Consunji House | Consunji House | OFFICIAL_MATCH |
| 13 | Tabacalera House | Tabacalera House | OFFICIAL_MATCH |
| 14 | Hizon-Ocampo House | Hizon-Ocampo House | OFFICIAL_MATCH |
| 15 | Hizon-Singian House | Hizon-Singian House | OFFICIAL_MATCH |
| 16 | Augusto P. Hizon House | Augusto P. Hizon House | OFFICIAL_MATCH |
| 17 | Pampanga Hotel | Pampanga Hotel | OFFICIAL_MATCH |
| 18 | Metropolitan Cathedral of San Fernando | Metropolitan Cathedral of San Fernando, Pampanga | OFFICIAL_ALIAS |
| 19 | City Hall of San Fernando | City Hall of San Fernando | OFFICIAL_MATCH |
| 20 | City Market Plaza | City Market Plaza | OFFICIAL_MATCH |
| 21 | Baluyut Bridge | Baluyut Bridge | OFFICIAL_MATCH |
| 22 | Baron-Cuyugan House | Cuyugan House | REVIEW_REQUIRED |
| 23 | Dayrit-Galang House | Dayrit-Galang Residence | OFFICIAL_ALIAS |
| 24 | Hizon-Paras House | Hizon-Paras House | OFFICIAL_MATCH |
| 25 | Henson-Hizon House | Henson-Hizon House | OFFICIAL_MATCH |
| 26 | Datu-Bundalian House | Datu-Bundalian Residence | OFFICIAL_ALIAS |
| 27 | San Fernando Leaning Water Tower | San Fernando Leaning Water Tower | OFFICIAL_MATCH |
| 28 | Pampanga High School | Pampanga High School | OFFICIAL_MATCH |
| 29 | San Fernando Elementary School | San Fernando Elementary School | OFFICIAL_MATCH |
| 30 | Arzobispado de Pampanga | Arzobispado de Pampanga | OFFICIAL_MATCH |
| 31 | Dayrit-Cuyugan House | Dayrit-Cuyugan Residence | OFFICIAL_ALIAS |
| 32 | Monumento Fernandino | Monumento Fernandino | OFFICIAL_MATCH |
| 33 | Everybody's Cafe | Everybody's Cafe | OFFICIAL_MATCH |
| 34 | Mother of Good Counsel Seminary | Mother of Good Counsel Seminary | OFFICIAL_MATCH |
| 35 | Archdiocesan Museum and Archives | Archdiocesan Museum and Archives | OFFICIAL_MATCH |
| 36 | Heritage Parochial Church, Complex of San Vicente Ferrer | Heritage Parochial Church, Complex of San Vicente Ferrer | OFFICIAL_MATCH |
| 37 | City of San Fernando Giant Lantern and Tourist Information Center | City of San Fernando Giant Lantern Center | OFFICIAL_ALIAS |

All 18 itinerary stops reference represented official identities. The Cathedral stop references duplicate-group ID 18; none references the Test rows. The old prototype-name audit and full quarantined records are separate backend JSON artifacts for review.
