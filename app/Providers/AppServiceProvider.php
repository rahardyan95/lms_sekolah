<?php

namespace App\Providers;

use App\Contracts\WhatsappGatewayInterface;
use App\Services\WhatsappService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(WhatsappGatewayInterface::class, WhatsappService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
