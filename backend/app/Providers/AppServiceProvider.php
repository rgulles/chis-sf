<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use PHPOpenSourceSaver\JWTAuth\Http\Parser\AuthHeaders;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // API credentials are accepted exclusively in Authorization headers, never URLs.
        $this->app['tymon.jwt.parser']->setChain([
            new AuthHeaders,
        ]);
        Gate::define('admin', fn (User $user): bool => $user->role === 'admin');
    }
}
