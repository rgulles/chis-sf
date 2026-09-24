<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HeritageSiteController;
use App\Http\Controllers\SiteImageController;
use App\Http\Controllers\EventController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/test', function () {
    return response()->json([
        'message' => 'CHIS Laravel API is working!'
    ]);
});

Route::apiResource('heritage-sites', HeritageSiteController::class);
Route::apiResource('site-images', SiteImageController::class);
Route::apiResource('events', EventController::class);