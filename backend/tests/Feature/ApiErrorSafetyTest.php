<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiErrorSafetyTest extends TestCase
{
    public function test_production_server_errors_are_json_without_internal_details_even_with_debug_enabled(): void
    {
        config(['app.debug' => true, 'app.env' => 'production']);
        $this->app->instance('env', 'production');
        Route::get('/api/test-safe-failure', fn () => throw new \RuntimeException('SQLSTATE private path /var/app/secret.php'));
        $this->get('/api/test-safe-failure')->assertStatus(500)->assertHeader('Content-Type', 'application/json')
            ->assertExactJson(['message' => 'CHIS is temporarily unavailable. Please try again later.']);
    }

    public function test_validation_errors_remain_useful_and_unknown_api_routes_return_json(): void
    {
        config(['app.debug' => false]);
        Route::post('/api/test-safe-validation', fn (Request $request) => $request->validate(['name' => 'required|string']));
        $this->postJson('/api/test-safe-validation')->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->get('/api/unknown-record')->assertNotFound()->assertHeader('Content-Type', 'application/json');
    }
}
