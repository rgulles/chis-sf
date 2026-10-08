<?php

// Read-only comparison of stored config, computed attribute, and both public responses.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
echo json_encode(['configs' => \App\Models\HeritageCheckinConfig::select(['id', 'heritage_site_id', 'enabled'])->get()->toArray()]).PHP_EOL;
if (in_array('--configs-only', $argv, true)) exit;
foreach (\App\Models\HeritageSite::with('checkinConfig')->withExists([
    'checkinConfig as verification_config_enabled' => fn ($query) => $query->where('enabled', true),
])->get() as $site) {
    $data = ['id' => $site->id, 'name' => $site->name, 'status' => $site->status,
        'latitude_present' => $site->latitude !== null, 'longitude_present' => $site->longitude !== null,
        'valid_coordinates' => \App\Services\HeritageGeofence::hasCoordinates($site),
        'config_exists' => $site->checkinConfig !== null, 'config_enabled' => $site->checkinConfig?->enabled,
        'exists_attribute' => $site->verification_config_enabled];
    if ($site->status === 'active') {
        foreach (['detail' => '/api/heritage-sites/'.$site->id, 'availability' => '/api/heritage-sites/'.$site->id.'/check-in'] as $key => $path) {
            $response = $kernel->handle(\Illuminate\Http\Request::create($path, 'GET', server: ['HTTP_ACCEPT' => 'application/json']));
            $body = json_decode($response->getContent(), true);
            $data[$key] = ['status' => $response->getStatusCode(), 'enabled' => $body[$key === 'detail' ? 'visit_verification_enabled' : 'enabled'] ?? null];
        }
    }
    echo json_encode($data).PHP_EOL;
}
