<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HeritageImagesTest extends TestCase
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
            throw new \LogicException('Image tests require in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function fixtures(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $attributes = ['created_by' => $admin->id, 'name' => 'Site', 'description' => 'Overview', 'history' => 'History', 'address' => 'Address'];
        return [HeritageSite::create($attributes), HeritageSite::create($attributes),
            ['Authorization' => 'Bearer '.$this->jwtFor($admin)]];
    }

    private function image(HeritageSite $site, array $values, array $headers): SiteImage
    {
        $response = $this->postJson('/api/site-images', ['heritage_site_id' => $site->id, 'image_path' => 'heritage/photo.jpg'] + $values, $headers)->assertCreated();
        return SiteImage::findOrFail($response->json('id'));
    }

    public function test_defaults_cover_changes_reassignment_and_deletion(): void
    {
        [$first, $second, $headers] = $this->fixtures();
        $this->assertTrue(Schema::hasColumns('site_images', ['is_cover', 'sort_order']));
        $normal = $this->image($first, ['caption' => 'Preserved caption'], $headers);
        $this->assertFalse($normal->is_cover);
        $this->assertSame(0, $normal->sort_order);
        $cover = $this->image($first, ['is_cover' => true, 'sort_order' => 5], $headers);
        $replacement = $this->image($first, ['is_cover' => true], $headers);
        $this->assertFalse($cover->fresh()->is_cover);
        $this->assertTrue($replacement->is_cover);
        $otherCover = $this->image($second, ['is_cover' => true], $headers);
        $this->assertTrue($replacement->fresh()->is_cover);
        $this->patchJson('/api/site-images/'.$normal->id, ['is_cover' => true, 'sort_order' => 7], $headers)->assertOk();
        $this->assertFalse($replacement->fresh()->is_cover);
        $this->assertSame(7, $normal->fresh()->sort_order);
        $this->assertSame('Preserved caption', $normal->fresh()->caption);
        $this->patchJson('/api/site-images/'.$normal->id, ['heritage_site_id' => $second->id], $headers)->assertOk();
        $this->assertTrue($normal->fresh()->is_cover);
        $this->assertFalse($otherCover->fresh()->is_cover);
        $this->assertSame(0, $first->images()->where('is_cover', true)->count());
        $this->assertSame(1, $second->images()->where('is_cover', true)->count());
        Storage::fake('public');
        Storage::disk('public')->put('heritage/photo.jpg', 'test file');
        $this->deleteJson('/api/site-images/'.$normal->id, [], $headers)->assertOk();
        $this->assertDatabaseMissing('site_images', ['id' => $normal->id]);
        $this->assertSame(0, $second->images()->where('is_cover', true)->count());
        Storage::disk('public')->assertExists('heritage/photo.jpg');
    }

    public function test_false_cover_and_non_cover_reassignment_do_not_unset_other_covers(): void
    {
        [$first, $second, $headers] = $this->fixtures();
        $cover = $this->image($second, ['is_cover' => true], $headers);
        $normal = $this->image($first, [], $headers);
        $this->putJson('/api/site-images/'.$normal->id, ['heritage_site_id' => $second->id, 'is_cover' => false], $headers)->assertOk();
        $this->assertTrue($cover->fresh()->is_cover);
        $this->patchJson('/api/site-images/'.$cover->id, ['is_cover' => false], $headers)->assertOk();
        $this->assertSame(0, $second->images()->where('is_cover', true)->count());
    }

    public function test_order_and_captions_in_public_and_admin_retrieval(): void
    {
        [$site, , $headers] = $this->fixtures();
        $later = $this->image($site, ['sort_order' => 10, 'caption' => 'Later'], $headers);
        $tieFirst = $this->image($site, ['sort_order' => 0], $headers);
        $tieSecond = $this->image($site, ['sort_order' => 0], $headers);
        $expected = [$tieFirst->id, $tieSecond->id, $later->id];
        foreach (['heritage-sites/'.$site->id, 'admin/heritage-sites/'.$site->id] as $path) {
            $response = $this->getJson('/api/'.$path, $headers)->assertOk();
            $this->assertSame($expected, array_column($response->json('images'), 'id'));
            $response->assertJsonPath('images.2.caption', 'Later');
        }
        $this->getJson('/api/heritage-sites')->assertOk()->assertJsonPath('0.cover_image.id', $tieFirst->id)->assertJsonMissingPath('0.images');
        foreach (['admin/heritage-sites'] as $path) {
            $response = $this->getJson('/api/'.$path, $headers)->assertOk();
            $this->assertSame($expected, array_column($response->json('0.images'), 'id'));
        }
        foreach (['site-images', 'admin/site-images'] as $path) {
            $this->assertSame($expected, array_column($this->getJson('/api/'.$path, $headers)->assertOk()->json(), 'id'));
        }
    }

    public function test_invalid_metadata_and_non_admin_requests_do_not_change_cover(): void
    {
        [$site, , $headers] = $this->fixtures();
        $cover = $this->image($site, ['is_cover' => true], $headers);
        foreach ([['sort_order' => -1], ['sort_order' => 1.5], ['sort_order' => 2147483648], ['is_cover' => 'yes']] as $invalid) {
            $field = array_key_first($invalid);
            $this->patchJson('/api/site-images/'.$cover->id, $invalid, $headers)->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->postJson('/api/site-images', ['heritage_site_id' => $site->id, 'image_path' => 'test.jpg'] + $invalid, $headers)->assertUnprocessable();
        }
        $this->assertTrue($cover->fresh()->is_cover);
    }

    public function test_non_admin_cannot_change_image_metadata(): void
    {
        [$site] = $this->fixtures();
        $cover = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'test.jpg', 'is_cover' => true]);
        $this->patchJson('/api/site-images/'.$cover->id, ['is_cover' => false])->assertUnauthorized();
        $traveler = User::factory()->create(['role' => 'traveler']);
        $travelerHeaders = ['Authorization' => 'Bearer '.$this->jwtFor($traveler)];
        $this->patchJson('/api/site-images/'.$cover->id, ['is_cover' => false], $travelerHeaders)->assertForbidden();
        $this->assertTrue($cover->fresh()->is_cover);
    }
}
