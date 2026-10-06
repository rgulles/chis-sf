<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HeritageSiteController;
use App\Http\Controllers\SiteImageController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\HeritageTimelineController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/test', function () {
    return response()->json([
        'message' => 'CHIS Laravel API is working!'
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

Route::apiResource('heritage-sites', HeritageSiteController::class)->only(['index', 'show']);
Route::apiResource('site-images', SiteImageController::class)->only(['index', 'show']);
Route::apiResource('events', EventController::class)->only(['index', 'show']);

Route::get('heritage-sites/{heritageSiteId}/timelines', [HeritageTimelineController::class, 'index']);
Route::apiResource('heritage-timelines', HeritageTimelineController::class)->only('show');

Route::middleware(['auth:sanctum', 'can:admin'])->group(function () {
    Route::get('admin/heritage-sites', [HeritageSiteController::class, 'adminIndex']);
    Route::get('admin/heritage-sites/{heritageSite}', [HeritageSiteController::class, 'adminShow']);
    Route::get('admin/site-images', [SiteImageController::class, 'adminIndex']);
    Route::apiResource('heritage-sites', HeritageSiteController::class)->only(['store', 'update', 'destroy']);
    Route::apiResource('site-images', SiteImageController::class)->only(['store', 'update', 'destroy']);
    Route::apiResource('events', EventController::class)->only(['store', 'update', 'destroy']);
    Route::apiResource('heritage-timelines', HeritageTimelineController::class)->only(['store', 'update', 'destroy']);
});
