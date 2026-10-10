<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class JwtAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $app = parent::createApplication();
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.url', null);
        $app['config']->set('database.connections.sqlite.database', ':memory:');

        return $app;
    }

    protected function migrateDatabases()
    {
        if (config('database.default') !== 'sqlite'
            || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url') !== null) {
            throw new \LogicException('JWT tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function bearer(string $token): array
    {
        return ['Authorization' => 'Bearer '.$token];
    }

    public function test_login_returns_signed_jwt_and_current_user(): void
    {
        $user = User::factory()->create(['password' => 'test-password']);
        $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'test-password'])
            ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonPath('token_type', 'bearer')
            ->assertJsonPath('expires_in', 3600)->assertJsonMissingPath('user.password');
        $token = $response->json('access_token');
        $this->assertCount(3, explode('.', $token));
        $this->getJson('/api/auth/me', $this->bearer($token))->assertOk()->assertJsonPath('user.id', $user->id);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_invalid_credentials_and_missing_fields_are_rejected(): void
    {
        $user = User::factory()->create();
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnauthorized();
        $this->postJson('/api/auth/login', [])->assertUnprocessable();
    }

    public function test_registration_returns_jwt_and_cannot_set_admin_role(): void
    {
        $data = ['name' => 'Visitor', 'email' => 'visitor@example.test', 'password' => 'test-password'];
        $this->postJson('/api/auth/register', $data + ['role' => 'admin'])->assertUnprocessable();
        $response = $this->postJson('/api/auth/register', $data)->assertCreated()->assertJsonPath('user.role', 'traveler');
        $this->getJson('/api/auth/me', $this->bearer($response->json('access_token')))->assertOk();
    }

    public function test_admin_access_requires_jwt_and_current_database_role(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $headers = $this->bearer($this->jwtFor($user));
        $this->getJson('/api/admin/travelers')->assertUnauthorized();
        $this->getJson('/api/admin/travelers', $headers)->assertOk();
        $user->update(['role' => 'traveler']);
        $this->getJson('/api/admin/travelers', $headers)->assertForbidden();
        $this->getJson('/api/auth/me', $headers)->assertJsonPath('user.role', 'traveler');
    }

    public function test_visitor_endpoints_require_jwt_and_public_routes_remain_public(): void
    {
        foreach (['/api/auth/me', '/api/passport', '/api/heritage-sites/1/contributions/mine'] as $uri) {
            $this->getJson($uri)->assertUnauthorized();
        }
        $this->postJson('/api/heritage-sites/1/contributions', [])->assertUnauthorized();
        $this->postJson('/api/heritage-sites/1/verify-visit', [])->assertUnauthorized();
        $this->getJson('/api/passport', $this->bearer($this->jwtFor(User::factory()->create())))->assertOk();
        foreach (['/api/heritage-sites', '/api/events', '/api/itineraries'] as $uri) {
            $this->getJson($uri)->assertOk();
        }
    }

    public function test_invalid_expired_tampered_and_url_tokens_are_rejected(): void
    {
        $user = User::factory()->create();
        $token = $this->jwtFor($user);
        $this->getJson('/api/auth/me', $this->bearer('invalid'))->assertUnauthorized();
        $this->getJson('/api/auth/me', $this->bearer($token.'tampered'))->assertUnauthorized();
        $this->getJson('/api/auth/me?token='.$token)->assertUnauthorized();
        $this->travel(61)->minutes();
        $this->getJson('/api/auth/me', $this->bearer($token))->assertUnauthorized();
    }

    public function test_refresh_rotates_token_and_revokes_the_previous_token(): void
    {
        $user = User::factory()->create();
        $old = $this->jwtFor($user);
        $response = $this->postJson('/api/auth/refresh', [], $this->bearer($old))->assertOk()
            ->assertJsonPath('token_type', 'bearer')->assertJsonPath('user.id', $user->id);
        $new = $response->json('access_token');
        $this->assertNotSame($old, $new);
        $this->getJson('/api/auth/me', $this->bearer($old))->assertUnauthorized();
        $this->postJson('/api/auth/refresh', [], $this->bearer($old))->assertUnauthorized();
        $this->getJson('/api/auth/me', $this->bearer($new))->assertOk();
    }

    public function test_expired_token_can_refresh_only_inside_refresh_window(): void
    {
        $old = $this->jwtFor(User::factory()->create());
        $this->travel(61)->minutes();
        $this->getJson('/api/auth/me', $this->bearer($old))->assertUnauthorized();
        $new = $this->postJson('/api/auth/refresh', [], $this->bearer($old))->assertOk()->json('access_token');
        $this->getJson('/api/auth/me', $this->bearer($new))->assertOk();
        $this->travel(15)->days();
        $this->postJson('/api/auth/refresh', [], $this->bearer($new))->assertUnauthorized();
    }

    public function test_missing_invalid_and_logged_out_tokens_cannot_refresh(): void
    {
        $this->postJson('/api/auth/refresh')->assertUnauthorized();
        $this->postJson('/api/auth/refresh', [], $this->bearer('invalid'))->assertUnauthorized();
        $headers = $this->bearer($this->jwtFor(User::factory()->create()));
        $this->postJson('/api/auth/logout', [], $headers)->assertOk();
        $this->postJson('/api/auth/refresh', [], $headers)->assertUnauthorized();
    }

    public function test_google_login_issues_same_jwt_and_preserves_existing_admin_identity(): void
    {
        config(['services.google.client_id' => 'test-client']);
        $admin = User::factory()->create(['role' => 'admin', 'google_id' => 'google-id']);
        Http::fake(['oauth2.googleapis.com/*' => Http::response([
            'sub' => 'google-id', 'email' => $admin->email, 'name' => $admin->name,
            'aud' => 'test-client', 'email_verified' => 'true',
        ])]);
        $response = $this->postJson('/api/auth/google', ['credential' => 'google-credential'])->assertOk()
            ->assertJsonPath('user.id', $admin->id)->assertJsonPath('user.role', 'admin')->assertJsonPath('token_type', 'bearer');
        $this->getJson('/api/auth/me', $this->bearer($response->json('access_token')))->assertOk();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_google_identity_validation_is_preserved(): void
    {
        config(['services.google.client_id' => 'test-client']);
        foreach ([['aud' => 'wrong', 'email_verified' => 'true'], ['aud' => 'test-client', 'email_verified' => 'false']] as $identity) {
            Http::fake(['oauth2.googleapis.com/*' => Http::response($identity + ['sub' => 'id', 'email' => 'visitor@example.test'])]);
            $this->postJson('/api/auth/google', ['credential' => 'credential'])->assertUnauthorized();
        }
        $this->assertDatabaseCount('users', 0);
    }

    public function test_legacy_sanctum_tokens_are_retained_but_cannot_authenticate_api(): void
    {
        $user = User::factory()->create();
        $legacy = $user->createToken('existing-device');
        $this->getJson('/api/auth/me', $this->bearer($legacy->plainTextToken))->assertUnauthorized();
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $legacy->accessToken->id]);
        $this->assertModelExists($user);
    }

    public function test_google_email_linking_preserves_password_role_and_issues_jwt(): void
    {
        config(['services.google.client_id' => 'test-client']);
        $admin = User::factory()->create(['role' => 'admin', 'google_id' => null]);
        $password = $admin->password;
        Http::fake(['oauth2.googleapis.com/*' => Http::response([
            'sub' => 'linked-google-id', 'email' => $admin->email, 'name' => 'Google name',
            'aud' => 'test-client', 'email_verified' => 'true', 'picture' => 'https://example.test/avatar.png',
        ])]);
        $response = $this->postJson('/api/auth/google', ['credential' => 'credential'])->assertOk()
            ->assertJsonPath('user.id', $admin->id)->assertJsonPath('user.role', 'admin');
        $this->getJson('/api/admin/travelers', $this->bearer($response->json('access_token')))->assertOk();
        $this->assertSame('linked-google-id', $admin->fresh()->google_id);
        $this->assertSame($password, $admin->fresh()->password);
        $this->assertDatabaseCount('users', 1);
    }
}
