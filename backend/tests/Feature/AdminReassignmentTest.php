<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\HeritageTimeline;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AdminReassignmentTest extends TestCase
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
            throw new \LogicException('Admin reassignment tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    public static function resources(): array
    {
        return [
            ['heritage-timelines', 'PUT'], ['heritage-timelines', 'PATCH'],
            ['site-images', 'PUT'], ['site-images', 'PATCH'],
        ];
    }

    public static function invalidTargets(): array
    {
        $cases = [];
        foreach (self::resources() as [$resource, $method]) {
            foreach ([999999, null, 'not-an-id'] as $target) {
                $cases[] = [$resource, $method, $target];
            }
        }
        return $cases;
    }

    private function fixtures(string $resource): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $attributes = [
            'created_by' => $admin->id, 'name' => 'Original site', 'description' => 'Description',
            'history' => 'History', 'address' => 'San Fernando',
        ];
        $original = HeritageSite::create($attributes);
        $target = HeritageSite::create(array_replace($attributes, ['name' => 'Target site']));
        $record = $resource === 'heritage-timelines'
            ? HeritageTimeline::create([
                'heritage_site_id' => $original->id, 'year' => '1920',
                'title' => 'Original title', 'description' => 'Original description',
            ])
            : SiteImage::create([
                'heritage_site_id' => $original->id, 'image_path' => 'sites/original.jpg',
                'caption' => 'Original caption',
            ]);

        return [$record, $target, ['Authorization' => 'Bearer '.$admin->createToken('admin-test')->plainTextToken]];
    }

    #[DataProvider('resources')]
    public function test_reassignment_preserves_content_without_creating_duplicates(string $resource, string $method): void
    {
        [$record, $target, $headers] = $this->fixtures($resource);
        $before = $record->fresh()->getAttributes();
        $this->json($method, '/api/'.$resource.'/'.$record->id, [
            'heritage_site_id' => $target->id,
        ], $headers)->assertOk()->assertJsonPath('heritage_site_id', $target->id);

        $after = $record->fresh()->getAttributes();
        $this->assertSame($target->id, $after['heritage_site_id']);
        unset($before['heritage_site_id'], $before['updated_at'], $after['heritage_site_id'], $after['updated_at']);
        $this->assertSame($before, $after);
        $this->assertDatabaseCount($record->getTable(), 1);
    }

    #[DataProvider('invalidTargets')]
    public function test_invalid_target_rejects_the_update_without_changing_content(string $resource, string $method, mixed $target): void
    {
        [$record, , $headers] = $this->fixtures($resource);
        $before = $record->fresh()->getAttributes();
        $this->json($method, '/api/'.$resource.'/'.$record->id, [
            'heritage_site_id' => $target,
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors('heritage_site_id');
        $this->assertSame($before, $record->fresh()->getAttributes());
        $this->assertDatabaseCount($record->getTable(), 1);
    }

    #[DataProvider('resources')]
    public function test_content_only_updates_preserve_the_parent_site(string $resource, string $method): void
    {
        [$record, , $headers] = $this->fixtures($resource);
        $field = $resource === 'heritage-timelines' ? 'title' : 'caption';
        $this->json($method, '/api/'.$resource.'/'.$record->id, [$field => 'Updated content'], $headers)
            ->assertOk()->assertJsonPath('heritage_site_id', $record->heritage_site_id);
        $this->assertSame('Updated content', $record->fresh()->getAttribute($field));
    }
}
