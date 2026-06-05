<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
class ErpSeeder extends Seeder
{
    public function run(): void
    {
        $outlet = Outlet::create([
            'name' => 'Outlet Utama',
            'address' => null,
            'phone' => null,
        ]);

        $email = env('SEED_OWNER_EMAIL', 'owner@karsa.local');
        $password = env('SEED_OWNER_PASSWORD', 'Owner123!');

        $owner = User::create([
            'email' => $email,
            'password_hash' => Hash::make($password),
            'display_name' => 'Owner',
            'role' => 'OWNER',
            'is_active' => true,
        ]);

        $owner->outlets()->attach($outlet->id);
    }
}
