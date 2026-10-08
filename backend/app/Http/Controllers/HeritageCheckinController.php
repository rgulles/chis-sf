<?php

namespace App\Http\Controllers;

use App\Models\HeritageCheckinConfig;
use App\Models\HeritageSite;
use App\Models\HeritageVisit;
use App\Models\User;
use App\Services\HeritageGeofence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HeritageCheckinController extends Controller
{
    // Public responses deliberately exclude legacy tokens, creators and precise site coordinates.
    public static function siteData(HeritageSite $site): array
    {
        return [...$site->only(['id', 'name', 'address', 'category', 'year_built', 'status']), 'images' => $site->images];
    }

    public function availability(HeritageSite $heritageSite)
    {
        abort_unless($heritageSite->status === 'active', 404);

        return ['enabled' => HeritageGeofence::hasCoordinates($heritageSite)
            && HeritageCheckinConfig::where('heritage_site_id', $heritageSite->id)->where('enabled', true)->exists()];
    }

    public function verify(Request $request, HeritageSite $heritageSite)
    {
        $data = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'accuracy' => 'nullable|numeric|between:0,10000',
        ]);
        // Serialize awards for each authenticated user; unique(user, site) is the DB backstop.
        return DB::transaction(function () use ($request, $heritageSite, $data) {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $site = HeritageSite::whereKey($heritageSite->id)->lockForUpdate()->firstOrFail();
            $config = HeritageCheckinConfig::where('heritage_site_id', $site->id)->lockForUpdate()->first();
            abort_unless($site->status === 'active', 404);
            if (! $config || ! $config->enabled) return response()->json(['code' => 'disabled', 'message' => 'Visit verification is currently disabled for this site.'], 409);
            if (! HeritageGeofence::hasCoordinates($site)) return response()->json(['code' => 'unavailable', 'message' => 'This site is not ready for location verification.'], 409);
            $existing = HeritageVisit::where('user_id', $request->user()->id)->where('heritage_site_id', $site->id)->first();
            if ($existing) return ['status' => 'already_visited', 'visit' => $existing->only(['id', 'heritage_site_id', 'verified_at', 'points_awarded']), 'points_earned' => 0];
            // Accuracy is a diagnostic quality gate, never a geofence expansion.
            $accuracy = $data['accuracy'] ?? null;
            if ($accuracy === null || (float) $accuracy > min(100, $config->radius_meters)) {
                return response()->json(['code' => 'weak_accuracy', 'message' => 'GPS accuracy is weak or unavailable. Move into an open area and try again.'], 422);
            }
            $distance = HeritageGeofence::distance((float) $data['latitude'], (float) $data['longitude'], (float) $site->latitude, (float) $site->longitude);
            if ($distance > $config->radius_meters) return response()->json(['code' => 'outside', 'message' => "You're outside the verification area for this heritage site.", 'approximate_distance_meters' => (int) round($distance)], 422);
            $visit = HeritageVisit::create(['user_id' => $request->user()->id, 'heritage_site_id' => $site->id, 'verification_method' => 'geofence', 'distance_meters' => $distance, 'accuracy_meters' => $accuracy, 'points_awarded' => 100, 'verified_at' => now()]);

            return response()->json(['status' => 'verified', 'visit' => $visit->only(['id', 'heritage_site_id', 'verified_at', 'points_awarded']), 'points_earned' => 100], 201);
        }, 3);
    }

    public function passport(Request $request)
    {
        $visits = HeritageVisit::where('user_id', $request->user()->id)->with('heritageSite.images')->orderByDesc('verified_at')->orderByDesc('id')->get();
        $eligible = HeritageCheckinConfig::where('enabled', true)->whereHas('heritageSite', fn ($query) => $query->where('status', 'active'))->with('heritageSite.images')->get()
            ->filter(fn ($config) => HeritageGeofence::hasCoordinates($config->heritageSite))->map(fn ($config) => self::siteData($config->heritageSite))->values();
        $visitedEligible = $eligible->whereIn('id', $visits->pluck('heritage_site_id'))->count();

        return ['total_points' => $visits->sum('points_awarded'), 'visited_count' => $visits->count(), 'eligible_site_count' => $eligible->count(), 'visited_eligible_count' => $visitedEligible,
            'visits' => $visits->map(fn ($visit) => [...$visit->only(['id', 'heritage_site_id', 'verified_at', 'points_awarded']), 'site' => self::siteData($visit->heritageSite)]), 'eligible_sites' => $eligible];
    }

    public function adminIndex()
    {
        return HeritageCheckinConfig::with('heritageSite.images')->orderBy('id')->get()->map(fn ($config) => [...$config->toArray(), 'verified_visitors' => HeritageVisit::where('heritage_site_id', $config->heritage_site_id)->count()]);
    }

    public function configure(Request $request, HeritageSite $heritageSite)
    {
        $data = $request->validate(['enabled' => 'required|boolean', 'radius_meters' => 'required|integer|between:25,500']);

        return DB::transaction(function () use ($request, $heritageSite, $data) {
            $site = HeritageSite::whereKey($heritageSite->id)->lockForUpdate()->firstOrFail();
            if ($data['enabled'] && ($site->status !== 'active' || ! HeritageGeofence::hasCoordinates($site))) {
                throw ValidationException::withMessages(['enabled' => 'Only active sites with valid coordinates can enable visit verification.']);
            }
            $config = HeritageCheckinConfig::firstOrCreate(['heritage_site_id' => $site->id], ['public_token' => HeritageCheckinConfig::generateToken(), 'created_by' => $request->user()->id]);
            $config->update($data);

            return response()->json($config);
        }, 3);
    }

}
