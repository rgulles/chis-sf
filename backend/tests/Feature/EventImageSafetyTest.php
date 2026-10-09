<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class EventImageSafetyTest extends TestCase
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
            throw new \LogicException('Event tests require isolated in-memory SQLite.');
        }
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    private function missingS3(): void
    {
        config(['filesystems.disks.s3' => ['driver' => 's3', 'bucket' => null, 'region' => 'ap-southeast-1', 'key' => null, 'secret' => null]]);
    }

    private function event(?string $path): Event
    {
        return Event::create(['created_by' => User::factory()->create(['role' => 'admin'])->id,
            'title' => 'Recorded event', 'description' => 'Recorded description', 'location' => 'Recorded venue',
            'event_date' => '2026-10-09', 'end_date' => '2026-10-10', 'start_time' => '18:00', 'end_time' => '21:00',
            'status' => 'upcoming', 'image_path' => $path]);
    }

    public function test_absolute_and_explicit_legacy_paths_require_no_storage_calls(): void
    {
        $this->missingS3();
        config(['filesystems.disks.public.url' => 'http://localhost/storage']);
        Storage::shouldReceive('disk')->never();
        foreach (['https://example.test/event.jpg' => 'https://example.test/event.jpg',
            'http://example.test/event.jpg' => 'http://example.test/event.jpg',
            '/storage/events/old.jpg' => 'http://localhost/storage/events/old.jpg',
            'storage/events/old.jpg' => 'http://localhost/storage/events/old.jpg'] as $path => $expected) {
            $event = new Event(['image_path' => $path]);
            $this->assertSame($expected, $event->image_url);
            $this->assertSame($path, $event->image_path);
        }
    }

    public function test_bare_existing_local_public_upload_does_not_require_s3(): void
    {
        $this->missingS3();
        $disk = Storage::fake('public');
        $disk->put('events/local.jpg', 'fixture');
        config(['filesystems.disks.public.root' => $disk->path(''), 'filesystems.disks.public.url' => 'http://localhost/storage']);
        Storage::shouldReceive('disk')->never();
        $this->assertSame('http://localhost/storage/events/local.jpg', (new Event(['image_path' => 'events/local.jpg']))->image_url);
    }

    public function test_s3_public_base_is_deterministic_without_exists_sdk_or_remote_calls(): void
    {
        config(['filesystems.disks.s3.url' => 'https://cdn.example.test', 'filesystems.disks.s3.root' => 'uploads']);
        Storage::shouldReceive('disk')->never();
        $this->assertSame('https://cdn.example.test/uploads/events/s3-photo.jpg', (new Event(['image_path' => 'events/s3-photo.jpg']))->image_url);
    }

    public function test_private_s3_key_can_be_signed_without_an_existence_check(): void
    {
        config(['filesystems.disks.s3' => ['driver' => 's3', 'bucket' => 'fixture-bucket', 'region' => 'ap-southeast-1', 'key' => 'fixture-key', 'secret' => 'fixture-secret']]);
        $disk = Mockery::mock();
        $disk->shouldReceive('temporaryUrl')->once()->with('events/private.jpg', Mockery::any())->andReturn('https://example.test/signed-event.jpg');
        $disk->shouldNotReceive('exists');
        Storage::shouldReceive('disk')->once()->with('s3')->andReturn($disk);
        $this->assertSame('https://example.test/signed-event.jpg', (new Event(['image_path' => 'events/private.jpg']))->image_url);
    }

    public function test_missing_images_and_incomplete_s3_configuration_are_null_without_storage_calls(): void
    {
        $this->missingS3();
        Storage::shouldReceive('disk')->never();
        foreach ([null, '', 'events/missing.jpg'] as $path) {
            $this->assertNull((new Event(['image_path' => $path]))->image_url);
        }
        // Even with a bucket, avoid credential discovery/IMDS requests in public serialization.
        config(['filesystems.disks.s3.bucket' => 'fixture-bucket']);
        $this->assertNull((new Event(['image_path' => 'events/missing.jpg']))->image_url);
    }

    public function test_api_keeps_all_events_dates_status_and_schedules_with_missing_s3(): void
    {
        $this->missingS3();
        $event = $this->event('events/missing.jpg');
        $event->schedules()->create(['schedule_time' => '18:00', 'title' => 'Recorded program', 'description' => 'Recorded activity']);
        $this->event('/storage/events/missing-local.jpg');
        $this->event(null);
        $this->getJson('/api/events')->assertOk()->assertJsonCount(3)
            ->assertJsonPath('0.image_url', null)->assertJsonPath('0.image_path', 'events/missing.jpg')
            ->assertJsonPath('0.event_date', '2026-10-09')->assertJsonPath('0.end_date', '2026-10-10')
            ->assertJsonPath('0.start_time', '18:00')->assertJsonPath('0.end_time', '21:00')
            ->assertJsonPath('0.status', 'upcoming')->assertJsonPath('0.schedules.0.title', 'Recorded program');
        $this->assertSame('events/missing.jpg', $event->fresh()->image_path);
        $this->assertSame(3, Event::count());
    }

    public function test_api_returns_200_and_null_image_when_sdk_resolution_throws(): void
    {
        $this->event('events/unavailable.jpg');
        config(['filesystems.disks.s3' => ['driver' => 's3', 'bucket' => 'fixture-bucket', 'region' => 'ap-southeast-1', 'key' => 'fixture-key', 'secret' => 'fixture-secret']]);
        Storage::shouldReceive('disk')->once()->with('s3')->andThrow(new RuntimeException('AWS private exception must not escape'));
        $this->getJson('/api/events')->assertOk()->assertJsonPath('0.image_url', null)->assertDontSee('AWS private exception');
    }
}
