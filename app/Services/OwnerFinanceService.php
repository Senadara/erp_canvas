<?php

namespace App\Services;

use App\Models\EmployeeSalaryPayment;
use App\Models\Investment;
use App\Models\Outlet;
use App\Models\OwnerFinanceBatch;
use App\Models\OwnerFinanceItem;
use App\Models\PartnerCapitalLoan;
use App\Models\PartnerProfile;
use App\Models\PettyCash;
use App\Models\ShiftRecord;
use App\Models\Transaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OwnerFinanceService
{
    public function __construct(
        private ProductCostService $productCostService,
        private PettyCashService $pettyCashService,
    ) {}

    public function allowedOutlets(User $user): EloquentCollection
    {
        if ($user->isOwner()) {
            return Outlet::orderBy('name')->get(['id', 'name']);
        }

        if (! $user->isPartner()) {
            return new EloquentCollection();
        }

        $outletIds = $user->outlets()->pluck('outlets.id')
            ->merge(Investment::where('user_id', $user->id)->where('status', 'APPROVED')->pluck('outlet_id'))
            ->filter()
            ->unique()
            ->values();

        return Outlet::whereIn('id', $outletIds)
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    public function preview(User $viewer, string $outletId, Carbon $start, Carbon $end, array $options = []): array
    {
        $basis = $this->financeBasis($outletId, $start, $end);
        $stakeholders = $this->stakeholderUsers();
        $investmentTotals = $this->investmentTotals($outletId);
        $salaryOverrides = $this->numericMap($options['salary_overrides'] ?? []);
        $loanAllocations = $this->numericMap($options['loan_allocations'] ?? []);
        $payoutMethod = $this->normalizePayoutMethod($options['payout_method'] ?? null);
        $payoutMethodBalance = $payoutMethod === 'QRIS'
            ? (float) $basis['qris_balance']
            : (float) $basis['cash_balance'];
        $alreadyPosted = $this->postedBatchForPeriodExists($outletId, $start, $end);

        $salaryRows = $this->salaryRows($stakeholders, $salaryOverrides);
        $salaryRequestTotal = $salaryRows->sum('requested_salary');
        $maxSalaryPool = min(max(0, (float) $basis['profit_before_owner']), max(0, $payoutMethodBalance));
        $salaryRatio = $salaryRequestTotal > 0 && $salaryRequestTotal > $maxSalaryPool
            ? $maxSalaryPool / $salaryRequestTotal
            : 1.0;

        $salaryPaidTotal = 0.0;
        $salaryRows = $salaryRows->map(function (array $row) use ($salaryRatio, &$salaryPaidTotal) {
            $paid = round((float) $row['requested_salary'] * $salaryRatio);
            $salaryPaidTotal += $paid;

            return [
                ...$row,
                'final_salary' => $paid,
                'shortfall' => max(0, (float) $row['requested_salary'] - $paid),
            ];
        });

        $profitAfterSalary = max(0, (float) $basis['profit_before_owner'] - $salaryPaidTotal);
        $payoutAfterSalary = max(0, $payoutMethodBalance - $salaryPaidTotal);
        $dividendPool = min($profitAfterSalary, $payoutAfterSalary);
        $dividendRows = $this->dividendRows($stakeholders, $investmentTotals, $dividendPool);
        $loans = $this->activeLoans($outletId, $dividendRows->pluck('user.id')->all());

        [$loanRows, $loanTotalsByBorrower] = $this->loanRowsForPreview($loans, $dividendRows, $loanAllocations);
        $dividendRows = $dividendRows->map(function (array $row) use ($loanTotalsByBorrower) {
            $loanRepayment = (float) ($loanTotalsByBorrower[$row['user']['id']] ?? 0);
            $directPayout = max(0, (float) $row['dividend'] - $loanRepayment);

            return [
                ...$row,
                'loan_repayment' => round($loanRepayment),
                'direct_payout' => round($directPayout),
            ];
        });

        $loanRepaymentTotal = $loanRows->sum('allocation');
        $directDividendTotal = $dividendRows->sum('direct_payout');
        $retainedAmount = max(0, (float) $basis['profit_before_owner'] - $salaryPaidTotal - $dividendPool);
        $items = $this->previewItems($salaryRows, $dividendRows, $loanRows, $retainedAmount, $payoutMethod);

        $preview = [
            'outlet_id' => $outletId,
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'payout_method' => $payoutMethod,
            'basis' => $basis,
            'totals' => [
                'salary_requested' => round($salaryRequestTotal),
                'salary_paid' => round($salaryPaidTotal),
                'salary_shortfall' => round(max(0, $salaryRequestTotal - $salaryPaidTotal)),
                'dividend_pool' => round($dividendPool),
                'direct_dividend' => round($directDividendTotal),
                'loan_repayment' => round($loanRepaymentTotal),
                'total_payout' => round($salaryPaidTotal + $dividendPool),
                'retained_amount' => round($retainedAmount),
                'payout_method_balance' => round($payoutMethodBalance),
                'total_lots' => round($investmentTotals->sum('lots'), 4),
            ],
            'salary_rows' => $salaryRows->values()->all(),
            'dividend_rows' => $dividendRows->values()->all(),
            'loan_rows' => $loanRows->values()->all(),
            'items' => $items,
            'already_posted' => $alreadyPosted,
            'posting_message' => $alreadyPosted
                ? 'Periode ini sudah pernah diposting untuk outlet ini.'
                : null,
            'can_post' => ! $alreadyPosted && $salaryPaidTotal + $dividendPool <= max(0, $payoutMethodBalance) + 0.01,
        ];

        return $viewer->isPartner() ? $this->visiblePreviewForPartner($preview, $viewer) : $preview;
    }

    public function saveBatch(User $actor, array $data): OwnerFinanceBatch
    {
        abort_if(! $actor->isOwner(), 403, 'Hanya owner yang dapat membuat pembagian hasil.');

        $start = Carbon::parse($data['period_start'])->startOfDay();
        $end = Carbon::parse($data['period_end'])->endOfDay();
        if ($end->lt($start)) {
            $end = $start->copy()->endOfDay();
        }

        $intent = strtoupper((string) ($data['intent'] ?? OwnerFinanceBatch::STATUS_DRAFT));

        return DB::transaction(function () use ($actor, $data, $start, $end, $intent) {
            $this->lockOutletForOwnerFinance($data['outlet_id']);
            $this->assertPeriodHasNoPostedBatch($data['outlet_id'], $start, $end);

            $preview = $this->preview($actor, $data['outlet_id'], $start, $end, $data);

            $batch = OwnerFinanceBatch::create([
                'outlet_id' => $data['outlet_id'],
                'period_start' => $start,
                'period_end' => $end,
                'status' => OwnerFinanceBatch::STATUS_DRAFT,
                'payout_method' => $preview['payout_method'],
                'total_salary' => $preview['totals']['salary_paid'],
                'total_dividend' => $preview['totals']['dividend_pool'],
                'total_loan_repayment' => $preview['totals']['loan_repayment'],
                'total_payout' => $preview['totals']['total_payout'],
                'retained_amount' => $preview['totals']['retained_amount'],
                'summary_snapshot' => $preview,
                'note' => $data['note'] ?? null,
                'created_by' => $actor->id,
            ]);

            foreach ($preview['items'] as $item) {
                OwnerFinanceItem::create([
                    'owner_finance_batch_id' => $batch->id,
                    'source_user_id' => $item['source_user_id'] ?? null,
                    'recipient_user_id' => $item['recipient_user_id'] ?? null,
                    'partner_capital_loan_id' => $item['partner_capital_loan_id'] ?? null,
                    'type' => $item['type'],
                    'payment_method' => $item['payment_method'],
                    'amount' => $item['amount'],
                    'note' => $item['note'] ?? null,
                    'meta' => $item['meta'] ?? null,
                ]);
            }

            if ($intent === OwnerFinanceBatch::STATUS_POSTED) {
                return $this->postBatch($batch, $actor);
            }

            return $batch->load(['outlet', 'items.recipientUser', 'items.sourceUser']);
        });
    }

    public function postBatch(OwnerFinanceBatch $batch, User $actor): OwnerFinanceBatch
    {
        abort_if(! $actor->isOwner(), 403, 'Hanya owner yang dapat posting pembagian hasil.');

        return DB::transaction(function () use ($batch, $actor) {
            $lockedBatch = OwnerFinanceBatch::query()
                ->whereKey($batch->id)
                ->lockForUpdate()
                ->with(['items.recipientUser', 'items.sourceUser', 'items.loan'])
                ->firstOrFail();

            $this->lockOutletForOwnerFinance($lockedBatch->outlet_id);

            if ($lockedBatch->status !== OwnerFinanceBatch::STATUS_DRAFT) {
                throw ValidationException::withMessages([
                    'batch' => 'Pembagian ini sudah diposting atau tidak bisa diposting.',
                ]);
            }

            $this->assertPeriodHasNoPostedBatch(
                $lockedBatch->outlet_id,
                $lockedBatch->period_start->copy()->startOfDay(),
                $lockedBatch->period_end->copy()->endOfDay(),
                $lockedBatch->id
            );

            foreach ($lockedBatch->items as $item) {
                $amount = (float) $item->amount;
                if ($amount <= 0 || ! in_array($item->payment_method, ['CASH', 'QRIS'], true)) {
                    continue;
                }

                $movement = $this->pettyCashService->createExpense([
                    'outlet_id' => $lockedBatch->outlet_id,
                    'amount' => $amount,
                    'category' => PettyCashService::OWNER_DISTRIBUTION_CATEGORY,
                    'payment_method' => $item->payment_method,
                    'cash_flow' => 'OUT',
                    'description' => $this->payoutDescription($lockedBatch, $item),
                    'date' => now(),
                ]);

                $item->update(['petty_cash_id' => $movement->id]);

                if ($item->type === OwnerFinanceItem::TYPE_LOAN_REPAYMENT && $item->loan) {
                    $loan = PartnerCapitalLoan::whereKey($item->loan->id)->lockForUpdate()->first();
                    if ($loan) {
                        $remaining = max(0, (float) $loan->remaining_amount - $amount);
                        $loan->update([
                            'remaining_amount' => $remaining,
                            'status' => $remaining <= 0 ? PartnerCapitalLoan::STATUS_PAID : PartnerCapitalLoan::STATUS_ACTIVE,
                        ]);
                    }
                }
            }

            $lockedBatch->update([
                'status' => OwnerFinanceBatch::STATUS_POSTED,
                'posted_by' => $actor->id,
                'posted_at' => now(),
            ]);

            return $lockedBatch->fresh(['outlet', 'items.recipientUser', 'items.sourceUser', 'items.loan']);
        });
    }

    public function upsertProfile(User $actor, array $data, ?PartnerProfile $profile = null): PartnerProfile
    {
        abort_if(! $actor->isOwner(), 403, 'Hanya owner yang dapat mengatur profil partner.');

        $user = User::whereIn('role', ['OWNER', 'PARTNER'])->findOrFail($data['user_id']);
        $payload = [
            'default_salary' => max(0, (float) ($data['default_salary'] ?? 0)),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'note' => $data['note'] ?? null,
        ];

        if ($profile) {
            abort_if($profile->user_id !== $user->id, 422, 'Profil tidak sesuai dengan user.');
            $profile->update($payload);

            return $profile->fresh('user');
        }

        return PartnerProfile::updateOrCreate(['user_id' => $user->id], $payload)->fresh('user');
    }

    public function createLoan(User $actor, array $data): PartnerCapitalLoan
    {
        abort_if(! $actor->isOwner(), 403, 'Hanya owner yang dapat mencatat pinjaman modal.');

        if ($data['borrower_user_id'] === $data['lender_user_id']) {
            throw ValidationException::withMessages([
                'lender_user_id' => 'Pemberi pinjaman harus berbeda dari partner peminjam.',
            ]);
        }

        User::whereIn('role', ['OWNER', 'PARTNER'])->findOrFail($data['borrower_user_id']);
        User::whereIn('role', ['OWNER', 'PARTNER'])->findOrFail($data['lender_user_id']);

        if (! empty($data['investment_id'])) {
            $investment = Investment::findOrFail($data['investment_id']);
            if ($investment->user_id !== $data['borrower_user_id']) {
                throw ValidationException::withMessages([
                    'investment_id' => 'Investasi harus milik partner peminjam.',
                ]);
            }
        }

        $principal = max(0, (float) $data['principal_amount']);

        return PartnerCapitalLoan::create([
            'borrower_user_id' => $data['borrower_user_id'],
            'lender_user_id' => $data['lender_user_id'],
            'investment_id' => $data['investment_id'] ?? null,
            'principal_amount' => $principal,
            'remaining_amount' => $principal,
            'status' => PartnerCapitalLoan::STATUS_ACTIVE,
            'note' => $data['note'] ?? null,
            'created_by' => $actor->id,
        ])->load(['borrower', 'lender', 'investment.outlet']);
    }

    public function updateLoan(User $actor, PartnerCapitalLoan $loan, array $data): PartnerCapitalLoan
    {
        abort_if(! $actor->isOwner(), 403, 'Hanya owner yang dapat mengubah pinjaman modal.');

        $remaining = array_key_exists('remaining_amount', $data)
            ? max(0, (float) $data['remaining_amount'])
            : (float) $loan->remaining_amount;
        $status = $data['status'] ?? ($remaining <= 0 ? PartnerCapitalLoan::STATUS_PAID : $loan->status);

        $loan->update([
            'remaining_amount' => $remaining,
            'status' => $status,
            'note' => $data['note'] ?? $loan->note,
        ]);

        return $loan->fresh(['borrower', 'lender', 'investment.outlet']);
    }

    public function stakeholderRows(?string $outletId = null): array
    {
        $investmentTotals = $outletId ? $this->investmentTotals($outletId) : collect();

        return $this->stakeholderUsers()->map(function (User $user) use ($investmentTotals) {
            $investment = $investmentTotals->get($user->id, ['lots' => 0, 'total_value' => 0]);
            $profile = $user->partnerProfile;

            return [
                'id' => $user->id,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'role' => $user->role,
                'profile_id' => $profile?->id,
                'default_salary' => round((float) ($profile?->default_salary ?? 0)),
                'profile_active' => $profile?->is_active ?? true,
                'profile_note' => $profile?->note,
                'lots' => round((float) ($investment['lots'] ?? 0), 4),
                'capital_value' => round((float) ($investment['total_value'] ?? 0)),
            ];
        })->values()->all();
    }

    public function loanRows(User $viewer, ?string $outletId = null): array
    {
        $query = PartnerCapitalLoan::with(['borrower:id,display_name,role', 'lender:id,display_name,role', 'investment.outlet:id,name'])
            ->orderByDesc('created_at');

        if ($viewer->isPartner()) {
            $query->where(function ($q) use ($viewer) {
                $q->where('borrower_user_id', $viewer->id)
                    ->orWhere('lender_user_id', $viewer->id);
            });
        }

        if ($outletId) {
            $query->where(function ($q) use ($outletId) {
                $q->whereHas('investment', fn ($investment) => $investment->where('outlet_id', $outletId))
                    ->orWhereNull('investment_id');
            });
        }

        return $query->get()->map(fn (PartnerCapitalLoan $loan) => $this->formatLoan($loan))->values()->all();
    }

    public function batchRows(User $viewer, ?string $outletId = null, int $limit = 20): array
    {
        $query = OwnerFinanceBatch::with(['outlet:id,name', 'items.recipientUser:id,display_name,role', 'items.sourceUser:id,display_name,role'])
            ->orderByDesc('created_at')
            ->take($limit);

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        if ($viewer->isPartner()) {
            $query->whereHas('items', function ($q) use ($viewer) {
                $q->where('recipient_user_id', $viewer->id)
                    ->orWhere('source_user_id', $viewer->id);
            });
        }

        return $query->get()->map(fn (OwnerFinanceBatch $batch) => $this->formatBatch($batch, $viewer))->values()->all();
    }

    public function investmentsForUser(User $viewer, ?string $outletId = null): array
    {
        $query = Investment::with(['outlet:id,name', 'user:id,display_name,role'])
            ->orderByDesc('created_at');

        if ($viewer->isPartner()) {
            $query->where('user_id', $viewer->id);
        }

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        return $query->get()->map(fn (Investment $investment) => [
            'id' => $investment->id,
            'outlet_id' => $investment->outlet_id,
            'outlet' => $investment->outlet ? [
                'id' => $investment->outlet->id,
                'name' => $investment->outlet->name,
            ] : null,
            'user_id' => $investment->user_id,
            'user' => $investment->user ? [
                'id' => $investment->user->id,
                'display_name' => $investment->user->display_name,
                'role' => $investment->user->role,
            ] : null,
            'lots' => (int) $investment->lots,
            'lot_value' => (float) $investment->lot_value,
            'total_value' => (float) $investment->total_value,
            'status' => $investment->status,
            'note' => $investment->note,
            'approved_at' => $investment->approved_at?->toIso8601String(),
            'created_at' => $investment->created_at?->toIso8601String(),
        ])->values()->all();
    }

    private function financeBasis(string $outletId, Carbon $start, Carbon $end): array
    {
        $transactions = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('paid_at', [$start, $end])
                    ->orWhere(function ($legacyQuery) use ($start, $end) {
                        $legacyQuery->whereNull('paid_at')
                            ->whereBetween('created_at', [$start, $end]);
                    });
            })
            ->with('items.product')
            ->get();

        $movements = PettyCash::where('outlet_id', $outletId)
            ->whereBetween('created_at', [$start, $end])
            ->get();

        $summary = [
            'revenue' => 0.0,
            'cash_sales' => 0.0,
            'qris_sales' => 0.0,
            'hpp' => 0.0,
            'gross_profit' => 0.0,
            'operating_expenses' => 0.0,
            'private_operating_expenses' => 0.0,
            'restock_expenses' => 0.0,
            'staff_payroll' => $this->staffPayrollTotal($outletId, $start, $end),
            'cash_balance' => 0.0,
            'qris_balance' => 0.0,
            'owner_withdrawals' => 0.0,
            'owner_finance_payouts' => 0.0,
            'movement_count' => $movements->count(),
            'transaction_count' => $transactions->count(),
        ];

        foreach ($transactions as $transaction) {
            $amount = (float) $transaction->total_amount;
            $summary['revenue'] += $amount;

            if ($this->normalizeTransactionPaymentMethod($transaction->payment_method) === 'QRIS') {
                $summary['qris_sales'] += $amount;
                $summary['qris_balance'] += $amount;
            } else {
                $summary['cash_sales'] += $amount;
                $summary['cash_balance'] += $amount;
            }

            foreach ($transaction->items as $item) {
                $summary['hpp'] += $this->productCostService->itemHppTotal($item);
            }
        }

        foreach ($movements as $movement) {
            $amount = (float) $movement->amount;
            $method = $this->normalizeMovementPaymentMethod($movement);
            $flow = $movement->cash_flow === 'IN' || in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true)
                ? 'IN'
                : 'OUT';

            if ($method === 'CASH') {
                $summary['cash_balance'] += $flow === 'IN' ? $amount : -$amount;
            } elseif ($method === 'QRIS') {
                $summary['qris_balance'] += $flow === 'IN' ? $amount : -$amount;
            }

            if ($movement->category === 'Penarikan') {
                $summary['owner_withdrawals'] += $amount;
                continue;
            }

            if ($movement->category === PettyCashService::OWNER_DISTRIBUTION_CATEGORY) {
                $summary['owner_finance_payouts'] += $amount;
                continue;
            }

            if (in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true) || $flow !== 'OUT') {
                continue;
            }

            if ($movement->category === 'RESTOCK') {
                $summary['restock_expenses'] += $amount;
                continue;
            }

            $summary['operating_expenses'] += $amount;
            if ($method === 'PRIVATE') {
                $summary['private_operating_expenses'] += $amount;
            }
        }

        $summary['gross_profit'] = $summary['revenue'] - $summary['hpp'];
        $summary['profit_before_owner'] = $summary['gross_profit']
            - $summary['operating_expenses']
            - $summary['staff_payroll'];
        $summary['cash_balance'] = round($summary['cash_balance']);
        $summary['qris_balance'] = round($summary['qris_balance']);
        $summary['payout_available_total'] = max(0, $summary['cash_balance']) + max(0, $summary['qris_balance']);

        return collect($summary)
            ->map(fn ($value) => is_float($value) ? round($value) : $value)
            ->all();
    }

    private function salaryRows(Collection $stakeholders, array $salaryOverrides): Collection
    {
        return $stakeholders->map(function (User $user) use ($salaryOverrides) {
            $profile = $user->partnerProfile;
            $profileActive = $profile?->is_active ?? true;
            $defaultSalary = $profileActive ? (float) ($profile?->default_salary ?? 0) : 0.0;
            $requested = $profileActive && array_key_exists($user->id, $salaryOverrides)
                ? max(0, (float) $salaryOverrides[$user->id])
                : $defaultSalary;

            return [
                'user' => $this->formatUser($user),
                'profile_id' => $profile?->id,
                'profile_active' => $profileActive,
                'default_salary' => round($defaultSalary),
                'requested_salary' => round($requested),
                'final_salary' => 0,
                'shortfall' => 0,
            ];
        });
    }

    private function dividendRows(Collection $stakeholders, Collection $investmentTotals, float $dividendPool): Collection
    {
        $totalLots = (float) $investmentTotals->sum('lots');
        $allocated = 0.0;
        $rows = [];
        $eligible = $stakeholders
            ->filter(fn (User $user) => (float) ($investmentTotals->get($user->id)['lots'] ?? 0) > 0)
            ->values();

        foreach ($eligible as $index => $user) {
            $investment = $investmentTotals->get($user->id);
            $lots = (float) ($investment['lots'] ?? 0);
            $amount = 0.0;
            if ($totalLots > 0 && $dividendPool > 0) {
                $amount = $index === $eligible->count() - 1
                    ? max(0, $dividendPool - $allocated)
                    : round($dividendPool * ($lots / $totalLots));
                $allocated += $amount;
            }

            $rows[] = [
                'user' => $this->formatUser($user),
                'lots' => $lots,
                'capital_value' => round((float) ($investment['total_value'] ?? 0)),
                'share_percent' => $totalLots > 0 ? round(($lots / $totalLots) * 100, 2) : 0,
                'dividend' => round($amount),
                'loan_repayment' => 0,
                'direct_payout' => round($amount),
            ];
        }

        return collect($rows);
    }

    private function activeLoans(string $outletId, array $borrowerIds): EloquentCollection
    {
        if (empty($borrowerIds)) {
            return new EloquentCollection();
        }

        return PartnerCapitalLoan::with(['borrower:id,display_name,role', 'lender:id,display_name,role', 'investment.outlet:id,name'])
            ->where('status', PartnerCapitalLoan::STATUS_ACTIVE)
            ->where('remaining_amount', '>', 0)
            ->whereIn('borrower_user_id', $borrowerIds)
            ->where(function ($query) use ($outletId) {
                $query->whereHas('investment', fn ($investment) => $investment->where('outlet_id', $outletId))
                    ->orWhereNull('investment_id');
            })
            ->orderBy('created_at')
            ->get();
    }

    private function loanRowsForPreview(EloquentCollection $loans, Collection $dividendRows, array $loanAllocations): array
    {
        $dividendByBorrower = $dividendRows->mapWithKeys(fn (array $row) => [
            $row['user']['id'] => (float) $row['dividend'],
        ]);
        $allocatedByBorrower = [];

        $rows = $loans->map(function (PartnerCapitalLoan $loan) use ($loanAllocations, $dividendByBorrower, &$allocatedByBorrower) {
            $borrowerId = $loan->borrower_user_id;
            $availableDividend = max(0, (float) ($dividendByBorrower[$borrowerId] ?? 0) - (float) ($allocatedByBorrower[$borrowerId] ?? 0));
            $requested = max(0, (float) ($loanAllocations[$loan->id] ?? 0));
            $allocation = min((float) $loan->remaining_amount, $availableDividend, $requested);
            $allocatedByBorrower[$borrowerId] = (float) ($allocatedByBorrower[$borrowerId] ?? 0) + $allocation;

            return [
                ...$this->formatLoan($loan),
                'available_from_dividend' => round($availableDividend),
                'allocation' => round($allocation),
                'suggested_allocation' => round(min((float) $loan->remaining_amount, $availableDividend)),
            ];
        });

        return [$rows, $allocatedByBorrower];
    }

    private function previewItems(Collection $salaryRows, Collection $dividendRows, Collection $loanRows, float $retainedAmount, string $payoutMethod): array
    {
        $items = [];

        foreach ($salaryRows as $row) {
            if ((float) $row['final_salary'] <= 0) {
                continue;
            }

            $items[] = [
                'type' => OwnerFinanceItem::TYPE_SALARY,
                'source_user_id' => null,
                'recipient_user_id' => $row['user']['id'],
                'payment_method' => $payoutMethod,
                'amount' => round((float) $row['final_salary']),
                'note' => 'Gaji',
                'meta' => ['requested_salary' => $row['requested_salary']],
            ];
        }

        foreach ($loanRows as $row) {
            if ((float) $row['allocation'] <= 0) {
                continue;
            }

            $items[] = [
                'type' => OwnerFinanceItem::TYPE_LOAN_REPAYMENT,
                'source_user_id' => $row['borrower']['id'],
                'recipient_user_id' => $row['lender']['id'],
                'partner_capital_loan_id' => $row['id'],
                'payment_method' => $payoutMethod,
                'amount' => round((float) $row['allocation']),
                'note' => 'Bayar pinjaman dari dividen',
                'meta' => ['borrower_dividend_source' => true],
            ];
        }

        foreach ($dividendRows as $row) {
            if ((float) $row['direct_payout'] <= 0) {
                continue;
            }

            $items[] = [
                'type' => OwnerFinanceItem::TYPE_DIVIDEND,
                'source_user_id' => $row['user']['id'],
                'recipient_user_id' => $row['user']['id'],
                'payment_method' => $payoutMethod,
                'amount' => round((float) $row['direct_payout']),
                'note' => 'Dividen',
                'meta' => ['share_percent' => $row['share_percent'], 'lots' => $row['lots']],
            ];
        }

        if ($retainedAmount > 0) {
            $items[] = [
                'type' => OwnerFinanceItem::TYPE_RETAINED,
                'payment_method' => 'OFFSET',
                'amount' => round($retainedAmount),
                'note' => 'Disimpan di kas usaha',
            ];
        }

        return $items;
    }

    private function lockOutletForOwnerFinance(string $outletId): void
    {
        Outlet::query()
            ->whereKey($outletId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function assertPeriodHasNoPostedBatch(string $outletId, Carbon $start, Carbon $end, ?string $exceptBatchId = null): void
    {
        if (! $this->postedBatchForPeriodExists($outletId, $start, $end, $exceptBatchId)) {
            return;
        }

        $message = 'Periode ini sudah pernah diposting untuk outlet ini. Ubah outlet atau tanggal sebelum membuat pembagian baru.';

        throw ValidationException::withMessages([
            'error' => $message,
            'period_start' => $message,
        ]);
    }

    private function postedBatchForPeriodExists(string $outletId, Carbon $start, Carbon $end, ?string $exceptBatchId = null): bool
    {
        $query = OwnerFinanceBatch::query()
            ->where('outlet_id', $outletId)
            ->where('status', OwnerFinanceBatch::STATUS_POSTED)
            ->whereDate('period_start', $start->toDateString())
            ->whereDate('period_end', $end->toDateString());

        if ($exceptBatchId) {
            $query->whereKeyNot($exceptBatchId);
        }

        return $query->exists();
    }

    private function investmentTotals(string $outletId): Collection
    {
        return Investment::where('outlet_id', $outletId)
            ->where('status', 'APPROVED')
            ->get()
            ->groupBy('user_id')
            ->map(fn (Collection $rows) => [
                'lots' => (float) $rows->sum('lots'),
                'total_value' => (float) $rows->sum('total_value'),
                'investment_ids' => $rows->pluck('id')->values()->all(),
            ]);
    }

    private function stakeholderUsers(): Collection
    {
        return User::with('partnerProfile')
            ->whereIn('role', ['OWNER', 'PARTNER'])
            ->where('is_active', true)
            ->orderBy('display_name')
            ->get();
    }

    private function staffPayrollTotal(string $outletId, Carbon $start, Carbon $end): float
    {
        $employeeIds = ShiftRecord::where('outlet_id', $outletId)
            ->whereNotNull('opened_by')
            ->where('opened_at', '<=', $end)
            ->where(function ($query) use ($start) {
                $query->whereNull('closed_at')
                    ->orWhere('closed_at', '>=', $start);
            })
            ->pluck('opened_by')
            ->filter()
            ->unique()
            ->values();

        if ($employeeIds->isEmpty()) {
            return 0.0;
        }

        $payments = EmployeeSalaryPayment::whereIn('employee_id', $employeeIds)
            ->where('period_start', '<=', $end)
            ->where('period_end', '>=', $start)
            ->get();

        return $this->allocatedSalaryTotal($payments, $start, $end);
    }

    private function allocatedSalaryTotal(Collection $payments, Carbon $startDate, Carbon $endDate): float
    {
        $total = 0.0;
        $rangeStart = $startDate->copy()->startOfDay();
        $rangeEnd = $endDate->copy()->endOfDay();

        foreach ($payments as $payment) {
            $periodStart = $payment->period_start?->copy()->startOfDay();
            $periodEnd = $payment->period_end?->copy()->endOfDay();
            if (! $periodStart || ! $periodEnd) {
                continue;
            }

            $overlapStart = $periodStart->greaterThan($rangeStart) ? $periodStart->copy() : $rangeStart->copy();
            $overlapEnd = $periodEnd->lessThan($rangeEnd) ? $periodEnd->copy() : $rangeEnd->copy();
            if ($overlapEnd->lt($overlapStart)) {
                continue;
            }

            $paymentTotal = (float) $payment->total_amount;
            $overlapDays = $this->inclusiveDayCount($overlapStart, $overlapEnd);

            if (strtoupper((string) $payment->salary_type) === 'DAILY') {
                $snapshotWorkDates = collect($payment->shift_snapshot ?? [])
                    ->pluck('work_date')
                    ->filter()
                    ->unique()
                    ->values();

                if ($snapshotWorkDates->isNotEmpty()) {
                    $overlapStartDate = $overlapStart->toDateString();
                    $overlapEndDate = $overlapEnd->toDateString();
                    $overlapWorkDates = $snapshotWorkDates
                        ->filter(fn (string $date) => $date >= $overlapStartDate && $date <= $overlapEndDate)
                        ->count();

                    $total += $paymentTotal * ($overlapWorkDates / max(1, $snapshotWorkDates->count()));
                    continue;
                }

                $payableDays = max(0, (int) $payment->payable_days);
                if ($payableDays > 0) {
                    $total += ($paymentTotal / $payableDays) * min($payableDays, $overlapDays);
                    continue;
                }
            }

            $periodDays = $this->inclusiveDayCount($periodStart, $periodEnd);
            $total += $paymentTotal * ($overlapDays / max(1, $periodDays));
        }

        return $total;
    }

    private function visiblePreviewForPartner(array $preview, User $partner): array
    {
        $isRelatedItem = fn (array $item) => ($item['recipient_user_id'] ?? null) === $partner->id
            || ($item['source_user_id'] ?? null) === $partner->id;
        $isRelatedUserRow = fn (array $row) => ($row['user']['id'] ?? null) === $partner->id;
        $isRelatedLoanRow = fn (array $row) => ($row['borrower']['id'] ?? null) === $partner->id
            || ($row['lender']['id'] ?? null) === $partner->id;

        $salaryRows = collect($preview['salary_rows'])->filter($isRelatedUserRow)->values();
        $dividendRows = collect($preview['dividend_rows'])->filter($isRelatedUserRow)->values();
        $loanRows = collect($preview['loan_rows'])->filter($isRelatedLoanRow)->values();
        $items = collect($preview['items'])->filter($isRelatedItem)->values();

        $preview['salary_rows'] = $salaryRows->all();
        $preview['dividend_rows'] = $dividendRows->all();
        $preview['loan_rows'] = $loanRows->all();
        $preview['items'] = $items->all();
        $preview['basis'] = [
            'period_start' => $preview['period_start'],
            'period_end' => $preview['period_end'],
            'personal_only' => true,
        ];
        $preview['totals'] = [
            'salary_requested' => $salaryRows->sum('requested_salary'),
            'salary_paid' => $salaryRows->sum('final_salary'),
            'salary_shortfall' => $salaryRows->sum('shortfall'),
            'dividend_pool' => $dividendRows->sum('dividend'),
            'direct_dividend' => $dividendRows->sum('direct_payout'),
            'loan_repayment' => $loanRows->sum('allocation'),
            'total_payout' => $items->filter(fn (array $item) => in_array($item['payment_method'], ['CASH', 'QRIS'], true))->sum('amount'),
            'retained_amount' => 0,
            'payout_method_balance' => 0,
            'total_lots' => $dividendRows->sum('lots'),
        ];

        return $preview;
    }

    private function formatBatch(OwnerFinanceBatch $batch, User $viewer): array
    {
        $items = $batch->items;
        if ($viewer->isPartner()) {
            $items = $items->filter(fn (OwnerFinanceItem $item) => $item->recipient_user_id === $viewer->id || $item->source_user_id === $viewer->id);
        }

        return [
            'id' => $batch->id,
            'outlet' => $batch->outlet ? ['id' => $batch->outlet->id, 'name' => $batch->outlet->name] : null,
            'period_start' => $batch->period_start?->format('Y-m-d'),
            'period_end' => $batch->period_end?->format('Y-m-d'),
            'status' => $batch->status,
            'payout_method' => $batch->payout_method,
            'total_salary' => (float) $batch->total_salary,
            'total_dividend' => (float) $batch->total_dividend,
            'total_loan_repayment' => (float) $batch->total_loan_repayment,
            'total_payout' => (float) $batch->total_payout,
            'retained_amount' => (float) $batch->retained_amount,
            'posted_at' => $batch->posted_at?->toIso8601String(),
            'created_at' => $batch->created_at?->toIso8601String(),
            'note' => $batch->note,
            'items' => $items->map(fn (OwnerFinanceItem $item) => [
                'id' => $item->id,
                'type' => $item->type,
                'payment_method' => $item->payment_method,
                'amount' => (float) $item->amount,
                'note' => $item->note,
                'recipient' => $item->recipientUser ? $this->formatUser($item->recipientUser) : null,
                'source' => $item->sourceUser ? $this->formatUser($item->sourceUser) : null,
            ])->values()->all(),
        ];
    }

    private function formatLoan(PartnerCapitalLoan $loan): array
    {
        return [
            'id' => $loan->id,
            'borrower' => $loan->borrower ? $this->formatUser($loan->borrower) : null,
            'lender' => $loan->lender ? $this->formatUser($loan->lender) : null,
            'investment_id' => $loan->investment_id,
            'investment' => $loan->investment ? [
                'id' => $loan->investment->id,
                'outlet' => $loan->investment->outlet ? [
                    'id' => $loan->investment->outlet->id,
                    'name' => $loan->investment->outlet->name,
                ] : null,
                'lots' => (int) $loan->investment->lots,
                'total_value' => (float) $loan->investment->total_value,
            ] : null,
            'principal_amount' => (float) $loan->principal_amount,
            'remaining_amount' => (float) $loan->remaining_amount,
            'status' => $loan->status,
            'note' => $loan->note,
            'created_at' => $loan->created_at?->toIso8601String(),
        ];
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'display_name' => $user->display_name,
            'email' => $user->email ?? null,
            'role' => $user->role,
        ];
    }

    private function payoutDescription(OwnerFinanceBatch $batch, OwnerFinanceItem $item): string
    {
        $recipient = $item->recipientUser?->display_name ?: 'Partner';
        $period = $batch->period_start?->format('d/m/Y').' - '.$batch->period_end?->format('d/m/Y');
        $type = match ($item->type) {
            OwnerFinanceItem::TYPE_SALARY => 'Gaji',
            OwnerFinanceItem::TYPE_LOAN_REPAYMENT => 'Bayar pinjaman modal',
            OwnerFinanceItem::TYPE_DIVIDEND => 'Dividen',
            default => 'Bagi hasil',
        };

        return "{$type}: {$recipient} ({$period})";
    }

    private function numericMap(mixed $values): array
    {
        if (! is_array($values)) {
            return [];
        }

        return collect($values)
            ->map(fn ($value) => max(0, (float) $value))
            ->all();
    }

    private function normalizePayoutMethod(?string $method): string
    {
        return strtoupper((string) $method) === 'QRIS' ? 'QRIS' : 'CASH';
    }

    private function normalizeMovementPaymentMethod(PettyCash $movement): string
    {
        return match (strtoupper((string) $movement->payment_method)) {
            'QRIS' => 'QRIS',
            'PRIVATE' => 'PRIVATE',
            default => 'CASH',
        };
    }

    private function normalizeTransactionPaymentMethod(?string $paymentMethod): string
    {
        return strtoupper((string) $paymentMethod) === 'QRIS' ? 'QRIS' : 'CASH';
    }

    private function inclusiveDayCount(Carbon $startDate, Carbon $endDate): int
    {
        return max(1, (int) floor($startDate->copy()->startOfDay()->diffInDays($endDate->copy()->startOfDay())) + 1);
    }
}
