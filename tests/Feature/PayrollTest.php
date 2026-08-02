<?php

namespace Tests\Feature;

use App\Models\EmployeeSalaryPayment;
use App\Models\Outlet;
use App\Models\ShiftRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PayrollTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_view_and_create_salary_payment_with_shift_summary(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-15 12:00:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Payroll']);
            $owner = $this->createUser('owner-payroll@karsa.local', 'OWNER', 'Owner Payroll');
            $staff = $this->createUser('staff-payroll@karsa.local', 'STAFF', 'Rina Kasir');
            $staff->outlets()->attach($outlet->id);

            ShiftRecord::create([
                'outlet_id' => $outlet->id,
                'name' => 'Shift Pagi',
                'opened_by' => $staff->id,
                'closed_by' => $staff->id,
                'opened_at' => Carbon::parse('2026-07-01 08:00:00'),
                'closed_at' => Carbon::parse('2026-07-01 16:00:00'),
                'opening_cash' => 50000,
                'expected_cash' => 150000,
                'actual_cash' => 150000,
                'status' => 'CLOSED',
            ]);
            ShiftRecord::create([
                'outlet_id' => $outlet->id,
                'name' => 'Shift Sore',
                'opened_by' => $staff->id,
                'closed_by' => $staff->id,
                'opened_at' => Carbon::parse('2026-07-02 10:00:00'),
                'closed_at' => Carbon::parse('2026-07-02 16:00:00'),
                'opening_cash' => 50000,
                'expected_cash' => 120000,
                'actual_cash' => 120000,
                'status' => 'CLOSED',
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('payroll', [
                    'start_date' => '2026-07-01',
                    'end_date' => '2026-07-31',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Payroll/Index')
                    ->has('summaries', 1)
                    ->where('summaries.0.employee_name', 'Rina Kasir')
                    ->where('summaries.0.work_days', 2)
                    ->where('summaries.0.shift_count', 2)
                    ->where('summaries.0.total_minutes', 840)
                    ->where('summaries.0.average_minutes', 420)
                    ->where('summaries.0.longest_shift.duration_minutes', 480)
                    ->where('summaries.0.shortest_shift.duration_minutes', 360)
                );

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('payroll.store'), [
                    'employee_id' => $staff->id,
                    'period_start' => '2026-07-01',
                    'period_end' => '2026-07-31',
                    'base_amount' => 100000,
                    'bonus_amount' => 25000,
                    'deduction_amount' => 10000,
                    'paid_at' => '2026-07-15',
                    'note' => 'Gaji paruh bulan',
                ])
                ->assertRedirect()
                ->assertSessionHas('success');

            $payment = EmployeeSalaryPayment::firstOrFail();
            $this->assertSame($staff->id, $payment->employee_id);
            $this->assertSame(2, $payment->work_days);
            $this->assertSame(2, $payment->shift_count);
            $this->assertSame(840, $payment->total_minutes);
            $this->assertSame(420, $payment->average_minutes);
            $this->assertSame(480, $payment->longest_shift_minutes);
            $this->assertSame(360, $payment->shortest_shift_minutes);
            $this->assertSame(115000.0, (float) $payment->total_amount);
            $this->assertCount(2, $payment->shift_snapshot);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function createUser(string $email, string $role, string $name): User
    {
        return User::create([
            'email' => $email,
            'password_hash' => Hash::make('password'),
            'display_name' => $name,
            'role' => $role,
            'is_active' => true,
        ]);
    }
}
