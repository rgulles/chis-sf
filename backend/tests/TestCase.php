<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['jwt.secret' => bin2hex(random_bytes(32))]);
        // Test image references/uploads must never contact a configured shared S3 bucket.
        Storage::fake('s3');
    }

    protected function jwtFor(User $user): string
    {
        return app('tymon.jwt')->fromUser($user);
    }

    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        // PHPUnit reuses the application across requests; real PHP requests do not.
        $this->app['auth']->forgetGuards();
        $this->app['tymon.jwt']->unsetToken();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
