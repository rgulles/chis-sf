<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\HeritageTimeline;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class HeritageConsistencyTest extends TestCase
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
        if (config('database.default') !== 'sqlite'
            || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url') !== null) {
            throw new \LogicException('Heritage tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function payload(): array
    {
        return ['name' => 'Heritage site', 'description' => 'Overview', 'history' => 'History',
            'address' => 'Address', 'category' => 'Churches'];
    }

    public function test_public_archive_boundary_and_admin_restore(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $active = HeritageSite::create($this->payload() + ['created_by' => $admin->id]);
        $archived = HeritageSite::create($this->payload() + ['created_by' => $admin->id, 'status' => 'archived']);
        $image = SiteImage::create(['heritage_site_id' => $archived->id, 'image_path' => 'archived.jpg']);
        $timeline = HeritageTimeline::create(['heritage_site_id' => $archived->id,
            'year' => '1900', 'title' => 'Milestone', 'description' => 'History']);

        $this->getJson('/api/heritage-sites')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $active->id);
        $this->getJson('/api/heritage-sites/'.$archived->id)->assertNotFound();
        $this->getJson('/api/heritage-sites/'.$archived->id.'/timelines')->assertNotFound();
        $this->getJson('/api/heritage-timelines/'.$timeline->id)->assertNotFound();
        $this->getJson('/api/site-images/'.$image->id)->assertNotFound();
        $this->getJson('/api/site-images')->assertOk()->assertExactJson([]);
        $this->getJson('/api/admin/heritage-sites')->assertUnauthorized();
        $this->getJson('/api/admin/heritage-sites/'.$archived->id)->assertUnauthorized();
        $this->getJson('/api/admin/site-images')->assertUnauthorized();

        $headers = ['Authorization' => 'Bearer '.$this->jwtFor($admin)];
        $this->getJson('/api/admin/heritage-sites', $headers)->assertOk()->assertJsonCount(2);
        $this->getJson('/api/admin/heritage-sites/'.$archived->id, $headers)->assertOk()
            ->assertJsonPath('status', 'archived')->assertJsonCount(1, 'images')->assertJsonCount(1, 'timelines');
        $this->getJson('/api/admin/site-images', $headers)->assertOk()->assertJsonCount(1);
        // Even an admin must use the protected retrieval route for archived details.
        $this->getJson('/api/heritage-sites/'.$archived->id, $headers)->assertNotFound();
        $this->patchJson('/api/heritage-sites/'.$archived->id, ['name' => 'Edited archived site'], $headers)
            ->assertOk()->assertJsonPath('status', 'archived');
        $this->patchJson('/api/heritage-sites/'.$archived->id, ['status' => 'active'], $headers)->assertOk();
        $this->getJson('/api/heritage-sites/'.$archived->id)->assertOk();
        $this->getJson('/api/site-images/'.$image->id)->assertOk();
        $this->getJson('/api/heritage-timelines/'.$timeline->id)->assertOk();
        $this->getJson('/api/heritage-sites/'.$archived->id.'/timelines')->assertOk()->assertJsonCount(1);
        $this->deleteJson('/api/heritage-sites/'.$archived->id, [], $headers)->assertOk();
        $this->assertDatabaseHas('heritage_sites', ['id' => $archived->id, 'status' => 'archived']);
        $this->assertDatabaseHas('site_images', ['id' => $image->id]);
        $this->assertDatabaseHas('heritage_timelines', ['id' => $timeline->id]);
    }

    public function test_travelers_cannot_read_admin_catalogues(): void
    {
        $traveler = User::factory()->create(['role' => 'traveler']);
        $site = HeritageSite::create($this->payload() + ['created_by' => $traveler->id, 'status' => 'archived']);
        $headers = ['Authorization' => 'Bearer '.$this->jwtFor($traveler)];
        foreach (['admin/heritage-sites', 'admin/heritage-sites/'.$site->id, 'admin/site-images'] as $path) {
            $this->getJson('/api/'.$path, $headers)->assertForbidden();
        }
    }

    public static function invalidCoordinates(): array
    {
        return [
            'latitude only' => [['latitude' => 15], 'longitude'],
            'longitude only' => [['longitude' => 120], 'latitude'],
            'latitude cleared alone' => [['latitude' => null], 'longitude'],
            'longitude cleared alone' => [['longitude' => null], 'latitude'],
            'null longitude' => [['latitude' => 15, 'longitude' => null], 'longitude'],
            'null latitude' => [['latitude' => null, 'longitude' => 120], 'latitude'],
            'latitude high' => [['latitude' => 91, 'longitude' => 120], 'latitude'],
            'latitude low' => [['latitude' => -91, 'longitude' => 120], 'latitude'],
            'longitude high' => [['latitude' => 15, 'longitude' => 181], 'longitude'],
            'longitude low' => [['latitude' => 15, 'longitude' => -181], 'longitude'],
            'invalid numeric text' => [['latitude' => '15oops', 'longitude' => 120], 'latitude'],
        ];
    }

    public function test_invalid_tokens_cannot_read_admin_catalogues(): void
    {
        foreach (['admin/heritage-sites', 'admin/heritage-sites/1', 'admin/site-images'] as $path) {
            $this->getJson('/api/'.$path, ['Authorization' => 'Bearer invalid'])->assertUnauthorized();
        }
    }

    #[DataProvider('invalidCoordinates')]
    public function test_invalid_coordinate_pairs_rejected_on_create_and_update(array $coordinates, string $field): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $headers = ['Authorization' => 'Bearer '.$this->jwtFor($admin)];
        $site = HeritageSite::create($this->payload() + ['created_by' => $admin->id, 'latitude' => 15, 'longitude' => 120]);
        $this->postJson('/api/heritage-sites', $this->payload() + $coordinates, $headers)
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->patchJson('/api/heritage-sites/'.$site->id, $coordinates, $headers)
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('heritage_sites', 1);
        $this->assertDatabaseHas('heritage_sites', ['id' => $site->id, 'latitude' => 15, 'longitude' => 120]);
    }

    public function test_unknown_valid_and_boundary_coordinates_and_categories(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $headers = ['Authorization' => 'Bearer '.$this->jwtFor($admin)];
        $response = $this->postJson('/api/heritage-sites', $this->payload() + ['latitude' => null, 'longitude' => null], $headers)->assertCreated();
        $this->postJson('/api/heritage-sites', $this->payload(), $headers)->assertCreated()
            ->assertJsonPath('latitude', null)->assertJsonPath('longitude', null);
        $id = $response->json('id');
        $this->getJson('/api/heritage-sites/'.$id)->assertJsonPath('latitude', null)->assertJsonPath('longitude', null);
        $this->patchJson('/api/heritage-sites/'.$id, ['latitude' => '15.0287', 'longitude' => '120.6908'], $headers)->assertOk();
        $site = HeritageSite::findOrFail($id);
        $this->assertEquals(15.0287, $site->latitude);
        $this->assertEquals(120.6908, $site->longitude);
        $this->patchJson('/api/heritage-sites/'.$id, ['name' => 'Unrelated edit'], $headers)->assertOk();
        $this->assertEquals(15.0287, $site->fresh()->latitude);
        foreach ([[90, 180], [-90, -180], [0, 0]] as [$lat, $lng]) {
            $this->patchJson('/api/heritage-sites/'.$id, ['latitude' => $lat, 'longitude' => $lng], $headers)->assertOk();
        }
        $this->patchJson('/api/heritage-sites/'.$id, ['latitude' => null, 'longitude' => null], $headers)->assertOk();
        $this->assertNull($site->fresh()->latitude);
        $this->assertNull($site->fresh()->longitude);
        foreach (HeritageSite::CATEGORIES as $category) {
            $this->patchJson('/api/heritage-sites/'.$id, ['category' => $category], $headers)->assertOk()->assertJsonPath('category', $category);
        }
        $this->patchJson('/api/heritage-sites/'.$id, ['category' => null], $headers)->assertOk();
        $this->patchJson('/api/heritage-sites/'.$id, ['category' => 'Invented'], $headers)->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->postJson('/api/heritage-sites', array_replace($this->payload(), ['category' => 'Invented']), $headers)->assertUnprocessable()->assertJsonValidationErrors('category');
    }
}
