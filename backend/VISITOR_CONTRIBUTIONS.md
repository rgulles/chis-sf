# Visitor Contributions

Apply the additive migration with `php artisan migrate`. Existing migrations and heritage/visit records are unchanged. Use the existing public storage link (`php artisan storage:link`) and ensure the web server and PHP request upload limits permit three 5 MB photos per request.

Site Detail displays approved Visitor Experiences separately from the official gallery. A signed-in visitor can share only after an existing `heritage_visits` row with a non-null `verified_at` for that exact route site. The backend checks this independently of UI eligibility. It accepts 1–3 JPEG, PNG or WebP photos (5 MB each) and an optional plain text caption (500 characters).

One contribution is allowed per visitor/site, enforced by a unique database index and serialized submission. Pending and approved submissions return 409 on duplicate submission. A rejected submission replaces its photos and caption in the same row, clears moderation fields and returns to pending. Public APIs omit pending/rejected content and visitor email, IDs, auth, visit and moderation details.

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/heritage-sites/{heritageSite}/contributions` | Public, approved only, active sites |
| GET | `/api/heritage-sites/{heritageSite}/contributions/mine` | Sanctum, own status and eligibility |
| POST | `/api/heritage-sites/{heritageSite}/contributions` | Sanctum, verified visit, active site, 5 attempts/minute |
| GET | `/api/admin/contributions?status=pending` | Sanctum + admin; pending/approved/rejected filters |
| PATCH | `/api/admin/contributions/{contribution}` | Sanctum + admin; `{ "status": "approved" }` or `rejected` |
| DELETE | `/api/admin/contributions/{contribution}` | Sanctum + admin; remove contribution and managed photos |

The existing Admin panel includes a Visitor Contributions tab for review. Rejecting published content removes it from public results; deleting it also removes unreferenced managed files. Photos live in `visitor-contributions/` on the public disk, following the project's storage convention. These URLs are unlisted for pending/rejected content, not access-controlled media. Uploads never enter the official heritage gallery. Cleanup accepts only generated flat contribution filenames, checks remaining contribution and official-image references, and runs after the database change commits. A failed upload/database operation rolls back changes and cleans up newly stored files.

Validation:

```sh
cd backend
php artisan test
cd ../frontend
node --test tests/*.test.mjs
npm run build
node tests/contributions-mobile.mjs
```

The browser test uses Chrome (override its executable with `CHIS_TEST_CHROME` on other systems), a local Vite server and mocked APIs. It checks real components for page/control/image overflow at 320, 375, 390, 768 and 1440 pixels in guest, unverified, verified and admin states, plus upload submission and approve/reject actions. Backend tests use only isolated in-memory SQLite and additive migration commands.
