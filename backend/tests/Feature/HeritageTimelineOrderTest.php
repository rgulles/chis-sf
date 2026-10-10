<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\HeritageTimeline;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HeritageTimelineOrderTest extends TestCase
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
            throw new \LogicException('Timeline tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }


    public function test_order_is_explicit_stable_and_preserves_display_year_and_default(): void
    {
        $this->assertTrue(Schema::hasColumn('heritage_timelines', 'sort_order'));
        $admin = User::factory()->create(['role' => 'admin']);
        $headers = ['Authorization' => 'Bearer '.$this->jwtFor($admin)];
        $values = ['created_by' => $admin->id, 'name' => 'Site', 'description' => 'Overview', 'history' => 'History', 'address' => 'Address'];
        $site = HeritageSite::create($values);
        $other = HeritageSite::create($values);
        $payload = ['heritage_site_id' => $site->id, 'year' => 'circa 1900', 'title' => 'Milestone', 'description' => 'Recorded history'];
        $first = $this->postJson('/api/heritage-timelines', $payload + ['sort_order' => 9], $headers)->assertCreated()->json('id');
        $second = $this->postJson('/api/heritage-timelines', $payload + ['sort_order' => 2], $headers)->assertCreated()->json('id');
        $third = $this->postJson('/api/heritage-timelines', $payload + ['sort_order' => 2], $headers)->assertCreated()->json('id');
        $default = $this->postJson('/api/heritage-timelines', $payload, $headers)->assertCreated()->json('id');
        $this->assertSame(0, HeritageTimeline::findOrFail($default)->sort_order);
        $expected = [$default, $second, $third, $first];
        $this->assertSame($expected, $this->getJson('/api/heritage-sites/'.$site->id.'/timelines')->assertOk()->json('*.id'));
        $detail = $this->getJson('/api/heritage-sites/'.$site->id)->assertOk();
        $this->assertSame($expected, $detail->json('timelines.*.id'));
        $detail->assertJsonPath('timelines.1.year', 'circa 1900')->assertJsonPath('timelines.1.sort_order', 2);
        $this->assertSame($expected, $this->getJson('/api/admin/heritage-sites/'.$site->id, $headers)->assertOk()->json('timelines.*.id'));
        $this->patchJson('/api/heritage-timelines/'.$first, ['sort_order' => 1, 'heritage_site_id' => $other->id], $headers)->assertOk()->assertJsonPath('sort_order', 1);
        $this->assertSame([$first], $other->timelines()->pluck('id')->all());
        $this->patchJson('/api/heritage-timelines/'.$second, ['title' => 'Updated'], $headers)->assertOk()->assertJsonPath('sort_order', 2);
        foreach ([-1, 1.5, 'bad'] as $order) {
            $this->patchJson('/api/heritage-timelines/'.$second, ['sort_order' => $order], $headers)->assertUnprocessable()->assertJsonValidationErrors('sort_order');
        }
        $this->app['auth']->forgetGuards();
        $this->patchJson('/api/heritage-timelines/'.$second, ['sort_order' => 3])->assertUnauthorized();
        $traveler = User::factory()->create(['role' => 'traveler']);
        $this->app['auth']->forgetGuards();
        $this->patchJson('/api/heritage-timelines/'.$second, ['sort_order' => 3], ['Authorization' => 'Bearer '.$this->jwtFor($traveler)])->assertForbidden();
        $site->update(['status' => 'archived']);
        $this->getJson('/api/heritage-sites/'.$site->id)->assertNotFound();
        $this->getJson('/api/heritage-sites/'.$site->id.'/timelines')->assertNotFound();
    }
}
