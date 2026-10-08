<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn ($request, $exception) => $request->is('api/*') || $request->expectsJson());
        // Preserve validation responses and development diagnostics; sanitize server failures.
        $exceptions->respond(function ($response) {
            if (request()->is('api/*') && $response->getStatusCode() >= 500 && (app()->environment('production') || ! config('app.debug'))) {
                return response()->json(['message' => 'CHIS is temporarily unavailable. Please try again later.'], $response->getStatusCode(), array_filter(['Retry-After' => $response->headers->get('Retry-After')]));
            }
            return $response;
        });
    })->create();
