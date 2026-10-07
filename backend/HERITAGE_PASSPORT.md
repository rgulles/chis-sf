# Heritage passport setup

After review, run `php artisan migrate` manually. No check-in configuration or visit is seeded.

In Admin → Heritage Check-In, choose an approved site. Verify its existing coordinates through Heritage management; set a 25–500 m radius. Generate the initial QR with check-in disabled, download the printable SVG, and place it at the approved location. Explicitly enable check-in when deployment is ready. Disabled/archived sites cannot award visits. Recheck the radius on site before launch.

QR URLs use `VITE_PUBLIC_FRONTEND_URL` when configured at frontend build time, otherwise the current frontend URL (including a deployment subpath). Configure the deployed HTTPS frontend URL, rebuild, and generate production printouts there. Never distribute localhost printouts for production. Token rotation invalidates old printouts; download and replace them. Existing stamps survive rotation.

Visitors use the phone Camera app; no in-app camera scanner is used. The QR opens `/#/check-in/{opaque-token}`. Existing Sanctum login is reused. Public registration creates only traveler accounts and rejects a supplied role. Visitors explicitly request one high-accuracy location fix; there is no background tracking. Production geolocation requires HTTPS and an appropriate geolocation Permissions-Policy; localhost is supported for development.

The backend computes Haversine distance (mean Earth radius 6,371,008.8 m). Raw computed distance must be within the configured radius. Missing accuracy, or reported accuracy exceeding min(radius, 100 m), returns a retry diagnostic; accuracy never enlarges the geofence. Validation allows nullable accuracy but missing accuracy cannot earn a visit. Exact visitor latitude/longitude are transient and are not persisted. Do not enable request-body logging for this endpoint in proxies/APM.

Each user's first verified site visit awards 100 points. User-row locking serializes concurrent awards; a unique(user_id, heritage_site_id) constraint protects the database. Totals are sums of visit points. Previous stamps remain when a site is disabled/archived. Current progress uses only active, enabled sites with usable coordinates; historical visit totals are separately displayed. There is no repeat reward.

Browser-reported geolocation plus a public QR is practical on-site verification, not tamper-proof evidence. Sophisticated GPS spoofing can bypass it. Do not claim fraud-proof verification. Verify real phone accuracy/permissions, the printed QR, radius, HTTPS origin and simultaneous MySQL requests before public launch. Automated tests use isolated SQLite, not shared MySQL.
