<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\Itinerary;
use App\Models\User;
use Database\Seeders\SanFernandoItinerarySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

class SanFernandoItinerarySeederTest extends TestCase
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
            throw new LogicException('Seeder tests require isolated in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function destinations(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $plans = require database_path('data/san_fernando_itineraries.php');
        $names = [];
        foreach ($plans as $plan) {
            foreach ($plan['schedule'] as $entry) {
                if ($entry[2] !== null) {
                    $names[$entry[2]] = true;
                }
            }
        }
        foreach (array_keys($names) as $name) {
            HeritageSite::create([
                'created_by' => $admin->id, 'name' => $name, 'category' => 'Historical Buildings',
                'description' => 'Existing heritage description', 'history' => 'Existing recorded history',
                'address' => 'City of San Fernando, Pampanga', 'status' => 'active',
            ]);
        }
    }

    public function test_seed_creates_complete_ordered_public_plans_and_rerun_preserves_admin_edits(): void
    {
        $this->destinations();
        $adminRecord = Itinerary::create(['name' => 'Admin-created route', 'description' => 'Keep this exactly', 'status' => 'archived']);
        $adminRecord->stops()->create(['heritage_site_id' => HeritageSite::first()->id, 'sort_order' => 0]);
        $before = $adminRecord->fresh()->getAttributes();
        $beforeStop = $adminRecord->stops()->first()->getAttributes();
        $this->seed(SanFernandoItinerarySeeder::class);
        $this->assertDatabaseCount('itineraries', 11);
        $this->assertDatabaseCount('itinerary_stops', 51);
        $expectedCounts = [4, 5, 6, 3, 5, 6, 4, 4, 6, 7];
        $plans = require database_path('data/san_fernando_itineraries.php');
        foreach ($plans as $index => $plan) {
            $route = Itinerary::where('source_key', SanFernandoItinerarySeeder::SOURCE_PREFIX.$plan['key'])->firstOrFail();
            $this->assertSame($plan['name'], $route->name);
            $this->assertCount($expectedCounts[$index], $route->stops);
            $this->assertSame(range(0, $expectedCounts[$index] - 1), $route->stops->pluck('sort_order')->all());
            $expectedNames = array_values(array_filter(array_column($plan['schedule'], 2)));
            $this->assertSame($expectedNames, $route->stops->map(fn ($stop) => $stop->heritageSite->name)->all());
            $this->assertStringContainsString('Schedule', $route->description);
            $this->assertStringContainsString('Starting location:', $route->description);
            $this->assertStringContainsString('Travel notes', $route->description);
            $this->assertLessThanOrEqual(10000, mb_strlen($route->description));
        }
        $this->getJson('/api/itineraries')->assertOk()->assertJsonCount(10)->assertJsonCount(4, '0.stops');
        $this->getJson('/api/itineraries/'.$route->id)->assertOk()->assertJsonCount(7, 'stops');
        $route->update(['description' => 'Admin revised this imported itinerary', 'status' => 'archived']);
        $importedBefore = Itinerary::orderBy('id')->get()->map->getAttributes()->all();
        $this->seed(SanFernandoItinerarySeeder::class);
        $this->assertSame($importedBefore, Itinerary::orderBy('id')->get()->map->getAttributes()->all());
        $this->assertSame($before, $adminRecord->fresh()->getAttributes());
        $this->assertSame($beforeStop, $adminRecord->stops()->first()->getAttributes());
        $this->assertDatabaseCount('itinerary_stops', 51);
    }

    public function test_matching_admin_title_is_preserved_without_adopting_or_overwriting_it(): void
    {
        $this->destinations();
        $record = Itinerary::create(['name' => 'Discover Historic San Fernando', 'description' => 'Owned by Admin']);
        $before = $record->fresh()->getAttributes();
        $this->seed(SanFernandoItinerarySeeder::class);
        $this->assertDatabaseCount('itineraries', 10);
        $this->assertSame($before, $record->fresh()->getAttributes());
        $this->assertNull($record->fresh()->source_key);
        $this->assertCount(0, $record->stops);
    }

    public function test_missing_destination_aborts_every_itinerary_before_insertion(): void
    {
        $this->destinations();
        HeritageSite::where('name', 'Mother of Good Counsel Seminary')->delete();
        try {
            $this->seed(SanFernandoItinerarySeeder::class);
            $this->fail('Missing destination must fail validation.');
        } catch (LogicException $exception) {
            $this->assertStringContainsString('Mother of Good Counsel Seminary', $exception->getMessage());
        }
        $this->assertDatabaseCount('itineraries', 0);
        $this->assertDatabaseCount('itinerary_stops', 0);
    }

    public function test_archived_destination_aborts_every_itinerary_before_insertion(): void
    {
        $this->destinations();
        HeritageSite::where('name', 'San Fernando Train Station')->update(['status' => 'archived']);
        try {
            $this->seed(SanFernandoItinerarySeeder::class);
            $this->fail('Archived destination must fail validation.');
        } catch (LogicException $exception) {
            $this->assertStringContainsString('San Fernando Train Station', $exception->getMessage());
        }
        $this->assertDatabaseCount('itineraries', 0);
        $this->assertDatabaseCount('itinerary_stops', 0);
    }
}
