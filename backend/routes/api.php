<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HeritageSiteController;
use App\Http\Controllers\SiteImageController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\HeritageTimelineController;
use App\Http\Controllers\ItineraryController;
use App\Http\Controllers\HeritageCheckinController;
use App\Http\Controllers\HeritageContributionController;

Route::get('/heritage-sites/{heritageSite}/contributions', [HeritageContributionController::class, 'index']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/heritage-sites/{heritageSite}/contributions/mine', [HeritageContributionController::class, 'mine']);
    Route::post('/heritage-sites/{heritageSite}/contributions', [HeritageContributionController::class, 'store'])->middleware('throttle:5,1');
});
Route::middleware(['auth:sanctum', 'can:admin'])->group(function () {
    Route::get('/admin/contributions', [HeritageContributionController::class, 'adminIndex']);
    Route::patch('/admin/contributions/{contribution}', [HeritageContributionController::class, 'moderate']);
    Route::delete('/admin/contributions/{contribution}', [HeritageContributionController::class, 'destroy']);
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/test', function () {
    return response()->json([
        'message' => 'CHIS Laravel API is working!'
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/google', [AuthController::class, 'google'])->middleware('throttle:10,1');
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::get('/heritage-sites/{heritageSite}/check-in', [HeritageCheckinController::class, 'availability']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/passport', [HeritageCheckinController::class, 'passport']);
    Route::post('/heritage-sites/{heritageSite}/verify-visit', [HeritageCheckinController::class, 'verify'])->middleware('throttle:10,1');
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

Route::apiResource('heritage-sites', HeritageSiteController::class)->only(['index', 'show']);
Route::apiResource('site-images', SiteImageController::class)->only(['index', 'show']);
Route::apiResource('events', EventController::class)->only(['index', 'show']);
Route::apiResource('itineraries', ItineraryController::class)->only(['index', 'show']);

Route::get('heritage-sites/{heritageSiteId}/timelines', [HeritageTimelineController::class, 'index']);
Route::apiResource('heritage-timelines', HeritageTimelineController::class)->only('show');

Route::middleware(['auth:sanctum', 'can:admin'])->group(function () {
    Route::get('admin/travelers', [AuthController::class, 'travelers']);
    Route::get('admin/check-in-configs', [HeritageCheckinController::class, 'adminIndex']);
    Route::put('admin/heritage-sites/{heritageSite}/check-in', [HeritageCheckinController::class, 'configure']);
    Route::get('admin/itineraries', [ItineraryController::class, 'adminIndex']);
    Route::get('admin/itineraries/{itinerary}', [ItineraryController::class, 'adminShow']);
    Route::apiResource('itineraries', ItineraryController::class)->only(['store', 'update', 'destroy']);
    Route::get('admin/heritage-sites', [HeritageSiteController::class, 'adminIndex']);
    Route::get('admin/heritage-sites/{heritageSite}', [HeritageSiteController::class, 'adminShow']);
    Route::get('admin/site-images', [SiteImageController::class, 'adminIndex']);
    Route::apiResource('heritage-sites', HeritageSiteController::class)->only(['store', 'update', 'destroy']);
    Route::apiResource('site-images', SiteImageController::class)->only(['store', 'update', 'destroy']);
    Route::apiResource('events', EventController::class)->only(['store', 'update', 'destroy']);
    Route::apiResource('heritage-timelines', HeritageTimelineController::class)->only(['store', 'update', 'destroy']);
});
