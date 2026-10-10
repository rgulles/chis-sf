<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HeritageCataloguePerformanceTest extends TestCase
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
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url') !== null) throw new \LogicException('Catalogue tests require in-memory SQLite.');
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function site(): HeritageSite
    {
        return HeritageSite::create(['created_by' => User::factory()->create(['role' => 'admin'])->id,
            'name' => 'Official site', 'status' => 'active', 'category' => 'Churches', 'year_built' => '1900',
            'address' => 'Address', 'latitude' => 15.03, 'longitude' => 120.69,
            'description' => str_repeat('Full recorded description. ', 60), 'history' => str_repeat('Full recorded history. ', 100),
            'opening_hours' => 'By appointment']);
    }

    public function test_catalogue_selects_one_cover_and_omits_full_detail_while_detail_remains_complete(): void
    {
        $site = $this->site();
        $first = $site->images()->create(['image_path' => 'heritage-sites/first.jpg', 'sort_order' => 0]);
        $site->images()->create(['image_path' => 'heritage-sites/second.jpg', 'sort_order' => 0]);
        $cover = $site->images()->create(['image_path' => 'heritage-sites/cover.jpg', 'is_cover' => true, 'sort_order' => 9, 'caption' => 'Official cover']);
        $site->timelines()->create(['year' => '1900', 'title' => 'Recorded milestone', 'description' => 'Recorded history']);
        $response = $this->getJson('/api/heritage-sites')->assertOk()->assertJsonPath('0.cover_image.id', $cover->id);
        $this->assertNotEmpty($response->json('0.cover_image.image_url'));
        $this->assertSame(['id', 'name', 'category', 'year_built', 'address', 'latitude', 'longitude', 'status', 'short_description', 'cover_image'], array_keys($response->json('0')));
        $this->assertLessThanOrEqual(243, mb_strlen($response->json('0.short_description')));
        $this->getJson('/api/heritage-sites/'.$site->id)->assertOk()->assertJsonCount(3, 'images')->assertJsonCount(1, 'timelines')
            ->assertJsonPath('description', $site->description)->assertJsonPath('history', $site->history)->assertJsonPath('opening_hours', 'By appointment');
        $cover->delete();
        $this->getJson('/api/heritage-sites')->assertJsonPath('0.cover_image.id', $first->id);
        $site->images()->delete();
        $this->getJson('/api/heritage-sites')->assertJsonPath('0.cover_image', null);
        $site->update(['status' => 'archived']);
        $this->getJson('/api/heritage-sites')->assertExactJson([]);
        $this->getJson('/api/heritage-sites/'.$site->id)->assertNotFound();
    }

    public function test_summary_search_preserves_full_history_and_description_matches_and_archive_boundary(): void
    {
        $site = $this->site();
        $site->update(['history' => 'Unique historical phrase including 100%_recorded', 'description' => str_repeat('Introduction. ', 100).'Unique later description']);
        foreach (['Unique historical', 'Unique later', '100%_recorded'] as $needle) {
            $this->getJson('/api/heritage-sites?search='.urlencode($needle))->assertOk()->assertJsonCount(1)->assertJsonMissingPath('0.history');
        }
        $this->getJson('/api/heritage-sites?search=not_recorded')->assertExactJson([]);
        $this->getJson('/api/heritage-sites?search='.str_repeat('x', 501))->assertUnprocessable();
        $site->update(['status' => 'archived']);
        $this->getJson('/api/heritage-sites?search=Unique')->assertExactJson([]);
    }

    public function test_cover_loading_is_bounded_without_gallery_or_timeline_queries(): void
    {
        for ($index = 0; $index < 5; $index++) {
            $site = $this->site();
            for ($image = 0; $image < 4; $image++) $site->images()->create(['image_path' => 'heritage-sites/image'.$image.'.jpg', 'sort_order' => $image, 'is_cover' => $image === 3]);
            for ($timeline = 0; $timeline < 2; $timeline++) $site->timelines()->create(['year' => '1900', 'title' => 'Milestone', 'description' => 'Recorded timeline']);
        }
        // Reconstruct the previous index on the same isolated fixture for a comparable payload measurement.
        $previous = response()->json(HeritageSite::with(['images', 'timelines'])->where('status', 'active')->get())->getContent();
        DB::flushQueryLog(); DB::enableQueryLog();
        $response = $this->getJson('/api/heritage-sites')->assertOk()->assertJsonCount(5);
        $queries = DB::getQueryLog(); DB::disableQueryLog();
        $this->assertCount(2, $queries);
        foreach ($queries as $query) $this->assertStringNotContainsString('heritage_timelines', $query['query']);
        $this->assertLessThan(strlen($previous), strlen($response->getContent()));
        fwrite(STDOUT, '\nCatalogue fixture (5 sites, 20 images, 10 timeline entries): previous='.strlen($previous).' bytes; summary='.strlen($response->getContent()).' bytes; queries='.count($queries)."\n");
    }
}
