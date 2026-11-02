<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (env('SEED_DEMO', false)) {
            $this->call(DemoSeeder::class);
        } else {
            $this->call(ErpSeeder::class);
        }
    }
}
