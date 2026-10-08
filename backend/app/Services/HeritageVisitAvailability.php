<?php

namespace App\Services;

use App\Models\HeritageSite;
use Illuminate\Database\Eloquent\Builder;

class HeritageVisitAvailability
{
    public static function withEnabledConfig(Builder $query): Builder
    {
        return $query->withExists([
            'checkinConfig as verification_config_enabled' => fn ($config) => $config->where('enabled', true),
        ]);
    }

    public static function enabled(HeritageSite $site): bool
    {
        return $site->status === 'active' && HeritageGeofence::hasCoordinates($site)
            && (bool) $site->verification_config_enabled;
    }
}
