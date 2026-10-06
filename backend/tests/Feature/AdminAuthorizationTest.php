<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\HeritageSite;
use App\Models\HeritageTimeline;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $traveler;
    private array $records;

    public function createApplication()
    {
        $app = parent::createApplication();

        // Override even cached/environment settings before RefreshDatabase runs.
        // These tests must never refresh the shared MySQL database.
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
            throw new \LogicException('Admin authorization tests require in-memory SQLite.');
        }

        // Apply existing migrations only to this empty, isolated database.
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->traveler = User::factory()->create([
            'role' => 'traveler',
            'email' => 'adminsf@csfp.gov.ph',
        ]);

        $site = HeritageSite::create($this->payload('heritage-sites') + [
            'created_by' => $this->admin->id,
        ]);
        $this->records = [
            'heritage-sites' => $site,
            'events' => Event::create($this->payload('events') + ['created_by' => $this->admin->id]),
            'site-images' => SiteImage::create([
                'heritage_site_id' => $site->id,
                'image_path' => 'heritage-sites/test.jpg',
                'caption' => 'Original caption',
            ]),
            'heritage-timelines' => HeritageTimeline::create([
                'heritage_site_id' => $site->id,
                'year' => '1920',
                'title' => 'Original title',
                'description' => 'Original description',
            ]),
        ];
    }

    public static function mutations(): array
    {
        $cases = [];
        foreach (['heritage-sites', 'events', 'site-images', 'heritage-timelines'] as $resource) {
            foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
                $cases["$method $resource"] = [$resource, $method];
            }
        }

        return $cases;
    }

    public static function resources(): array
    {
        return array_map(fn ($resource) => [$resource], [
            'heritage-sites', 'events', 'site-images', 'heritage-timelines',
        ]);
    }

    #[DataProvider('mutations')]
    public function test_guests_cannot_mutate_admin_resources(string $resource, string $method): void
    {
        $record = $this->records[$resource];
        $before = $record->fresh()->getAttributes();
        $uri = '/api/'.$resource.($method === 'POST' ? '' : '/'.$record->id);

        $this->json($method, $uri, $this->payload($resource))->assertUnauthorized();

        $this->assertDatabaseCount($record->getTable(), 1);
        $this->assertSame($before, $record->fresh()->getAttributes());
    }

    #[DataProvider('mutations')]
    public function test_travelers_cannot_mutate_admin_resources(string $resource, string $method): void
    {
        $record = $this->records[$resource];
        $before = $record->fresh()->getAttributes();
        $uri = '/api/'.$resource.($method === 'POST' ? '' : '/'.$record->id);

        $this->json($method, $uri, $this->payload($resource), $this->tokenHeaders($this->traveler))
            ->assertForbidden();

        $this->assertDatabaseCount($record->getTable(), 1);
        $this->assertSame($before, $record->fresh()->getAttributes());
    }

    #[DataProvider('resources')]
    public function test_admins_can_create_update_and_delete_resources(string $resource): void
    {
        $headers = $this->tokenHeaders($this->admin);
        $response = $this->postJson('/api/'.$resource, $this->payload($resource), $headers)
            ->assertCreated();
        $uri = '/api/'.$resource.'/'.$response->json('id');
        $field = match ($resource) {
            'heritage-sites' => 'name',
            'site-images' => 'caption',
            default => 'title',
        };

        if (in_array($resource, ['heritage-sites', 'events'], true)) {
            $response->assertJsonPath('created_by', $this->admin->id);
        }

        $this->putJson($uri, [$field => 'Updated', 'created_by' => $this->traveler->id], $headers)
            ->assertOk()->assertJsonPath($field, 'Updated');
        $updated = $this->patchJson($uri, [$field => 'Patched'], $headers)
            ->assertOk()->assertJsonPath($field, 'Patched');

        if (in_array($resource, ['heritage-sites', 'events'], true)) {
            $updated->assertJsonPath('created_by', $this->admin->id);
        }

        $this->deleteJson($uri, [], $headers)->assertSuccessful();
        $table = $this->records[$resource]->getTable();
        $id = $response->json('id');
        if ($resource === 'heritage-sites') {
            $this->assertDatabaseHas($table, [
                'id' => $id,
                'status' => 'archived',
            ]);
        } else {
            $this->assertDatabaseMissing($table, ['id' => $id]);
        }
    }

    public function test_creation_ignores_spoofed_creator_ids(): void
    {
        $headers = $this->tokenHeaders($this->admin);
        foreach (['heritage-sites', 'events'] as $resource) {
            $this->postJson('/api/'.$resource, $this->payload($resource) + [
                'created_by' => $this->traveler->id,
            ], $headers)->assertCreated()->assertJsonPath('created_by', $this->admin->id);
        }
    }

    public function test_public_reads_remain_accessible(): void
    {
        foreach ($this->records as $resource => $record) {
            $this->getJson('/api/'.$resource.'/'.$record->id)->assertOk();
            if ($resource !== 'heritage-timelines') {
                $this->getJson('/api/'.$resource)->assertOk();
            }
        }
        $this->getJson('/api/heritage-sites/'.$this->records['heritage-sites']->id.'/timelines')
            ->assertOk();
    }

    public function test_invalid_bearer_tokens_are_rejected(): void
    {
        $this->postJson('/api/heritage-sites', $this->payload('heritage-sites'), [
            'Authorization' => 'Bearer invalid-token',
        ])->assertUnauthorized();
        $this->assertDatabaseCount('heritage_sites', 1);
    }

    private function tokenHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('admin-test')->plainTextToken];
    }

    private function payload(string $resource): array
    {
        return match ($resource) {
            'heritage-sites' => [
                'name' => 'Test site', 'description' => 'Description',
                'history' => 'History', 'address' => 'San Fernando',
            ],
            'events' => [
                'title' => 'Test event', 'description' => 'Description',
                'event_date' => '2026-10-05', 'location' => 'San Fernando',
            ],
            'site-images' => [
                'heritage_site_id' => $this->records['heritage-sites']->id,
                'image_path' => 'heritage-sites/new.jpg',
            ],
            'heritage-timelines' => [
                'heritage_site_id' => $this->records['heritage-sites']->id,
                'year' => '1930', 'title' => 'Test timeline', 'description' => 'Description',
            ],
        };
    }
}
