# San Fernando visitor plans

Run only the dedicated, create-only seeder:

```sh
cd backend
php artisan db:seed --class=SanFernandoItinerarySeeder
```

Ten editorial self-guided plans use existing active heritage records. The existing
`name`, `description`, `status`, `source_key`, and ordered stop relationships are
sufficient; no migration is needed. `active` is the existing public/published
status. Theme, duration, meeting location, timed activities, transfers, lunch,
rest, and access notes are readable text in `description`, not new API fields.
The public UI reuses existing stop cover/first images; the schema has no itinerary
cover or cost field. No files are copied, no fees are asserted, and no storage
configuration changes are made.

The seeder validates all schedules and all unique active site-name matches before
writing in one transaction. Source keys prevent duplicate imports. Existing source
keys and matching names are skipped without updates, including subsequent Admin
edits. A missing, ambiguous, archived, or non-San-Fernando destination aborts the
entire run. Concurrent imports are protected by the existing unique source-key
constraint; a conflicting run rolls back and can be rerun safely.

## Geographic and access decisions

Downtown routes group the station, Capitol/Santo Niño area, and Consunji/Tiomico/
Santo Rosario streets. Vehicle transfers are budgeted for Del Pilar and the Giant
Lantern Center at the former Paskuhan Village site in San Jose. Travel times are
planning buffers, not measured traffic forecasts. No Angeles or La Union sites
are included. Calulut is omitted from the half-day religious route because it is
farther from the central-city cluster.

House stops use public exterior observation. Religious institutions require
permission, and worship takes precedence. Confirm the station and lantern-center
access with City Tourism, including maintenance restrictions. No year-round
festival performance or unbooked lantern workshop is promised. The religious
plan requires pre-contact with the archdiocese and seminary; if access cannot be
confirmed visitors should choose another plan. Times are proposed visiting times,
not verified operating hours. Food and transport purchases are separate.

## Sources checked on 10 October 2026

- [City history](https://cityofsanfernando.gov.ph/history/): railway memory and civic context.
- [NHCP station registry](https://philhistoricsites.nhcp.gov.ph/registry_database/himpilang-daang-bakal-ng-san-fernando/): railway and Death March context.
- [NHCP Lazatin House registry](https://philhistoricsites.nhcp.gov.ph/registry_database/lazatin-house/): existing heritage house in San Fernando.
- [NHCP Pampanga registry](https://philhistoricsites.nhcp.gov.ph/labels/pampanga/) and [Tourism Promotions Board itinerary](https://www.tpb.gov.ph/wp-content/uploads/2023/12/Itinerary_Lots-1-5.pdf): documented downtown ancestral-house route, including Consunji, Henson-Hizon, and Hizon-Singian.
- [NHCP Honorio Ventura marker](https://philhistoricsites.nhcp.gov.ph/registry_database/honorio-ventura-1887-1940/): Arnedo Park in the capitol area.
- [City 2026 monument procurement](https://cityofsanfernando.gov.ph/wp-content/uploads/2026/02/2026-02-00164.pdf): Baluyut Bridge in Santo Rosario and the Nicolasa Dayrit monument beside Henson-Hizon House.
- [City citizens charter](https://cityofsanfernando.gov.ph/wp-content/uploads/2023/09/CITY-GOVERNMENT-OF-SAN-FERNANDO-4th-ed-2023.pdf): Tourism Office arrangements for educational/group visits.
- [City 2026 procurement plan](https://cityofsanfernando.gov.ph/wp-content/uploads/2026/06/LGU-CSFP-ANNUAL-PROCUREMENT-PLAN-2026.pdf): Giant Lantern Tourism Information Center at Paskuhan, San Jose; includes maintenance work, so visitor access needs confirmation.
- [City festival document](https://cityofsanfernando.gov.ph/wp-content/uploads/2024/09/2024-08-01473.pdf): local lantern tradition and seasonal festival context.
- [BCDA Clark magazine](https://bcda.gov.ph/sites/default/files/2021-03/Clark%20Magazine.pdf): Everybody’s Cafe and Kapampangan food in San Fernando. No current menu or opening hours are inferred.
- [Archdiocese 2025 appointments](https://trcasf.com/wp-content/uploads/2025/05/2025-CL-24-Pastoral-Appointments-attachment.pdf): cathedral, archdiocesan, and Mother of Good Counsel Seminary institutions.
- [City Market Operations Division](https://cityofsanfernando.gov.ph/city-market-operations-division/) and [DA regional market inspection](https://rfo3.da.gov.ph/index.php/market-visit-and-compliance-inspection-with-eo-118-s-2026-sa-pamilihan-ng-lungsod-ng-san-fernando-pampanga-isinagawa/): city market context. Office hours are not used as stall hours.

## Destinations deliberately not linked

- No record named `Museo ning Kapampangan` exists in the current catalog. No duplicate museum record was created.
- `Archdiocesan Museum and Archives` lists a San Jose address in CHIS, while the [University of the Assumption directory](https://web.ua.edu.ph/telephone-directory/) places its university campus in Unisite, Del Pilar. Location and appointment arrangements need review before inclusion; Heritage data was left unchanged.
- The generic `Lantern Making in the City of San Fernando` record is archived and has no coordinates. It was not used as a verified workshop stop. The active Giant Lantern Center is used with explicit prior-access confirmation.
- No stand-alone invented lunch, craft studio, or meeting-point heritage records were created. Meal/rest/transfer slots live in description; only actual destinations become stop rows.

## Local integration verification

The initial run inserted 10 active itineraries and 50 ordered stop links. A second
run inserted zero and preserved all 10. Hash comparisons confirmed that the three
pre-existing itineraries, their stops, and the heritage, image, timeline, user,
and event tables remained unchanged. Public/API ordering and Admin mutations are
covered by isolated SQLite tests. A read-only headless browser check using exported
local API data verified all 10 public descriptions, stop order, site-selection
actions, and full Admin editing text at 320, 375, 390, 768, 1024, and 1440 pixels,
without page or modal horizontal overflow. No live Admin save was needed.
