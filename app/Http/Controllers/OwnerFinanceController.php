<?php

namespace App\Http\Controllers;

use App\Models\OwnerFinanceBatch;
use App\Models\PartnerCapitalLoan;
use App\Models\PartnerProfile;
use App\Services\OwnerFinanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class OwnerFinanceController extends Controller
{
    public function __construct(private OwnerFinanceService $ownerFinanceService) {}

    public function index(Request $request)
    {
        $user = $request->user();
        abort_if(! $user?->isOwner() && ! $user?->isPartner(), 403, 'Hanya owner dan partner yang dapat membuka bagi hasil.');

        $filters = $request->validate([
            'outlet_id' => ['nullable', 'string', 'exists:outlets,id'],
            'period_start' => ['nullable', 'date_format:Y-m-d'],
            'period_end' => ['nullable', 'date_format:Y-m-d'],
            'payout_method' => ['nullable', Rule::in(['CASH', 'QRIS'])],
            'salary_overrides' => ['nullable', 'array'],
            'salary_overrides.*' => ['nullable', 'numeric', 'min:0'],
            'loan_allocations' => ['nullable', 'array'],
            'loan_allocations.*' => ['nullable', 'numeric', 'min:0'],
        ]);

        $outlets = $this->ownerFinanceService->allowedOutlets($user);
        $selectedOutletId = $filters['outlet_id']
            ?? $request->session()->get('outlet_id')
            ?? $outlets->first()?->id;

        if ($selectedOutletId && ! $outlets->contains('id', $selectedOutletId)) {
            abort(403, 'Outlet tidak tersedia untuk akun ini.');
        }

        $start = ! empty($filters['period_start'])
            ? Carbon::createFromFormat('Y-m-d', $filters['period_start'])->startOfDay()
            : now()->startOfMonth();
        $end = ! empty($filters['period_end'])
            ? Carbon::createFromFormat('Y-m-d', $filters['period_end'])->endOfDay()
            : now()->endOfDay();
        if ($end->lt($start)) {
            $end = $start->copy()->endOfDay();
        }

        $filterPayload = [
            'outlet_id' => $selectedOutletId,
            'period_start' => $start->format('Y-m-d'),
            'period_end' => $end->format('Y-m-d'),
            'payout_method' => $filters['payout_method'] ?? 'CASH',
            'salary_overrides' => $filters['salary_overrides'] ?? [],
            'loan_allocations' => $filters['loan_allocations'] ?? [],
        ];

        return Inertia::render('OwnerFinance/Index', [
            'isOwner' => $user->isOwner(),
            'outlets' => $outlets->values(),
            'filters' => $filterPayload,
            'preview' => $selectedOutletId
                ? $this->ownerFinanceService->preview($user, $selectedOutletId, $start, $end, $filterPayload)
                : null,
            'stakeholders' => $user->isOwner() ? $this->ownerFinanceService->stakeholderRows($selectedOutletId) : [],
            'investments' => $this->ownerFinanceService->investmentsForUser($user, $selectedOutletId),
            'loans' => $this->ownerFinanceService->loanRows($user, $selectedOutletId),
            'batches' => $this->ownerFinanceService->batchRows($user, $selectedOutletId),
        ]);
    }

    public function storeBatch(Request $request)
    {
        $data = $request->validate([
            'outlet_id' => ['required', 'string', 'exists:outlets,id'],
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d'],
            'payout_method' => ['required', Rule::in(['CASH', 'QRIS'])],
            'intent' => ['nullable', Rule::in([OwnerFinanceBatch::STATUS_DRAFT, OwnerFinanceBatch::STATUS_POSTED])],
            'salary_overrides' => ['nullable', 'array'],
            'salary_overrides.*' => ['nullable', 'numeric', 'min:0'],
            'loan_allocations' => ['nullable', 'array'],
            'loan_allocations.*' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $batch = $this->ownerFinanceService->saveBatch($request->user(), $data);

        $message = $batch->status === OwnerFinanceBatch::STATUS_POSTED
            ? 'Pembagian hasil berhasil diposting.'
            : 'Draft pembagian hasil berhasil disimpan.';

        return redirect()->back()->with('success', $message);
    }

    public function postBatch(Request $request, OwnerFinanceBatch $batch)
    {
        $this->ownerFinanceService->postBatch($batch, $request->user());

        return redirect()->back()->with('success', 'Pembagian hasil berhasil diposting.');
    }

    public function storeProfile(Request $request)
    {
        $data = $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
            'default_salary' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $this->ownerFinanceService->upsertProfile($request->user(), $data);

        return redirect()->back()->with('success', 'Gaji awal berhasil disimpan.');
    }

    public function updateProfile(Request $request, PartnerProfile $profile)
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'string', 'exists:users,id'],
            'default_salary' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $data['user_id'] = $data['user_id'] ?? $profile->user_id;

        $this->ownerFinanceService->upsertProfile($request->user(), $data, $profile);

        return redirect()->back()->with('success', 'Gaji awal berhasil diperbarui.');
    }

    public function storeLoan(Request $request)
    {
        $data = $request->validate([
            'borrower_user_id' => ['required', 'string', 'exists:users,id'],
            'lender_user_id' => ['required', 'string', 'exists:users,id'],
            'investment_id' => ['nullable', 'string', 'exists:investments,id'],
            'principal_amount' => ['required', 'numeric', 'min:1'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $this->ownerFinanceService->createLoan($request->user(), $data);

        return redirect()->back()->with('success', 'Pinjaman modal berhasil dicatat.');
    }

    public function updateLoan(Request $request, PartnerCapitalLoan $loan)
    {
        $data = $request->validate([
            'remaining_amount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in([
                PartnerCapitalLoan::STATUS_ACTIVE,
                PartnerCapitalLoan::STATUS_PAID,
                PartnerCapitalLoan::STATUS_CANCELED,
            ])],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $this->ownerFinanceService->updateLoan($request->user(), $loan, $data);

        return redirect()->back()->with('success', 'Pinjaman modal berhasil diperbarui.');
    }
}
