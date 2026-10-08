<?php

namespace Tests\Feature;

use App\Models\HeritageContribution;
use App\Models\HeritageContributionImage;
use App\Models\HeritageSite;
use App\Models\HeritageVisit;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HeritageContributionsTest extends TestCase
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
            throw new \LogicException('Contribution tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function fixtures(bool $verified = true): array
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin']);
        $visitor = User::factory()->create(['role' => 'traveler']);
        $site = HeritageSite::create(['created_by' => $admin->id, 'name' => 'Official landmark', 'status' => 'active',
            'description' => 'Official overview', 'history' => 'Official history', 'address' => 'Official address']);
        if ($verified) {
            $this->visit($visitor, $site);
        }

        return [$site, $visitor, $admin];
    }

    private function visit(User $user, HeritageSite $site): HeritageVisit
    {
        return HeritageVisit::create(['user_id' => $user->id, 'heritage_site_id' => $site->id,
            'verified_at' => now(), 'verification_method' => 'geofence', 'distance_meters' => 9,
            'accuracy_meters' => 10, 'points_awarded' => 100]);
    }

    private function headers(?User $user = null): array
    {
        $this->app['auth']->forgetGuards();

        return ['Accept' => 'application/json'] + ($user ? ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken] : []);
    }

    private function photo(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='));
    }

    private function submit(HeritageSite $site, User $user, array $data = [])
    {
        return $this->post('/api/heritage-sites/'.$site->id.'/contributions', $data + ['images' => [$this->photo()], 'caption' => 'A lovely visit.'], $this->headers($user));
    }

    public function test_eligibility_checks_the_verified_visit_once_without_loading_passport_or_gallery(): void
    {
        [$site, $visitor] = $this->fixtures(); $headers = $this->headers($visitor);
        \Illuminate\Support\Facades\DB::enableQueryLog(); \Illuminate\Support\Facades\DB::flushQueryLog();
        $this->getJson('/api/heritage-sites/'.$site->id.'/contributions/mine', $headers)->assertOk()->assertJsonPath('verified', true)->assertJsonPath('can_submit', true);
        $queries = \Illuminate\Support\Facades\DB::getQueryLog(); \Illuminate\Support\Facades\DB::disableQueryLog();
        $visits = array_filter($queries, fn ($query) => str_contains($query['query'], 'heritage_visits'));
        $this->assertCount(1, $visits);
        foreach ($queries as $query) foreach (['site_images', 'heritage_timelines'] as $table) $this->assertStringNotContainsString($table, $query['query']);
    }

    public function test_verified_submission_starts_pending_without_modifying_official_or_passport_data(): void
    {
        [$site, $visitor] = $this->fixtures();
        $before = $site->fresh()->toArray();
        $visit = HeritageVisit::first()->toArray();
        $official = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'heritage-sites/official.jpg']);
        $response = $this->submit($site, $visitor, ['images' => [$this->photo(), $this->photo(), $this->photo()],
            'status' => 'approved', 'approved_by' => $visitor->id])->assertCreated()->assertJsonPath('status', 'pending');
        $item = HeritageContribution::findOrFail($response->json('id'));
        $this->assertNull($item->approved_by);
        $this->assertSame([0, 1, 2], $item->images->pluck('sort_order')->all());
        foreach ($item->images as $image) {
            $this->assertStringStartsWith('visitor-contributions/', $image->image_path);
            Storage::disk('public')->assertExists($image->image_path);
        }
        $this->assertSame($before, $site->fresh()->toArray());
        $this->assertSame($visit, HeritageVisit::first()->toArray());
        $this->assertDatabaseCount('site_images', 1);
        $this->assertNotNull($official->fresh());
        $this->getJson('/api/passport', $this->headers($visitor))->assertOk()->assertJsonPath('total_points', 100)->assertJsonPath('visited_count', 1);
    }

    public function test_guest_and_unverified_visitors_cannot_submit_or_fake_verification(): void
    {
        [$site, $visitor] = $this->fixtures(false);
        $this->post('/api/heritage-sites/'.$site->id.'/contributions', ['images' => [$this->photo()]], $this->headers())->assertUnauthorized();
        $this->submit($site, $visitor, ['visited' => true, 'is_verified' => true])->assertForbidden();
        $this->getJson('/api/heritage-sites/'.$site->id.'/contributions/mine', $this->headers($visitor))
            ->assertOk()->assertJsonPath('verified', false)->assertJsonPath('can_submit', false);
        $this->assertDatabaseCount('heritage_contributions', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_archived_site_cannot_accept_submission_and_route_site_is_authoritative(): void
    {
        [$site, $visitor, $admin] = $this->fixtures();
        $other = HeritageSite::create(['created_by' => $admin->id, 'name' => 'Other', 'status' => 'active', 'address' => 'Other address', 'description' => 'Other overview', 'history' => 'Other history']);
        $this->submit($other, $visitor, ['heritage_site_id' => $site->id])->assertForbidden();
        $this->submit($site, $visitor, ['heritage_site_id' => $other->id])->assertCreated();
        $this->assertDatabaseHas('heritage_contributions', ['user_id' => $visitor->id, 'heritage_site_id' => $site->id]);
        $site->update(['status' => 'archived']);
        $this->submit($site, $visitor)->assertConflict();
        $this->getJson('/api/heritage-sites/'.$site->id.'/contributions', $this->headers())->assertNotFound();
    }

    public function test_invalid_svg_oversized_and_disallowed_images_are_rejected(): void
    {
        [$site, $visitor] = $this->fixtures();
        $valid = $this->photo();
        foreach ([UploadedFile::fake()->createWithContent('fake.jpg', 'not an image'),
            UploadedFile::fake()->createWithContent('photo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'),
            $this->photo()->size(5121), UploadedFile::fake()->create('photo.gif', 10, 'image/gif'),
            UploadedFile::fake()->createWithContent('fake.svg', file_get_contents($valid->getRealPath()))] as $image) {
            $this->submit($site, $visitor, ['images' => [$image]])->assertUnprocessable()->assertJsonValidationErrors('images.0');
        }
        $this->assertDatabaseCount('heritage_contributions', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_image_count_and_caption_plain_text_length_are_enforced(): void
    {
        [$site, $visitor] = $this->fixtures();
        $this->submit($site, $visitor, ['images' => []])->assertUnprocessable()->assertJsonValidationErrors('images');
        $this->submit($site, $visitor, ['images' => array_map(fn () => $this->photo(), range(1, 4))])->assertUnprocessable()->assertJsonValidationErrors('images');
        $this->submit($site, $visitor, ['caption' => str_repeat('x', 501)])->assertUnprocessable()->assertJsonValidationErrors('caption');
        $this->submit($site, $visitor, ['caption' => '<script>alert(1)</script>'])->assertUnprocessable()->assertJsonValidationErrors('caption');
        $this->submit($site, $visitor, ['caption' => str_repeat('x', 500)])->assertCreated();
    }

    public function test_admin_approval_rejection_and_public_allowlist(): void
    {
        [$site, $visitor, $admin] = $this->fixtures();
        $id = $this->submit($site, $visitor)->assertCreated()->json('id');
        $this->getJson('/api/heritage-sites/'.$site->id.'/contributions', $this->headers())->assertExactJson([]);
        $this->getJson('/api/admin/contributions', $this->headers())->assertUnauthorized();
        $this->getJson('/api/admin/contributions', $this->headers($visitor))->assertForbidden();
        $this->patchJson('/api/admin/contributions/'.$id, ['status' => 'approved'], $this->headers($visitor))->assertForbidden();
        $this->patchJson('/api/admin/contributions/'.$id, ['status' => 'approved'], $this->headers())->assertUnauthorized();
        $this->getJson('/api/admin/contributions?status=pending', $this->headers($admin))->assertOk()->assertJsonPath('0.id', $id);
        $this->patchJson('/api/admin/contributions/'.$id, ['status' => 'approved'], $this->headers($admin))->assertOk();
        $item = HeritageContribution::findOrFail($id);
        $this->assertSame($admin->id, $item->approved_by);
        $this->assertNotNull($item->approved_at);
        $public = $this->getJson('/api/heritage-sites/'.$site->id.'/contributions', $this->headers())->assertOk()->json('0');
        $this->assertSame(['id', 'caption', 'created_at', 'visitor_name', 'images'], array_keys($public));
        $this->assertSame($visitor->name, $public['visitor_name']);
        $this->assertStringContainsString('/storage/visitor-contributions/', $public['images'][0]);
        $this->assertStringNotContainsString($visitor->email, json_encode($public));
        $this->getJson('/api/admin/contributions?status=approved', $this->headers($admin))->assertJsonCount(1);
        $this->patchJson('/api/admin/contributions/'.$id, ['status' => 'rejected'], $this->headers($admin))->assertOk();
        $item->refresh();
        $this->assertNotNull($item->rejected_at);
        $this->assertNull($item->approved_at);
        $this->assertNull($item->approved_by);
        $this->getJson('/api/heritage-sites/'.$site->id.'/contributions', $this->headers())->assertExactJson([]);
        $this->getJson('/api/admin/contributions?status=rejected', $this->headers($admin))->assertJsonCount(1);
        $this->getJson('/api/admin/contributions?status=invalid', $this->headers($admin))->assertUnprocessable();
    }

    public function test_duplicate_pending_and_approved_submissions_are_prevented_and_rejected_can_be_replaced(): void
    {
        [$site, $visitor, $admin] = $this->fixtures();
        $id = $this->submit($site, $visitor)->assertCreated()->json('id');
        $old = HeritageContribution::findOrFail($id)->images->first()->image_path;
        $this->submit($site, $visitor)->assertConflict();
        $this->patchJson('/api/admin/contributions/'.$id, ['status' => 'approved'], $this->headers($admin))->assertOk();
        $this->submit($site, $visitor)->assertConflict();
        $this->getJson('/api/heritage-sites/'.$site->id.'/contributions/mine', $this->headers($visitor))->assertJsonPath('contribution.status', 'approved')->assertJsonPath('can_submit', false);
        $this->patchJson('/api/admin/contributions/'.$id, ['status' => 'rejected'], $this->headers($admin))->assertOk();
        $this->getJson('/api/heritage-sites/'.$site->id.'/contributions/mine', $this->headers($visitor))->assertJsonPath('can_submit', true);
        $this->submit($site, $visitor, ['caption' => 'Replacement'])->assertCreated()->assertJsonPath('id', $id)->assertJsonPath('status', 'pending');
        Storage::disk('public')->assertMissing($old);
        $this->assertDatabaseCount('heritage_contributions', 1);
        $this->assertDatabaseCount('heritage_contribution_images', 1);
        $this->assertDatabaseHas('heritage_contributions', ['id' => $id, 'caption' => 'Replacement', 'approved_by' => null, 'approved_at' => null, 'rejected_at' => null]);
    }

    public function test_remove_deletes_only_unreferenced_managed_files(): void
    {
        [$site, $visitor, $admin] = $this->fixtures();
        $id = $this->submit($site, $visitor)->assertCreated()->json('id');
        $item = HeritageContribution::findOrFail($id);
        $path = $item->images->first()->image_path;
        Storage::disk('public')->put('heritage-sites/official.jpg', 'keep');
        Storage::disk('public')->put('unrelated.jpg', 'keep');
        foreach (['heritage-sites/official.jpg', 'visitor-contributions/../unrelated.jpg', 'https://example.test/a.png'] as $unmanaged) {
            $item->images()->create(['image_path' => $unmanaged]);
        }
        $this->deleteJson('/api/admin/contributions/'.$id, [], $this->headers($visitor))->assertForbidden();
        $this->deleteJson('/api/admin/contributions/'.$id, [], $this->headers($admin))->assertNoContent();
        Storage::disk('public')->assertMissing($path);
        Storage::disk('public')->assertExists('heritage-sites/official.jpg');
        Storage::disk('public')->assertExists('unrelated.jpg');
        $this->assertDatabaseCount('heritage_contribution_images', 0);
        $id = $this->submit($site, $visitor)->assertCreated()->json('id');
        $item = HeritageContribution::findOrFail($id);
        $path = $item->images->first()->image_path;
        SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => $path]);
        $this->deleteJson('/api/admin/contributions/'.$id, [], $this->headers($admin))->assertNoContent();
        Storage::disk('public')->assertExists($path);
    }

    public function test_failed_replacement_preserves_old_files_and_removes_new_uploads(): void
    {
        [$site, $visitor, $admin] = $this->fixtures();
        $id = $this->submit($site, $visitor)->assertCreated()->json('id');
        $path = HeritageContribution::findOrFail($id)->images->first()->image_path;
        $this->patchJson('/api/admin/contributions/'.$id, ['status' => 'rejected'], $this->headers($admin))->assertOk();
        HeritageContributionImage::creating(fn () => throw new \RuntimeException('Simulated database failure'));
        try {
            $this->submit($site, $visitor)->assertStatus(500);
        } finally {
            HeritageContributionImage::flushEventListeners();
        }
        $this->assertSame([$path], Storage::disk('public')->allFiles());
        $this->assertDatabaseHas('heritage_contributions', ['id' => $id, 'status' => 'rejected']);
        $this->assertDatabaseHas('heritage_contribution_images', ['image_path' => $path]);
    }

    public function test_submissions_are_throttled(): void
    {
        [$site, $visitor] = $this->fixtures();
        $headers = $this->headers($visitor);
        for ($i = 0; $i < 5; $i++) {
            $this->post('/api/heritage-sites/'.$site->id.'/contributions', ['images' => []], $headers)->assertUnprocessable();
        }
        $this->post('/api/heritage-sites/'.$site->id.'/contributions', ['images' => [$this->photo()]], $headers)->assertStatus(429);
    }
}
