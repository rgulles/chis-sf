<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsTest extends TestCase
{
    private const PRODUCTION_ORIGIN = 'https://chis-sf.vercel.app';

    protected function setUp(): void
    {
        parent::setUp();
        config(['cors.allowed_origins' => [self::PRODUCTION_ORIGIN]]);
    }

    public function test_production_preflight_allows_bearer_headers_and_all_api_methods(): void
    {
        foreach (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as $method) {
            $response = $this->options('/api/admin/itineraries', [], [
                'Origin' => self::PRODUCTION_ORIGIN,
                'Access-Control-Request-Method' => $method,
                'Access-Control-Request-Headers' => 'authorization,content-type,accept,origin,x-requested-with',
            ])->assertNoContent()
                ->assertHeader('Access-Control-Allow-Origin', self::PRODUCTION_ORIGIN)
                ->assertHeaderMissing('Access-Control-Allow-Credentials');

            $headers = array_map('trim', explode(',', strtolower($response->headers->get('Access-Control-Allow-Headers'))));
            foreach (['authorization', 'content-type', 'accept', 'origin', 'x-requested-with'] as $header) {
                $this->assertContains($header, $headers);
            }
            $this->assertContains($method, explode(',', $response->headers->get('Access-Control-Allow-Methods')));
        }
    }

    public function test_protected_api_still_requires_jwt_and_returns_readable_cors_auth_errors(): void
    {
        foreach (['/api/auth/me', '/api/admin/itineraries', '/api/passport'] as $path) {
            $this->getJson($path, ['Origin' => self::PRODUCTION_ORIGIN])
                ->assertUnauthorized()
                ->assertHeader('Access-Control-Allow-Origin', self::PRODUCTION_ORIGIN);
        }
        $this->postJson('/api/auth/logout', [], ['Origin' => self::PRODUCTION_ORIGIN])
            ->assertUnauthorized()
            ->assertHeader('Access-Control-Allow-Origin', self::PRODUCTION_ORIGIN);
        $this->getJson('/api/auth/me', [
            'Origin' => self::PRODUCTION_ORIGIN, 'Authorization' => 'Bearer invalid-token',
        ])->assertUnauthorized()->assertHeader('Access-Control-Allow-Origin', self::PRODUCTION_ORIGIN);
    }

    public function test_production_does_not_allow_unrelated_vercel_or_local_origins(): void
    {
        foreach (['https://unrelated.example', 'https://other-project.vercel.app', 'http://localhost:5173'] as $origin) {
            $this->options('/api/admin/itineraries', [], [
                'Origin' => $origin, 'Access-Control-Request-Method' => 'GET',
                'Access-Control-Request-Headers' => 'Authorization',
            ])->assertHeader('Access-Control-Allow-Origin', self::PRODUCTION_ORIGIN);
            // Laravel's CORS service emits the configured constant for a single origin.
            // Browsers reject it when it does not match the requesting origin.
            $this->assertNotSame($origin, self::PRODUCTION_ORIGIN);
            $this->getJson('/api/test', ['Origin' => $origin])
                ->assertOk()->assertHeader('Access-Control-Allow-Origin', self::PRODUCTION_ORIGIN);
        }
    }

    public function test_local_vite_origin_works_when_locally_configured(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173']]);
        $this->options('/api/auth/me', [], [
            'Origin' => 'http://localhost:5173', 'Access-Control-Request-Method' => 'GET',
            'Access-Control-Request-Headers' => 'Authorization',
        ])->assertNoContent()->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $this->getJson('/api/test', ['Origin' => 'http://localhost:5173'])
            ->assertOk()->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $this->options('/api/auth/me', [], [
            'Origin' => self::PRODUCTION_ORIGIN, 'Access-Control-Request-Method' => 'GET',
        ])->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    }

    public function test_retained_sanctum_csrf_path_has_preflight_support_without_cookie_credentials(): void
    {
        $this->options('/sanctum/csrf-cookie', [], [
            'Origin' => self::PRODUCTION_ORIGIN, 'Access-Control-Request-Method' => 'GET',
        ])->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', self::PRODUCTION_ORIGIN)
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
    }
}
