# API authentication

CHIS-SF uses `php-open-source-saver/jwt-auth` 2.9.0 with Laravel 13.
The `api` guard uses JWT and the existing Eloquent User provider. The web session
guard remains available. Protected API routes use `auth:api`; Admin routes also
retain `can:admin`, which checks the current database role on every request.
Roles are not copied into JWT claims.

## Setup

Install locked dependencies with `composer install`. PHP 8.3+ and its Sodium
extension are required. This Windows device's installed Sodium extension was
enabled in its local PHP configuration. Restart an already running PHP server
after enabling an extension or updating configuration.

Set a unique `JWT_SECRET` in the deployment's untracked `.env` (or secret manager).
`php artisan jwt:secret` generates one; treat its console output as sensitive.
This device already has a securely generated secret; it is not in source control.
Do not regenerate it during routine startup: rotation invalidates existing JWTs.
Run `php artisan config:clear` after editing local settings, or rebuild cached
configuration as part of deployment.

Defaults: HS256 signing, 60-minute access token lifetime, 20,160-minute (14-day)
refresh window. Blacklisting is enabled with zero grace period. The package uses
Laravel's configured cache store for revocation; use a persistent shared store
for deployments with multiple servers. This device uses its existing database
cache. Clearing that cache removes revocations; do not routinely clear it while
revoked tokens may still be refreshable. JWT setup needs no new migrations.

## Endpoints and session handling

`POST /api/auth/login`, `/auth/register`, and `/auth/google` return:

```json
{
  "user": {"id": 1, "name": "Visitor", "email": "visitor@example.test", "role": "traveler"},
  "access_token": "<JWT>",
  "token_type": "bearer",
  "expires_in": 3600
}
```

Registration retains automatic sign-in. Google identity validation and account
linking are unchanged; Google sign-in issues the same JWT response. User identity
fields and relationships are preserved.

Send `Authorization: Bearer <access_token>` for protected requests. Tokens in query
strings or request bodies are not accepted. Public listing/detail routes remain
public and the frontend does not attach a token to their requests.

`GET /api/auth/me` resolves the current user. `POST /api/auth/logout` blacklists
the current JWT; other devices' JWTs remain valid. Revocation storage failures
propagate instead of falsely reporting a successful logout. The frontend clears
its token and cached profile immediately, including when logout is offline.

`POST /api/auth/refresh` uses the package's refresh mechanism and blacklists the
previous JWT. It accepts an expired token only within the package's refresh
window; absent, invalid, logged-out, or already refreshed tokens return 401.
The refresh endpoint deliberately does not use the expiry-blocking `auth:api`
middleware; cryptographic verification, refresh lifetime, and blacklist checks
are enforced by the package. Refresh is throttled to ten requests per minute.

`frontend/src/api/client.ts` owns token storage and transport. The JWT is stored
only under the existing localStorage key `chis_jwt_token`; the cached user profile
contains no token. This retains the app's existing hackathon session architecture.
As with any localStorage credential, JavaScript executing on the origin can read
it: prevent XSS and use HTTPS for deployment. Tokens never appear in URLs or logs.

Authenticated 401 responses trigger one shared refresh for concurrent requests
and one retry per original request. Refresh failure or a repeated 401 clears
session state and emits the existing session-expired event. Delayed old responses
cannot replace a newer login or restore a logged-out session. Public requests,
login, and logout do not trigger refresh loops.

Existing Sanctum packages, configuration, User's HasApiTokens trait, and
personal_access_tokens table are retained. Runtime API routes no longer use
Sanctum, and old Sanctum credentials cannot authenticate them. Existing users
must sign in again; no users or token rows are deleted by this migration.

Tests issue real JWTs and reset request-bound guard/token state between requests
to model independent PHP requests. Backend tests use guarded in-memory SQLite
and per-test generated signing secrets, never the shared database or local secret.

## Changed files

- Backend dependencies: `backend/composer.json`, `backend/composer.lock`.
- Backend configuration: `backend/.env.example`, `backend/config/auth.php`,
  `backend/config/jwt.php`, and the untracked local `backend/.env`.
- Authentication: `backend/app/Http/Controllers/AuthController.php`,
  `backend/app/Models/User.php`, `backend/app/Providers/AppServiceProvider.php`,
  `backend/bootstrap/app.php`, `backend/routes/api.php`.
- Frontend: `frontend/src/api/client.ts`, `frontend/tests/auth.test.mjs`.
- Test support: `backend/tests/TestCase.php` and new
  `backend/tests/Feature/JwtAuthenticationTest.php`.
- Existing backend feature tests now issue JWTs: `AdminAuthorizationTest.php`,
  `AdminReassignmentTest.php`, `CsfpHeritageImportTest.php`,
  `HeritageConsistencyTest.php`, `HeritageContributionsTest.php`,
  `HeritageImageUploadTest.php`, `HeritageImagesTest.php`,
  `HeritagePassportTest.php`, `HeritageSiteDeletionTest.php`,
  `HeritageTimelineOrderTest.php`, `HeritageVisitorInformationTest.php`,
  `ItineraryTest.php`, and `LogoutTest.php`.
- Documentation: this file. Local PHP configuration enables Sodium.

No heritage, event, itinerary, contribution, or Passport business controllers
were changed. No production/shared database migrations or data mutations were
used during implementation or validation.
