<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ItineraryTest extends TestCase
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
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:' || config('database.connections.sqlite.url') !== null) {
            throw new \LogicException('Itinerary tests require isolated in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function site(string $name = 'Live heritage', string $status = 'active'): HeritageSite
    {
        return HeritageSite::create(['created_by' => $this->admin()->id, 'name' => $name, 'description' => 'Current description', 'history' => 'Current history', 'address' => 'Current address', 'category' => 'Churches', 'status' => $status, 'latitude' => null, 'longitude' => null]);
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    private function headers(User $user): array
    {
        return ['Authorization' => 'Bearer '.$this->jwtFor($user)];
    }

    public function test_public_summaries_have_one_cover_no_gallery_timeline_or_admin_fields_and_bounded_queries(): void
    {
        foreach (range(1, 4) as $index) {
            $site = $this->site('Stop '.$index);
            $site->images()->create(['image_path' => 'heritage-sites/first.jpg', 'sort_order' => 0]);
            $site->images()->create(['image_path' => 'heritage-sites/cover.jpg', 'is_cover' => true, 'sort_order' => 9]);
            $site->timelines()->create(['year' => '1900', 'title' => 'History', 'description' => 'Recorded history']);
            $route = Itinerary::create(['name' => 'Route '.$index]);
            $route->stops()->create(['heritage_site_id' => $site->id, 'sort_order' => 0]);
        }
        \Illuminate\Support\Facades\DB::enableQueryLog(); \Illuminate\Support\Facades\DB::flushQueryLog();
        $response = $this->getJson('/api/itineraries')->assertOk()->assertJsonCount(4);
        $queries = \Illuminate\Support\Facades\DB::getQueryLog(); \Illuminate\Support\Facades\DB::disableQueryLog();
        $this->assertCount(4, $queries);
        foreach ($response->json() as $route) {
            $this->assertSame(['id', 'name', 'description', 'status', 'stops'], array_keys($route));
            $summary = $route['stops'][0]['heritage_site'];
            $this->assertSame('heritage-sites/cover.jpg', $summary['cover_image']['image_path']);
            $this->assertNotEmpty($summary['cover_image']['image_url']);
            foreach (['images', 'timelines', 'history', 'description', 'opening_hours', 'created_by'] as $field) $this->assertArrayNotHasKey($field, $summary);
        }
        $this->getJson('/api/itineraries/'.$route['id'])->assertOk()->assertJsonMissingPath('stops.0.heritage_site.timelines')->assertJsonMissingPath('stops.0.heritage_site.images');
    }

    public function test_public_reads_active_routes_with_ordered_live_stops_and_omit_archived_sites(): void
    {
        $route = Itinerary::create(['name' => 'Live route']);
        // Database default status applies on refresh, as it does to API reads.
        $route->refresh();
        $first = $this->site('First'); $second = $this->site('Second'); $third = $this->site('Third'); $hidden = $this->site('Archived heritage', 'archived');
        $route->stops()->createMany([
            ['heritage_site_id' => $third->id, 'sort_order' => 2],
            ['heritage_site_id' => $first->id, 'sort_order' => 1],
            ['heritage_site_id' => $second->id, 'sort_order' => 1],
            ['heritage_site_id' => $hidden->id, 'sort_order' => 0],
        ]);
        $first->images()->create(['image_path' => '/existing-official.jpg', 'is_cover' => true, 'sort_order' => 0]);
        $first->update(['description' => 'Admin updated live description']);
        $archived = Itinerary::create(['name' => 'Hidden route', 'status' => 'archived']);
        $response = $this->getJson('/api/itineraries/'.$route->id)->assertOk()->assertJsonCount(3, 'stops')
            ->assertJsonPath('stops.0.heritage_site.name', 'First')
            ->assertJsonPath('stops.1.heritage_site.name', 'Second')->assertJsonPath('stops.2.heritage_site.name', 'Third')
            ->assertJsonMissingPath('stops.0.heritage_site.description')
            ->assertJsonMissingPath('stops.0.heritage_site.timelines')
            ->assertJsonMissingPath('stops.0.heritage_site.images')
            ->assertJsonPath('stops.0.heritage_site.latitude', null)->assertJsonPath('stops.0.heritage_site.cover_image.image_path', '/existing-official.jpg');
        $this->assertStringNotContainsString('Archived heritage', $response->getContent());
        $this->getJson('/api/itineraries')->assertOk()->assertJsonCount(1)->assertJsonCount(3, '0.stops');
        $this->getJson('/api/itineraries/'.$archived->id)->assertNotFound();
        $this->getJson('/api/itineraries/99999')->assertNotFound();
        $this->getJson('/api/admin/itineraries', $this->headers($this->admin()))->assertOk()->assertJsonCount(2)->assertJsonCount(4, '0.stops');
    }

    public function test_admin_creates_updates_reorders_archives_and_restores_without_changing_heritage(): void
    {
        $admin = $this->admin(); $headers = $this->headers($admin);
        $a = $this->site('A'); $b = $this->site('B'); $before = HeritageSite::all()->toArray();
        $id = $this->postJson('/api/itineraries', ['name' => 'Curated', 'description' => null, 'created_by' => 999, 'stops' => [
            ['heritage_site_id' => $a->id, 'sort_order' => 1], ['heritage_site_id' => $b->id, 'sort_order' => 0],
        ]], $headers)->assertCreated()->assertJsonPath('created_by', $admin->id)->assertJsonPath('status', 'active')->json('id');
        $this->putJson('/api/itineraries/'.$id, ['name' => 'Edited', 'description' => 'Admin description', 'stops' => [
            ['heritage_site_id' => $a->id, 'sort_order' => 0], ['heritage_site_id' => $b->id, 'sort_order' => 1],
        ]], $headers)->assertOk()->assertJsonPath('stops.0.heritage_site_id', $a->id);
        $this->deleteJson('/api/itineraries/'.$id, [], $headers)->assertOk();
        $this->assertDatabaseHas('itineraries', ['id' => $id, 'status' => 'archived']);
        $this->assertDatabaseCount('itinerary_stops', 2);
        $this->getJson('/api/itineraries/'.$id)->assertNotFound();
        $this->patchJson('/api/itineraries/'.$id, ['status' => 'active'], $headers)->assertOk();
        $this->getJson('/api/itineraries/'.$id)->assertOk();
        $this->assertSame($before, HeritageSite::all()->toArray());
    }

    public function test_guests_and_travelers_cannot_mutate_or_read_admin_routes(): void
    {
        $route = Itinerary::create(['name' => 'Protected']);
        foreach ([['headers' => [], 'status' => 401], ['headers' => $this->headers(User::factory()->create(['role' => 'traveler'])), 'status' => 403]] as $actor) {
            $this->getJson('/api/admin/itineraries', $actor['headers'])->assertStatus($actor['status']);
            $this->getJson('/api/admin/itineraries/'.$route->id, $actor['headers'])->assertStatus($actor['status']);
            $this->postJson('/api/itineraries', [], $actor['headers'])->assertStatus($actor['status']);
            $this->putJson('/api/itineraries/'.$route->id, [], $actor['headers'])->assertStatus($actor['status']);
            $this->patchJson('/api/itineraries/'.$route->id, ['status' => 'archived'], $actor['headers'])->assertStatus($actor['status']);
            $this->deleteJson('/api/itineraries/'.$route->id, [], $actor['headers'])->assertStatus($actor['status']);
        }
        $this->assertDatabaseCount('itineraries', 1);
        $this->assertDatabaseHas('itineraries', ['id' => $route->id, 'status' => 'active']);
    }

    public function test_duplicate_missing_archived_and_invalid_stop_input_is_rejected_atomically(): void
    {
        $a = $this->site(); $archived = $this->site('Hidden', 'archived'); $headers = $this->headers($this->admin());
        foreach ([
            [['heritage_site_id' => $a->id, 'sort_order' => 0], ['heritage_site_id' => $a->id, 'sort_order' => 1]],
            [['heritage_site_id' => 999, 'sort_order' => 0]],
            [['heritage_site_id' => $archived->id, 'sort_order' => 0]],
            [['heritage_site_id' => $a->id, 'sort_order' => -1]],
        ] as $stops) {
            $this->postJson('/api/itineraries', ['name' => 'Invalid', 'stops' => $stops], $headers)->assertUnprocessable();
            $this->assertDatabaseCount('itineraries', 0); $this->assertDatabaseCount('itinerary_stops', 0);
        }
    }

    public function test_existing_archived_stop_can_be_retained_or_removed_but_not_added_elsewhere(): void
    {
        $a = $this->site(); $headers = $this->headers($this->admin());
        $id = $this->postJson('/api/itineraries', ['name' => 'Route', 'stops' => [['heritage_site_id' => $a->id, 'sort_order' => 0]]], $headers)->assertCreated()->json('id');
        $a->update(['status' => 'archived']);
        $this->putJson('/api/itineraries/'.$id, ['name' => 'Still editable', 'stops' => [['heritage_site_id' => $a->id, 'sort_order' => 0]]], $headers)->assertOk();
        $this->getJson('/api/itineraries/'.$id)->assertOk()->assertJsonCount(0, 'stops');
        $this->patchJson('/api/itineraries/'.$id, ['stops' => []], $headers)->assertOk();
        $this->assertDatabaseCount('itinerary_stops', 0);
    }

    public function test_seed_dry_run_no_writes_apply_idempotence_and_admin_edits_preserved(): void
    {
        $source = json_decode(file_get_contents(database_path('data/recommended_itineraries.json')), true);
        foreach ($source['routes'] as $route) foreach ($route['stops'] as $names) $this->site($names[0]);
        $admin = $this->admin(); $before = HeritageSite::all()->toArray();
        $this->artisan('itinerary:seed-recommended', ['--dry-run' => true])->expectsOutputToContain('DRY RUN: no database records created or updated.')->assertExitCode(0);
        $this->assertDatabaseCount('itineraries', 0); $this->assertDatabaseCount('itinerary_stops', 0);
        $options = ['--apply' => true, '--created-by' => $admin->id];
        $this->artisan('itinerary:seed-recommended', $options)->assertExitCode(0);
        $this->assertDatabaseCount('itineraries', 3); $this->assertDatabaseCount('itinerary_stops', 18);
        $route = Itinerary::firstOrFail(); $route->update(['name' => 'Admin renamed', 'description' => 'Admin overview', 'status' => 'archived']);
        $route->stops()->first()->update(['sort_order' => 90]);
        $routesBefore = Itinerary::with('stops')->get()->toArray();
        $this->artisan('itinerary:seed-recommended', $options)->assertExitCode(0);
        $this->assertSame($routesBefore, Itinerary::with('stops')->get()->toArray());
        $this->assertSame($before, HeritageSite::all()->toArray());
    }

    public function test_seed_requires_admin_reports_missing_and_ambiguous_sites_and_skips_empty_routes(): void
    {
        $this->artisan('itinerary:seed-recommended', ['--apply' => true])->assertExitCode(1);
        $this->artisan('itinerary:seed-recommended', ['--apply' => true, '--created-by' => User::factory()->create(['role' => 'traveler'])->id])->assertExitCode(1);
        $this->artisan('itinerary:seed-recommended', ['--apply' => true, '--dry-run' => true])->assertExitCode(1);
        $this->site('Lazatin House'); $this->site('Lazatin Residence');
        $this->artisan('itinerary:seed-recommended')->expectsOutputToContain('Ambiguous: Lazatin House')->assertExitCode(0);
        $this->artisan('itinerary:seed-recommended')->expectsOutputToContain('Missing: Metropolitan Cathedral of San Fernando')->assertExitCode(0);
        $this->assertDatabaseCount('itineraries', 0);
    }

    public function test_seed_explicit_alias_resolves_existing_id_without_creating_heritage_records(): void
    {
        $site = $this->site('Presidio'); $admin = $this->admin();
        $this->artisan('itinerary:seed-recommended', ['--apply' => true, '--created-by' => $admin->id])->assertExitCode(0);
        $this->assertDatabaseCount('itineraries', 1);
        $this->assertDatabaseCount('heritage_sites', 1);
        $this->assertDatabaseHas('itinerary_stops', ['heritage_site_id' => $site->id, 'sort_order' => 0]);
    }
}
