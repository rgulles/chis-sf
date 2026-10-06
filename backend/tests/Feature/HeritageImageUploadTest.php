<?php

namespace Tests\Feature;

use App\Models\HeritageSite;
use App\Models\SiteImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HeritageImageUploadTest extends TestCase
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
            || config('database.connections.sqlite.url') !== null) throw new \LogicException('Upload tests require in-memory SQLite.');
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function fixtures(): array
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin']);
        $site = HeritageSite::create(['created_by' => $admin->id, 'name' => 'Site', 'description' => 'Overview', 'history' => 'History', 'address' => 'Address']);
        return [$site, ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken]];
    }

    private function upload(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='));
    }

    public function test_upload_metadata_cover_replacement_and_deletion(): void
    {
        [$site, $headers] = $this->fixtures();
        $previous = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'https://example.test/old.jpg', 'is_cover' => true]);
        $response = $this->post('/api/site-images', ['heritage_site_id' => $site->id, 'image' => $this->upload(),
            'image_path' => 'https://ignored.test/image.jpg', 'caption' => 'Caption', 'is_cover' => '1', 'sort_order' => '4'], $headers)->assertCreated();
        $id = $response->json('id');
        $path = $response->json('image_path');
        $this->assertStringStartsWith('heritage-sites/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertFalse($previous->fresh()->is_cover);
        $response->assertJsonPath('caption', 'Caption')->assertJsonPath('is_cover', true)->assertJsonPath('sort_order', 4);
        $this->patchJson('/api/site-images/'.$id, ['caption' => 'Updated'], $headers)->assertOk()->assertJsonPath('image_path', $path);
        $replacement = $this->post('/api/site-images/'.$id, ['_method' => 'PUT', 'image' => $this->upload()], $headers)->assertOk();
        $newPath = $replacement->json('image_path');
        $this->assertNotSame($path, $newPath);
        Storage::disk('public')->assertMissing($path);
        Storage::disk('public')->assertExists($newPath);
        $this->deleteJson('/api/site-images/'.$id, [], $headers)->assertOk();
        Storage::disk('public')->assertMissing($newPath);
        $this->assertDatabaseMissing('site_images', ['id' => $id]);
    }

    public function test_invalid_oversized_and_svg_files_are_rejected(): void
    {
        [$site, $headers] = $this->fixtures();
        foreach ([UploadedFile::fake()->createWithContent('fake.jpg', 'not an image'),
            UploadedFile::fake()->create('huge.png', 5121, 'image/png'),
            UploadedFile::fake()->createWithContent('image.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>')] as $file) {
            $this->post('/api/site-images', ['heritage_site_id' => $site->id, 'image' => $file], $headers + ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('image');
        }
        $this->assertDatabaseCount('site_images', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_external_static_unmanaged_and_shared_files_are_preserved(): void
    {
        [$site, $headers] = $this->fixtures();
        foreach (['https://example.test/a.jpg', 'http://example.test/a.jpg', '//example.test/a.jpg', '/images/static.jpg',
            'events/other.jpg', 'heritage-sites/../other.jpg'] as $path) {
            Storage::disk('public')->put('other.jpg', 'keep');
            $image = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => $path]);
            $this->post('/api/site-images/'.$image->id, ['_method' => 'PUT', 'image' => $this->upload()], $headers)->assertOk();
            Storage::disk('public')->assertExists('other.jpg');
            $reference = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => $path]);
            $this->deleteJson('/api/site-images/'.$reference->id, [], $headers)->assertOk();
        }
        Storage::disk('public')->put('heritage-sites/shared.jpg', 'shared');
        $one = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'heritage-sites/shared.jpg']);
        $two = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => '/storage/heritage-sites/shared.jpg']);
        $this->deleteJson('/api/site-images/'.$one->id, [], $headers)->assertOk();
        Storage::disk('public')->assertExists('heritage-sites/shared.jpg');
        $this->deleteJson('/api/site-images/'.$two->id, [], $headers)->assertOk();
        Storage::disk('public')->assertMissing('heritage-sites/shared.jpg');
    }

    public function test_failed_database_save_removes_new_upload_and_preserves_old_file(): void
    {
        [$site, $headers] = $this->fixtures();
        Storage::disk('public')->put('heritage-sites/old.jpg', 'old');
        $image = SiteImage::create(['heritage_site_id' => $site->id, 'image_path' => 'heritage-sites/old.jpg']);
        SiteImage::updating(fn () => throw new \RuntimeException('Simulated database failure'));
        try {
            $this->post('/api/site-images/'.$image->id, ['_method' => 'PUT', 'image' => $this->upload()], $headers)->assertStatus(500);
            $this->assertSame('heritage-sites/old.jpg', $image->fresh()->image_path);
            $this->assertSame(['heritage-sites/old.jpg'], Storage::disk('public')->allFiles());
        } finally {
            SiteImage::flushEventListeners();
        }
    }
}
