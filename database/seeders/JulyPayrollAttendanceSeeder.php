<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\ShiftRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class JulyPayrollAttendanceSeeder extends Seeder
{
    public function run(): void
    {
        $outlet = Outlet::where('name', 'Lapangan Karaeng Galengsong')->first()
            ?: Outlet::first()
            ?: Outlet::create(['name' => 'Outlet Simulasi Juli']);

        $staff = User::updateOrCreate(
            ['email' => 'sim-staff-juli@karsa.local'],
            [
                'display_name' => 'SIM Staff Juli',
                'password_hash' => Hash::make('password'),
                'role' => 'STAFF',
                'is_active' => true,
            ],
        );
        $staff->outlets()->syncWithoutDetaching([$outlet->id]);

        $closedShifts = [
            ['date' => '2026-07-01', 'name' => 'SIM JULI Shift Pagi', 'open' => '08:00:00', 'close' => '16:00:00'],
            ['date' => '2026-07-02', 'name' => 'SIM JULI Shift Pagi', 'open' => '08:00:00', 'close' => '14:00:00'],
            ['date' => '2026-07-02', 'name' => 'SIM JULI Shift Sore', 'open' => '16:00:00', 'close' => '21:00:00'],
            ['date' => '2026-07-05', 'name' => 'SIM JULI Shift Weekend', 'open' => '09:00:00', 'close' => '17:00:00'],
            ['date' => '2026-07-15', 'name' => 'SIM JULI Shift Tengah Bulan', 'open' => '08:30:00', 'close' => '16:30:00'],
            ['date' => '2026-07-31', 'name' => 'SIM JULI Shift Akhir Bulan', 'open' => '08:00:00', 'close' => '15:00:00'],
        ];

        foreach ($closedShifts as $row) {
            $openedAt = Carbon::parse("{$row['date']} {$row['open']}");
            $closedAt = Carbon::parse("{$row['date']} {$row['close']}");
            $minutes = $openedAt->diffInMinutes($closedAt);

            ShiftRecord::updateOrCreate(
                [
                    'outlet_id' => $outlet->id,
                    'name' => "{$row['name']} {$row['date']}",
                ],
                [
                    'opened_by' => $staff->id,
                    'closed_by' => $staff->id,
                    'opened_at' => $openedAt,
                    'closed_at' => $closedAt,
                    'opening_cash' => 50000,
                    'expected_cash' => 50000,
                    'actual_cash' => 50000,
                    'expected_qris' => 0,
                    'discrepancy' => 0,
                    'total_sales_cash' => 0,
                    'total_sales_qris' => 0,
                    'total_expenses' => 0,
                    'status' => 'CLOSED',
                    'note' => "SIM JULI attendance seed ({$minutes} menit)",
                ],
            );
        }

        ShiftRecord::updateOrCreate(
            [
                'outlet_id' => $outlet->id,
                'name' => 'SIM JULI Shift Belum Tutup 2026-07-20',
            ],
            [
                'opened_by' => $staff->id,
                'closed_by' => null,
                'opened_at' => Carbon::parse('2026-07-20 08:00:00'),
                'closed_at' => null,
                'opening_cash' => 50000,
                'expected_cash' => 50000,
                'actual_cash' => null,
                'expected_qris' => 0,
                'discrepancy' => 0,
                'total_sales_cash' => 0,
                'total_sales_qris' => 0,
                'total_expenses' => 0,
                'status' => 'OPEN',
                'note' => 'SIM JULI attendance seed - sengaja tidak dihitung payroll karena belum tutup',
            ],
        );
    }
}
