<?php

namespace App\Services;

use App\Models\HeritageSite;

class HeritageGeofence
{
    public static function hasCoordinates(HeritageSite $site): bool
    {
        return is_numeric($site->latitude) && is_numeric($site->longitude)
            && is_finite((float) $site->latitude) && is_finite((float) $site->longitude)
            && abs((float) $site->latitude) <= 90 && abs((float) $site->longitude) <= 180;
    }

    public static function distance(float $latitude, float $longitude, float $siteLatitude, float $siteLongitude): float
    {
        $a = sin(deg2rad($siteLatitude - $latitude) / 2) ** 2
            + cos(deg2rad($latitude)) * cos(deg2rad($siteLatitude)) * sin(deg2rad($siteLongitude - $longitude) / 2) ** 2;

        return 6371008.8 * 2 * atan2(sqrt(min(1, max(0, $a))), sqrt(max(0, 1 - $a)));
    }
}
