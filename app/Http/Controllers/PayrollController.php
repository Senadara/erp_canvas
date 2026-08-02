<?php

namespace App\Http\Controllers;

use App\Models\EmployeeSalaryPayment;
use App\Models\ShiftRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PayrollController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if (! $this->canManagePayroll($user)) {
            abort(403, 'Anda tidak memiliki akses ke halaman gaji pegawai.');
        }

        $startDate = $request->query('start_date')
            ? Carbon::parse($request->query('start_date'))->startOfDay()
            : now()->startOfMonth();
        $endDate = $request->query('end_date')
            ? Carbon::parse($request->query('end_date'))->endOfDay()
            : now()->endOfMonth();
        if ($endDate->lt($startDate)) {
            $endDate = $startDate->copy()->endOfDay();
        }

        $employeeId = $request->query('employee_id');
        $employees = User::where('role', 'STAFF')
            ->where('is_active', true)
            ->orderBy('display_name')
            ->get(['id', 'display_name', 'email']);

        $filteredEmployees = $employeeId
            ? $employees->where('id', $employeeId)->values()
            : $employees;

        $payments = EmployeeSalaryPayment::with(['employee:id,display_name', 'payer:id,display_name'])
            ->where('period_start', '<=', $endDate)
            ->where('period_end', '>=', $startDate)
            ->when($employeeId, fn ($query) => $query->where('employee_id', $employeeId))
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->get();

        $shiftStats = $this->shiftStatsForEmployees($filteredEmployees->pluck('id')->all(), $startDate, $endDate);
        $paymentTotals = $payments
            ->groupBy('employee_id')
            ->map(fn ($rows) => [
                'payment_count' => $rows->count(),
                'paid_total' => (float) $rows->sum(fn (EmployeeSalaryPayment $payment) => (float) $payment->total_amount),
            ]);

        $summaries = $filteredEmployees->map(function (User $employee) use ($shiftStats, $paymentTotals) {
            $stats = $shiftStats[$employee->id] ?? $this->emptyShiftStats();
            $payment = $paymentTotals[$employee->id] ?? ['payment_count' => 0, 'paid_total' => 0];

            return [
                'employee_id' => $employee->id,
                'employee_name' => $employee->display_name,
                'email' => $employee->email,
                ...$stats,
                'payment_count' => $payment['payment_count'],
                'paid_total' => $payment['paid_total'],
            ];
        })->values();

        return Inertia::render('Payroll/Index', [
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'employee_id' => $employeeId,
            ],
            'employees' => $employees->map(fn (User $employee) => [
                'id' => $employee->id,
                'display_name' => $employee->display_name,
                'email' => $employee->email,
            ])->values(),
            'summaries' => $summaries,
            'payments' => $payments->map(fn (EmployeeSalaryPayment $payment) => $this->formatPayment($payment))->values(),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (! $this->canManagePayroll($user)) {
            abort(403, 'Anda tidak memiliki akses ke halaman gaji pegawai.');
        }

        $data = $request->validate([
            'employee_id' => ['required', Rule::exists('users', 'id')->where('role', 'STAFF')],
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:period_start'],
            'base_amount' => ['required', 'numeric', 'min:0'],
            'bonus_amount' => ['nullable', 'numeric', 'min:0'],
            'deduction_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $employee = User::where('role', 'STAFF')->findOrFail($data['employee_id']);
        $startDate = Carbon::createFromFormat('Y-m-d', $data['period_start'])->startOfDay();
        $endDate = Carbon::createFromFormat('Y-m-d', $data['period_end'])->endOfDay();
        $stats = $this->shiftStatsForEmployees([$employee->id], $startDate, $endDate)[$employee->id] ?? $this->emptyShiftStats();

        $baseAmount = (float) $data['base_amount'];
        $bonusAmount = (float) ($data['bonus_amount'] ?? 0);
        $deductionAmount = (float) ($data['deduction_amount'] ?? 0);
        $totalAmount = max(0, $baseAmount + $bonusAmount - $deductionAmount);

        EmployeeSalaryPayment::create([
            'employee_id' => $employee->id,
            'employee_name' => $employee->display_name,
            'period_start' => $startDate,
            'period_end' => $endDate,
            'work_days' => $stats['work_days'],
            'shift_count' => $stats['shift_count'],
            'total_minutes' => $stats['total_minutes'],
            'average_minutes' => $stats['average_minutes'],
            'longest_shift_minutes' => $stats['longest_shift']['duration_minutes'] ?? 0,
            'shortest_shift_minutes' => $stats['shortest_shift']['duration_minutes'] ?? 0,
            'base_amount' => round($baseAmount),
            'bonus_amount' => round($bonusAmount),
            'deduction_amount' => round($deductionAmount),
            'total_amount' => round($totalAmount),
            'note' => $data['note'] ?? null,
            'shift_snapshot' => $stats['shift_details'],
            'paid_at' => isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : now(),
            'paid_by' => $user->id,
        ]);

        return back()->with('success', 'Pembayaran gaji berhasil dicatat.');
    }

    private function canManagePayroll(?User $user): bool
    {
        return (bool) ($user && ($user->isOwner() || ($user->feature_overrides['payroll'] ?? false)));
    }

    private function shiftStatsForEmployees(array $employeeIds, Carbon $startDate, Carbon $endDate): array
    {
        if (empty($employeeIds)) {
            return [];
        }

        $shifts = ShiftRecord::with('outlet:id,name')
            ->whereIn('opened_by', $employeeIds)
            ->whereNotNull('closed_at')
            ->whereBetween('opened_at', [$startDate, $endDate])
            ->orderBy('opened_at')
            ->get();

        $stats = [];
        foreach ($shifts->groupBy('opened_by') as $employeeId => $employeeShifts) {
            $details = $employeeShifts->map(function (ShiftRecord $shift) {
                $minutes = max(0, (int) $shift->opened_at->diffInMinutes($shift->closed_at));

                return [
                    'id' => $shift->id,
                    'name' => $shift->name ?: 'Shift',
                    'outlet_name' => $shift->outlet?->name,
                    'work_date' => $shift->opened_at->toDateString(),
                    'opened_at' => $shift->opened_at->toIso8601String(),
                    'closed_at' => $shift->closed_at?->toIso8601String(),
                    'duration_minutes' => $minutes,
                    'duration_label' => $this->durationLabel($minutes),
                ];
            })->values();

            $shiftCount = $details->count();
            $totalMinutes = (int) $details->sum('duration_minutes');
            $averageMinutes = $shiftCount > 0 ? (int) round($totalMinutes / $shiftCount) : 0;
            $longest = $details->sortByDesc('duration_minutes')->first();
            $shortest = $details->sortBy('duration_minutes')->first();

            $stats[$employeeId] = [
                'work_days' => $details->pluck('work_date')->unique()->count(),
                'shift_count' => $shiftCount,
                'total_minutes' => $totalMinutes,
                'total_label' => $this->durationLabel($totalMinutes),
                'average_minutes' => $averageMinutes,
                'average_label' => $this->durationLabel($averageMinutes),
                'longest_shift' => $longest,
                'shortest_shift' => $shortest,
                'shift_details' => $details,
            ];
        }

        return $stats;
    }

    private function emptyShiftStats(): array
    {
        return [
            'work_days' => 0,
            'shift_count' => 0,
            'total_minutes' => 0,
            'total_label' => '0j 0m',
            'average_minutes' => 0,
            'average_label' => '0j 0m',
            'longest_shift' => null,
            'shortest_shift' => null,
            'shift_details' => [],
        ];
    }

    private function formatPayment(EmployeeSalaryPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'employee_id' => $payment->employee_id,
            'employee_name' => $payment->employee?->display_name ?: $payment->employee_name,
            'period_start' => $payment->period_start->format('Y-m-d'),
            'period_end' => $payment->period_end->format('Y-m-d'),
            'work_days' => $payment->work_days,
            'shift_count' => $payment->shift_count,
            'total_minutes' => $payment->total_minutes,
            'total_label' => $this->durationLabel($payment->total_minutes),
            'average_minutes' => $payment->average_minutes,
            'average_label' => $this->durationLabel($payment->average_minutes),
            'longest_shift_minutes' => $payment->longest_shift_minutes,
            'longest_shift_label' => $this->durationLabel($payment->longest_shift_minutes),
            'shortest_shift_minutes' => $payment->shortest_shift_minutes,
            'shortest_shift_label' => $this->durationLabel($payment->shortest_shift_minutes),
            'base_amount' => (float) $payment->base_amount,
            'bonus_amount' => (float) $payment->bonus_amount,
            'deduction_amount' => (float) $payment->deduction_amount,
            'total_amount' => (float) $payment->total_amount,
            'paid_at' => $payment->paid_at?->toIso8601String(),
            'paid_by' => $payment->payer?->display_name,
            'note' => $payment->note,
            'shift_snapshot' => $payment->shift_snapshot ?? [],
        ];
    }

    private function durationLabel(int $minutes): string
    {
        $hours = intdiv(max(0, $minutes), 60);
        $remainingMinutes = max(0, $minutes) % 60;

        return "{$hours}j {$remainingMinutes}m";
    }
}
