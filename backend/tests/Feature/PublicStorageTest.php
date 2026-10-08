<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicStorageTest extends TestCase
{
    public function test_public_uploads_are_unsigned_missing_files_are_404_and_private_files_stay_protected(): void
    {
        Storage::fake('public'); Storage::fake('local');
        Storage::disk('public')->put('events/test.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='));
        Storage::disk('local')->put('events/secret.txt', 'private content');
        $this->get('/storage/events/test.png')->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->get('/storage/events/missing.jpg')->assertNotFound();
        $this->get('/private-storage/events/secret.txt')->assertForbidden()->assertDontSee('private content');
        $this->get('/storage/events/secret.txt')->assertNotFound();
    }
}
