<?php

// Read-only local diagnostic. No seeders, migrations, authentication or mutations.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

foreach (['/api/itineraries', '/api/itineraries/1', '/api/heritage-sites/1/check-in', '/api/heritage-sites/1/contributions'] as $path) {
    \Illuminate\Support\Facades\DB::enableQueryLog();
    \Illuminate\Support\Facades\DB::flushQueryLog();
    $started = hrtime(true);
    $request = \Illuminate\Http\Request::create($path, 'GET', server: ['HTTP_ACCEPT' => 'application/json']);
    $response = $kernel->handle($request);
    $queries = \Illuminate\Support\Facades\DB::getQueryLog();
    echo json_encode(['path' => $path, 'status' => $response->getStatusCode(),
        'bytes' => strlen($response->getContent()), 'request_ms' => round((hrtime(true) - $started) / 1e6, 2),
        'query_count' => count($queries), 'query_ms' => round(array_sum(array_column($queries, 'time')), 2)]).PHP_EOL;
    $kernel->terminate($request, $response);
    \Illuminate\Support\Facades\DB::disableQueryLog();
}
