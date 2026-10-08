# Heritage Passport and location visit verification

Visitors open an enabled heritage site's detail page, select **Verify My Visit**, sign in if needed, and explicitly request their current location. Signing in leaves the site page available; select Verify My Visit again after login. The browser requests one fresh fix with high accuracy, maximumAge 0, and a 20-second timeout. A successful first visit unlocks a Passport stamp and awards 100 points. Repeated verification returns already_visited, the original date, and zero additional points. Passport refreshes after successful verification.

POST /api/heritage-sites/{heritageSite}/verify-visit requires Sanctum authentication and is throttled to 10 requests/minute. Its body contains only latitude, longitude, and accuracy. The site comes from route binding. Laravel requires an active site, an explicitly enabled configuration, and valid stored coordinates; HeritageGeofence calculates Haversine distance against the configured radius. Accuracy must be present and no greater than min(radius_meters, 100). Accuracy never enlarges the radius. Radius remains configurable from 25–500 meters.

Admin → Visit Verification lets an authorized administrator select sites, enable/disable verification, change radius, and inspect verified visitor counts. Sites are never enabled automatically; inactive sites or sites without valid coordinates cannot be enabled. Existing availability/configuration endpoints keep their /check-in and /admin/check-in-configs names for compatibility; they contain no visitor token workflow. Token resolution, token verification, and rotation routes were removed. Old frontend check-in links show the Not Found fallback and perform no verification.

Exact visitor latitude/longitude exist only in the transient request. They are not persisted in visits, browser storage, URLs, Passport responses, or application logs. Do not enable request-body logging for this endpoint in proxies/APM. Persisted visit fields remain site/user, distance, accuracy, method, date, and points. Visits use geofence now; historical qr_geofence records remain unchanged and included in totals. Totals derive from visits. Per-user transaction locks, locked site/configuration rows, and unique(user_id, heritage_site_id) preserve a single rewarded visit.

## Shared database compatibility

No new migration or manual database change is required when the Passport migration is already applied. The original migration is unchanged. Deprecated public_token (NOT NULL, unique) and token_rotated_at columns are retained. Configuration creation generates an internal random compatibility value solely to satisfy the legacy constraint; neither column is exposed through model JSON. No token is resolved, accepted for verification, printed, rotated, or used for authorization. The original migration's qr_geofence default remains historical schema compatibility; runtime creation explicitly supplies geofence. Existing visits, points, and configurations are preserved. Never run migrate:fresh or truncate the shared database.

## Deployment and limitations

Production geolocation requires HTTPS and a geolocation Permissions-Policy that permits the app's origin. Localhost may work in development. No external geofencing API or Maps API key is required. Production must use APP_DEBUG=false. API server errors are sanitized in production even if debug is accidentally enabled; validation keeps 422 field responses and local development diagnostics remain available.

Location-only geofencing confirms that the browser reports coordinates within the configured site radius. It is **not fraud-proof against sophisticated GPS spoofing**. Protections include authenticated visitors, server-side Haversine calculation, the accuracy threshold, configurable radius, one reward per user/site, database uniqueness, and request throttling.

Test on real phones for permission denial, timeout, weak fixes, HTTPS, and radius suitability before launch. Automated backend tests use isolated in-memory SQLite. Sequential rapid repeats and database uniqueness are tested; concurrent requests against shared production MySQL and real GPS require deployment testing.
