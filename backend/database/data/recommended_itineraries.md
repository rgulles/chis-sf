Recommended itinerary preparation
=================================

`recommended_itineraries.json` is backend-only initial curation metadata. Its
three suggested routes and place names come from the owner's Feature 2 request.
The short route introductions are CHIS planning copy, not Tourism Office history
or claims of official walking routes. Site descriptions, images, addresses and
coordinates are never copied into the itinerary tables or frontend constants.

After reviewing the additive migration, run manually from `backend/`:

    php artisan migrate
    php artisan itinerary:seed-recommended --dry-run
    php artisan itinerary:seed-recommended --apply --created-by=<admin-id>

The command defaults to dry run. It resolves only existing active heritage sites
by case/whitespace-normalized exact names and explicit aliases. Missing or
ambiguous site names are reported and omitted; a route with no resolved stops is
skipped. Review partial routes before applying. There is no fuzzy matching.

Existing itinerary source keys or matching names are preserved in full, including
Admin-edited names/descriptions/status/stop order. The nullable unique source_key
keeps a renamed seeded route identifiable; it is internal metadata, not a lock.
The command never restores archived routes or overwrites existing route content.
No heritage-site writes are performed. No shared-database migration or seed is
run automatically by this feature.

Public APIs show active itineraries with ordered live, active heritage stops only.
Archived site references remain available to Admin and can be retained/removed,
but cannot be added as new stops. DELETE archives itineraries and keeps stops.

Custom plans are local to the browser under `sf_custom_itinerary`, storing ordered
string database IDs only. Loading/network failures preserve stored IDs; a successful
catalogue load removes archived/deleted/stale references. Directions are per stop.
Map previews show verified coordinates only; there is no routing or ETA service.
