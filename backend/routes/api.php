<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HeritageSiteController;
use App\Http\Controllers\SiteImageController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\AuthController;

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

use App\Http\Controllers\HeritageTimelineController;

Route::apiResource('heritage-sites', HeritageSiteController::class);
Route::apiResource('site-images', SiteImageController::class);
Route::apiResource('events', EventController::class);

Route::get('heritage-sites/{heritageSiteId}/timelines', [HeritageTimelineController::class, 'index']);
Route::apiResource('heritage-timelines', HeritageTimelineController::class)->except('index');