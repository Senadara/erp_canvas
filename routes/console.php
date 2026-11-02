<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Reset database demo setiap hari pukul 03:00 WIB (20:00 UTC)
// Hanya aktif jika SEED_DEMO=true di .env
if (env('SEED_DEMO', false)) {
    Schedule::command('demo:reset --force')
        ->dailyAt('20:00') // UTC = 03:00 WIB
        ->timezone('UTC')
        ->withoutOverlapping()
        ->runInBackground()
        ->appendOutputTo(storage_path('logs/demo-reset.log'));
}
