<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\HeritageCheckinConfig;
use App\Models\HeritageContribution;
use App\Models\HeritageSite;
use App\Models\HeritageTimeline;
use App\Models\HeritageVisit;
use App\Models\Itinerary;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HeritageSiteDeletionTest extends TestCase
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
            || config('database.connections.sqlite.url') !== null) {
            throw new \LogicException('Deletion tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function site(string $status = 'active'): HeritageSite
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->jwtFor($admin)]);
        Storage::fake('public');

        return HeritageSite::create(['created_by' => $admin->id, 'name' => 'Test landmark', 'status' => $status,
            'description' => 'Overview', 'history' => 'History', 'address' => 'Address']);
    }

    private function dependencies(HeritageSite $site): array
    {
        $image = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'heritage-sites/owned.jpg']);
        $timeline = HeritageTimeline::create(['heritage_site_id' => $site->id, 'year' => '1900', 'title' => 'Milestone', 'description' => 'History']);
        $visitor = User::factory()->create(['role' => 'traveler']);
        $visit = HeritageVisit::create(['user_id' => $visitor->id, 'heritage_site_id' => $site->id,
            'distance_meters' => 10, 'points_awarded' => 100, 'verified_at' => now()]);
        $config = HeritageCheckinConfig::create(['heritage_site_id' => $site->id, 'public_token' => str_repeat('a', 64)]);
        $contribution = HeritageContribution::create(['user_id' => $visitor->id, 'heritage_site_id' => $site->id, 'status' => 'approved']);
        $photo = $contribution->images()->create(['image_path' => 'visitor-contributions/owned.png']);
        foreach (['s3', 'public'] as $disk) {
            Storage::disk($disk)->put($image->image_path, 'photo');
            Storage::disk($disk)->put($photo->image_path, 'photo');
        }

        return compact('image', 'timeline', 'visitor', 'visit', 'config', 'contribution', 'photo');
    }

    public function test_active_delete_archives_and_preserves_every_dependency_then_can_restore(): void
    {
        $site = $this->site();
        $children = $this->dependencies($site);
        $this->deleteJson('/api/heritage-sites/'.$site->id)->assertOk()->assertJsonPath('action', 'archived');
        $this->assertDatabaseHas('heritage_sites', ['id' => $site->id, 'status' => 'archived']);
        foreach ($children as $child) {
            $this->assertModelExists($child);
        }
        Storage::disk('s3')->assertExists('heritage-sites/owned.jpg');
        $this->getJson('/api/admin/heritage-sites')->assertOk()->assertJsonFragment(['id' => $site->id, 'status' => 'archived']);
        $this->putJson('/api/heritage-sites/'.$site->id, ['status' => 'active'])->assertOk();
        $this->assertDatabaseHas('heritage_sites', ['id' => $site->id, 'status' => 'active']);
    }

    public function test_archived_delete_cleans_children_files_and_only_its_itinerary_stops(): void
    {
        $site = $this->site('archived');
        $children = $this->dependencies($site);
        $other = HeritageSite::create($site->only(['created_by', 'description', 'history', 'address']) + ['name' => 'Survivor']);
        $otherImage = SiteImage::create(['heritage_site_id' => $other->id, 'image_path' => 'heritage-sites/survivor.jpg']);
        Storage::disk('s3')->put($otherImage->image_path, 'photo');
        $route = Itinerary::create(['name' => 'Route', 'created_by' => $site->created_by]);
        $removed = $route->stops()->create(['heritage_site_id' => $site->id, 'sort_order' => 0]);
        $remaining = $route->stops()->create(['heritage_site_id' => $other->id, 'sort_order' => 1]);
        $this->deleteJson('/api/heritage-sites/'.$site->id, ['expected_status' => 'archived', 'permanent' => true])
            ->assertOk()->assertJsonPath('action', 'deleted');
        $this->assertModelMissing($site);
        foreach (collect($children)->except('visitor') as $child) {
            $this->assertModelMissing($child);
        }
        $this->assertModelExists($children['visitor']);
        $this->assertModelMissing($removed);
        $this->assertModelExists($route);
        $this->assertSame(0, (int) $remaining->fresh()->sort_order);
        $this->assertModelExists($other);
        $this->assertModelExists($otherImage);
        Storage::disk('s3')->assertExists($otherImage->image_path);
        foreach (['s3', 'public'] as $disk) {
            Storage::disk($disk)->assertMissing('heritage-sites/owned.jpg');
            Storage::disk($disk)->assertMissing('visitor-contributions/owned.png');
        }
        $this->withHeaders(['Authorization' => 'Bearer '.$this->jwtFor($children['visitor'])]);
        $this->getJson('/api/passport')->assertOk()->assertJsonPath('visits', [])->assertJsonPath('total_points', 0);
    }

    public function test_archived_delete_without_intent_uses_database_status(): void
    {
        $site = $this->site('archived');
        $this->deleteJson('/api/heritage-sites/'.$site->id)->assertOk()->assertJsonPath('action', 'deleted');
        $this->assertModelMissing($site);
    }

    public function test_explicit_permanent_delete_of_active_site_is_refused(): void
    {
        $site = $this->site();
        $this->deleteJson('/api/heritage-sites/'.$site->id, ['permanent' => true])->assertConflict();
        $this->assertDatabaseHas('heritage_sites', ['id' => $site->id, 'status' => 'active']);
    }

    public function test_restored_site_rejects_stale_permanent_delete_and_keeps_children(): void
    {
        $site = $this->site('archived');
        $children = $this->dependencies($site);
        $this->putJson('/api/heritage-sites/'.$site->id, ['status' => 'active'])->assertOk();
        $this->deleteJson('/api/heritage-sites/'.$site->id, ['expected_status' => 'archived', 'permanent' => true])->assertConflict();
        $this->assertDatabaseHas('heritage_sites', ['id' => $site->id, 'status' => 'active']);
        foreach ($children as $child) {
            $this->assertModelExists($child);
        }
        Storage::disk('s3')->assertExists('heritage-sites/owned.jpg');
    }

    public function test_stale_archive_does_not_accidentally_delete_now_archived_site(): void
    {
        $site = $this->site('archived');
        $this->deleteJson('/api/heritage-sites/'.$site->id, ['expected_status' => 'active', 'permanent' => false])->assertConflict();
        $this->assertModelExists($site);
    }

    public function test_files_shared_with_other_sites_contributions_or_events_are_retained(): void
    {
        $site = $this->site('archived');
        $children = $this->dependencies($site);
        $other = HeritageSite::create($site->only(['created_by', 'description', 'history', 'address']) + ['name' => 'Survivor']);
        SiteImage::create(['heritage_site_id' => $other->id, 'image_path' => '/storage/heritage-sites/owned.jpg']);
        $contribution = HeritageContribution::create(['user_id' => $children['visitor']->id, 'heritage_site_id' => $other->id]);
        $contribution->images()->create(['image_path' => 'storage/visitor-contributions/owned.png']);
        SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'heritage-sites/event.jpg']);
        Event::create(['created_by' => $site->created_by, 'title' => 'Event', 'description' => 'Event',
            'event_date' => '2026-10-10', 'location' => 'Address', 'image_path' => 'heritage-sites/event.jpg']);
        Storage::disk('s3')->put('heritage-sites/event.jpg', 'photo');
        $this->deleteJson('/api/heritage-sites/'.$site->id)->assertOk();
        foreach (['heritage-sites/owned.jpg', 'visitor-contributions/owned.png', 'heritage-sites/event.jpg'] as $path) {
            Storage::disk('s3')->assertExists($path);
        }
    }

    public function test_external_and_unmanaged_files_are_never_deleted(): void
    {
        $site = $this->site('archived');
        foreach (['https://example.com/shared.jpg', '../private.jpg', 'official/photo.jpg'] as $path) {
            SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => $path]);
        }
        Storage::disk('s3')->put('official/photo.jpg', 'photo');
        $this->deleteJson('/api/heritage-sites/'.$site->id)->assertOk();
        Storage::disk('s3')->assertExists('official/photo.jpg');
    }

    public function test_shared_signed_url_reference_preserves_storage_object(): void
    {
        $site = $this->site('archived');
        SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'heritage-sites/shared.jpg']);
        $other = HeritageSite::create($site->only(['created_by', 'description', 'history', 'address']) + ['name' => 'Survivor']);
        SiteImage::create(['heritage_site_id' => $other->id,
            'image_path' => 'https://cdn.example.com/bucket/heritage-sites/shared.jpg?signature=example']);
        Storage::disk('s3')->put('heritage-sites/shared.jpg', 'photo');
        $this->deleteJson('/api/heritage-sites/'.$site->id)->assertOk();
        Storage::disk('s3')->assertExists('heritage-sites/shared.jpg');
    }

    public function test_storage_failure_does_not_undo_database_cleanup_and_other_disk_is_cleaned(): void
    {
        $site = $this->site('archived');
        $children = $this->dependencies($site);
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('url')->andReturnUsing(fn ($path) => 'https://bucket.example/'.$path);
        $disk->shouldReceive('delete')->andThrow(new \RuntimeException('Storage unavailable'));
        Storage::set('s3', $disk);
        Log::spy();
        $this->deleteJson('/api/heritage-sites/'.$site->id)->assertOk();
        $this->assertModelMissing($site);
        $this->assertModelMissing($children['visit']);
        Storage::disk('public')->assertMissing('heritage-sites/owned.jpg');
        Log::shouldHaveReceived('warning')->with('Heritage site file cleanup failed; retry required.', \Mockery::type('array'))->twice();
    }

    public function test_database_failure_rolls_back_children_and_retains_files(): void
    {
        $site = $this->site('archived');
        $children = $this->dependencies($site);
        HeritageSite::deleting(fn () => throw new \RuntimeException('Deletion failed'));
        try {
            $this->deleteJson('/api/heritage-sites/'.$site->id)->assertStatus(500);
            $this->assertModelExists($site);
            foreach ($children as $child) {
                $this->assertModelExists($child);
            }
            Storage::disk('s3')->assertExists('heritage-sites/owned.jpg');
        } finally {
            HeritageSite::flushEventListeners();
        }
    }

    public function test_unauthenticated_and_non_admin_cannot_archive_or_delete(): void
    {
        foreach (['active', 'archived'] as $status) {
            $site = $this->site($status);
            $this->app['auth']->forgetGuards();
            $this->withHeaders(['Authorization' => '']);
            $this->deleteJson('/api/heritage-sites/'.$site->id)->assertUnauthorized();
            $this->withHeaders(['Authorization' => 'Bearer '.$this->jwtFor(User::factory()->create(['role' => 'traveler']))]);
            $this->deleteJson('/api/heritage-sites/'.$site->id)->assertForbidden();
            $this->assertDatabaseHas('heritage_sites', ['id' => $site->id, 'status' => $status]);
        }
    }
}
