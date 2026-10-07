<?php

namespace Tests\Feature;

use App\Models\HeritageCheckinConfig;
use App\Models\HeritageSite;
use App\Models\HeritageVisit;
use App\Models\User;
use App\Services\HeritageGeofence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HeritagePassportTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $app = parent::createApplication();
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite.url', null);
        $app['config']->set('database.connections.sqlite.database', ':memory:');
        $app['config']->set('database.connections.sqlite.transaction_mode', 'DEFERRED');
        return $app;
    }

    protected function migrateDatabases()
    {
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:' || config('database.connections.sqlite.url') !== null) throw new \LogicException('Passport tests require isolated in-memory SQLite.');
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    public function json($method, $uri, array $data = [], array $headers = [], $options = 0)
    {
        // Laravel's test process reuses the guard; real HTTP requests do not.
        $this->app['auth']->forgetGuards();
        return parent::json($method, $uri, $data, $headers, $options);
    }

    private function site(string $name = 'Official site'): HeritageSite
    {
        return HeritageSite::create(['created_by' => User::factory()->create(['role' => 'admin'])->id, 'name' => $name, 'status' => 'active', 'category' => 'Churches', 'address' => 'Official address', 'description' => 'Official description', 'history' => 'Official history', 'latitude' => 15.02839, 'longitude' => 120.69314]);
    }

    private function headers(string $role = 'traveler'): array
    {
        $this->app['auth']->forgetGuards();
        return ['Authorization' => 'Bearer '.User::factory()->create(['role' => $role])->createToken('test')->plainTextToken];
    }

    private function config(HeritageSite $site, bool $enabled = true): HeritageCheckinConfig
    {
        return HeritageCheckinConfig::create(['heritage_site_id' => $site->id, 'public_token' => HeritageCheckinConfig::generateToken(), 'radius_meters' => 100, 'enabled' => $enabled]);
    }

    private function fix(HeritageSite $site): array
    {
        return ['latitude' => $site->latitude, 'longitude' => $site->longitude, 'accuracy' => 10];
    }

    public function test_configs_are_opt_in_admin_can_generate_enable_disable_and_radius_is_validated(): void
    {
        $site = $this->site(); $before = $site->fresh()->toArray(); $headers = $this->headers('admin');
        $this->assertDatabaseCount('heritage_checkin_configs', 0);
        $this->getJson('/api/heritage-sites/'.$site->id.'/check-in')->assertJsonPath('enabled', false);
        foreach ([24, 501, 50.5, -1] as $radius) $this->putJson('/api/admin/heritage-sites/'.$site->id.'/check-in', ['enabled' => true, 'radius_meters' => $radius], $headers)->assertUnprocessable();
        $response = $this->putJson('/api/admin/heritage-sites/'.$site->id.'/check-in', ['enabled' => false, 'radius_meters' => 100], $headers)->assertOk()->assertJsonPath('enabled', false);
        $token = $response->json('public_token'); $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token); $this->assertNotEquals((string) $site->id, $token);
        $this->putJson('/api/admin/heritage-sites/'.$site->id.'/check-in', ['enabled' => true, 'radius_meters' => 25], $headers)->assertOk()->assertJsonPath('public_token', $token);
        $this->assertDatabaseCount('heritage_checkin_configs', 1);
        $this->assertSame($before, $site->fresh()->toArray());
        $second = $this->config($this->site('Second')); $this->assertNotSame($token, $second->public_token);
    }

    public function test_cannot_enable_missing_invalid_coordinates_or_archived_sites_and_changed_coordinates_fail_safely(): void
    {
        $site = $this->site(); $headers = $this->headers('admin'); $config = $this->config($site);
        foreach ([['latitude' => null], ['latitude' => 91], ['latitude' => 15, 'longitude' => null], ['latitude' => 15, 'longitude' => 181], ['longitude' => 120, 'status' => 'archived']] as $change) {
            $site->update($change);
            $this->putJson('/api/admin/heritage-sites/'.$site->id.'/check-in', ['enabled' => true, 'radius_meters' => 100], $headers)->assertUnprocessable();
        }
        $site->update(['status' => 'active', 'latitude' => null, 'longitude' => null]);
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', ['latitude' => 15, 'longitude' => 120, 'accuracy' => 10], $this->headers())->assertConflict()->assertJsonPath('code', 'unavailable');
        $this->assertDatabaseCount('heritage_visits', 0);
    }

    public function test_public_resolution_contains_only_safe_site_context_and_no_listing_of_tokens(): void
    {
        $site = $this->site(); $site->images()->create(['image_path' => '/official.jpg', 'is_cover' => true, 'sort_order' => 0]); $config = $this->config($site);
        $this->getJson('/api/check-in/'.$config->public_token)->assertOk()->assertJsonPath('site.id', $site->id)->assertJsonPath('enabled', true)->assertJsonPath('coordinates_configured', true)
            ->assertJsonMissingPath('public_token')->assertJsonMissingPath('radius_meters')->assertJsonMissingPath('site.latitude')->assertJsonMissingPath('site.created_by')->assertJsonCount(1, 'site.images');
        $this->getJson('/api/check-in/invalid')->assertNotFound(); $this->getJson('/api/check-in/'.str_repeat('a', 64))->assertNotFound();
        $this->getJson('/api/admin/check-in-configs')->assertUnauthorized();
        $config->update(['enabled' => false]); $this->getJson('/api/check-in/'.$config->public_token)->assertOk()->assertJsonPath('enabled', false);
        $site->update(['status' => 'archived']); $this->getJson('/api/check-in/'.$config->public_token)->assertNotFound();
    }

    public function test_authentication_and_admin_authorization_are_enforced(): void
    {
        $site = $this->site(); $config = $this->config($site);
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site))->assertUnauthorized(); $this->getJson('/api/passport')->assertUnauthorized();
        foreach ([[], $this->headers()] as $headers) {
            $status = $headers ? 403 : 401;
            $this->getJson('/api/admin/check-in-configs', $headers)->assertStatus($status);
            $this->putJson('/api/admin/heritage-sites/'.$site->id.'/check-in', ['enabled' => true, 'radius_meters' => 100], $headers)->assertStatus($status);
            $this->postJson('/api/admin/heritage-sites/'.$site->id.'/check-in/rotate', [], $headers)->assertStatus($status);
        }
    }

    public function test_first_visit_requires_qr_and_inside_geofence_awards_exactly_100_without_location_storage(): void
    {
        $site = $this->site(); $config = $this->config($site); $headers = $this->headers();
        $this->postJson('/api/check-in/invalid/verify', $this->fix($site), $headers)->assertNotFound();
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site), $headers)->assertCreated()->assertJsonPath('status', 'verified')->assertJsonPath('points_earned', 100)->assertJsonPath('visit.points_awarded', 100);
        $visit = HeritageVisit::firstOrFail(); $this->assertSame('qr_geofence', $visit->verification_method); $this->assertEquals(0, $visit->distance_meters);
        $columns = Schema::getColumnListing('heritage_visits'); $this->assertNotContains('latitude', $columns); $this->assertNotContains('longitude', $columns);
        $this->assertDatabaseCount('heritage_visits', 1);
        $this->getJson('/api/passport', $headers)->assertOk()->assertJsonPath('total_points', 100)->assertJsonPath('visited_count', 1)->assertJsonPath('visited_eligible_count', 1)->assertJsonPath('eligible_site_count', 1)->assertJsonMissingPath('visits.0.user_id')->assertJsonMissingPath('eligible_sites.0.public_token');
    }

    public function test_outside_site_a_qr_cannot_award_site_b_and_reported_accuracy_does_not_expand_radius(): void
    {
        $a = $this->site('A'); $b = $this->site('B'); $b->update(['latitude' => 15.1]); $config = $this->config($a); $this->config($b); $headers = $this->headers();
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', [...$this->fix($b), 'inside_geofence' => true, 'heritage_site_id' => $b->id], $headers)->assertUnprocessable()->assertJsonPath('code', 'outside');
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', ['latitude' => $a->latitude + 0.001, 'longitude' => $a->longitude, 'accuracy' => 100], $headers)->assertUnprocessable()->assertJsonPath('code', 'outside');
        $this->assertDatabaseCount('heritage_visits', 0);
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', [...$this->fix($a), 'heritage_site_id' => $b->id], $headers)->assertCreated()->assertJsonPath('visit.heritage_site_id', $a->id);
        $this->assertDatabaseMissing('heritage_visits', ['heritage_site_id' => $b->id]);
    }

    public function test_haversine_and_raw_distance_decide_boundary_without_rounding_into_success(): void
    {
        $this->assertEqualsWithDelta(111195.08, HeritageGeofence::distance(0, 0, 1, 0), 0.1);
        $this->assertEqualsWithDelta(222390.16, HeritageGeofence::distance(0, 179, 0, -179), 0.1);
        $site = $this->site(); $config = $this->config($site);
        $inside = $this->fix($site); $inside['latitude'] += rad2deg(99.9 / 6371008.8);
        $outside = $this->fix($site); $outside['latitude'] += rad2deg(100.1 / 6371008.8);
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', $outside, $this->headers())->assertUnprocessable()->assertJsonPath('code', 'outside');
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', $inside, $this->headers())->assertCreated();
    }

    public function test_missing_weak_or_invalid_location_never_earns_points(): void
    {
        $site = $this->site(); $config = $this->config($site); $headers = $this->headers();
        foreach ([null, 101, 9999] as $accuracy) $this->postJson('/api/check-in/'.$config->public_token.'/verify', [...$this->fix($site), 'accuracy' => $accuracy], $headers)->assertUnprocessable()->assertJsonPath('code', 'weak_accuracy');
        foreach ([['latitude' => 91], ['longitude' => -181], ['latitude' => 'bad'], ['accuracy' => -1], ['accuracy' => 10001]] as $change) $this->postJson('/api/check-in/'.$config->public_token.'/verify', [...$this->fix($site), ...$change], $headers)->assertUnprocessable();
        $this->assertDatabaseCount('heritage_visits', 0);
    }

    public function test_duplicates_return_original_stamp_and_database_unique_constraint_blocks_multiple_rewards(): void
    {
        $site = $this->site(); $config = $this->config($site); $headers = $this->headers();
        $original = $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site), $headers)->assertCreated()->json('visit');
        for ($i = 0; $i < 3; $i++) $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site), $headers)->assertOk()->assertJsonPath('status', 'already_visited')->assertJsonPath('points_earned', 0)->assertJsonPath('visit.id', $original['id'])->assertJsonPath('visit.verified_at', $original['verified_at']);
        $row = HeritageVisit::firstOrFail()->getAttributes(); unset($row['id']);
        // Both rows conflict on the DB constraint, independent of application checks.
        $this->assertEquals(0, DB::table('heritage_visits')->insertOrIgnore([$row, $row]));
        $this->assertDatabaseCount('heritage_visits', 1); $this->getJson('/api/passport', $headers)->assertJsonPath('total_points', 100);
    }

    public function test_disabled_archived_and_rotated_tokens_fail_while_stamps_and_history_survive(): void
    {
        $site = $this->site(); $config = $this->config($site); $headers = $this->headers(); $admin = $this->headers('admin');
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site), $headers)->assertCreated();
        $newToken = $this->postJson('/api/admin/heritage-sites/'.$site->id.'/check-in/rotate', [], $admin)->assertOk()->json('public_token');
        $this->assertNotSame($config->public_token, $newToken); $this->getJson('/api/check-in/'.$config->public_token)->assertNotFound();
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site), $headers)->assertNotFound();
        $this->postJson('/api/check-in/'.$newToken.'/verify', $this->fix($site), $headers)->assertJsonPath('status', 'already_visited');
        $config->refresh()->update(['enabled' => false]); $this->postJson('/api/check-in/'.$newToken.'/verify', $this->fix($site), $this->headers())->assertConflict();
        $site->update(['status' => 'archived']); $config->update(['enabled' => true]);
        $this->postJson('/api/check-in/'.$newToken.'/verify', $this->fix($site), $this->headers())->assertNotFound();
        $this->getJson('/api/passport', $headers)->assertJsonPath('visited_count', 1)->assertJsonPath('total_points', 100)->assertJsonPath('eligible_site_count', 0)->assertJsonPath('visited_eligible_count', 0)->assertJsonPath('visits.0.site.status', 'archived');
    }

    public function test_passport_is_user_scoped_and_totals_are_derived_from_live_visit_records(): void
    {
        $a = $this->site('A'); $b = $this->site('B'); $first = $this->config($a); $second = $this->config($b); $headers = $this->headers();
        $this->postJson('/api/check-in/'.$first->public_token.'/verify', $this->fix($a), $headers)->assertCreated();
        $this->postJson('/api/check-in/'.$second->public_token.'/verify', $this->fix($b), $headers)->assertCreated();
        $a->update(['name' => 'Admin updated name']);
        $this->getJson('/api/passport', $headers)->assertJsonPath('total_points', 200)->assertJsonPath('visited_count', 2)->assertJsonPath('eligible_site_count', 2)->assertJsonPath('visits.1.site.name', 'Admin updated name');
        $this->getJson('/api/passport', $this->headers())->assertJsonPath('total_points', 0)->assertJsonCount(0, 'visits');
        $this->getJson('/api/admin/check-in-configs', $this->headers('admin'))->assertOk()->assertJsonPath('0.verified_visitors', 1);
    }

    public function test_registration_only_creates_secure_traveler_account(): void
    {
        $input = ['name' => 'Visitor', 'email' => 'visitor@example.test', 'password' => 'secure-password'];
        $this->postJson('/api/auth/register', [...$input, 'role' => 'admin'])->assertUnprocessable();
        $this->postJson('/api/auth/register', [...$input, 'password' => 'short'])->assertUnprocessable();
        $response = $this->postJson('/api/auth/register', [...$input, 'created_by' => 1, 'points' => 999])->assertCreated()->assertJsonPath('user.role', 'traveler')->assertJsonMissingPath('user.password');
        $this->getJson('/api/auth/me', ['Authorization' => 'Bearer '.$response->json('token')])->assertOk()->assertJsonPath('user.role', 'traveler');
        $this->postJson('/api/auth/register', $input)->assertUnprocessable();
        $this->assertDatabaseHas('users', ['email' => $input['email'], 'role' => 'traveler']);
    }

    public function test_verification_is_rate_limited_without_repeat_rewards(): void
    {
        $site = $this->site(); $config = $this->config($site); $headers = $this->headers();
        for ($i = 0; $i < 10; $i++) $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site), $headers)->assertStatus($i === 0 ? 201 : 200);
        $this->postJson('/api/check-in/'.$config->public_token.'/verify', $this->fix($site), $headers)->assertStatus(429);
        $this->assertDatabaseCount('heritage_visits', 1);
    }
}
