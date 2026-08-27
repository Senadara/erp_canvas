<?php

namespace App\Http\Controllers;

use App\Models\MitraSettlement;
use App\Models\MitraStockUsageAdjustment;
use App\Models\StockItem;
use App\Models\User;
use App\Services\MitraReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;

class MitraSettlementController extends Controller
{
    public function __construct(private MitraReportService $mitraReportService) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $isMitra = $user && $user->isMitra();
        $isOwner = $user && $user->isOwner();

        // Mitra dan Owner boleh akses halaman ini
        if (!$user || (!$isOwner && !$isMitra && !($user->feature_overrides['settlements'] ?? false))) {
            abort(403, 'Anda tidak memiliki akses ke halaman ini.');
        }

        $outletId = $request->session()->get('outlet_id');

        // Untuk Mitra: hanya melihat riwayat setoran miliknya sendiri
        if ($isMitra) {
            $settlements = MitraSettlement::with([
                'mitra:id,display_name',
                'validator:id,display_name',
                'payer:id,display_name',
            ])
                ->where('mitra_id', $user->id)
                ->orderByDesc('created_at')
                ->get();

            return Inertia::render('Settlements/Index', [
                'mitras' => [],
                'selectedMitraId' => null,
                'startDate' => Carbon::now()->startOfMonth()->format('Y-m-d'),
                'endDate' => Carbon::now()->endOfMonth()->format('Y-m-d'),
                'reportData' => [],
                'warehouseReportData' => [],
                'settlements' => $settlements,
                'usageAdjustments' => [],
                'isOwner' => false,
            ]);
        }
        
        // Owner flow: full access
        $mitras = User::where('role', 'MITRA')
            ->where('is_active', true)
            ->whereHas('mitraStockItems')
            ->orderBy('display_name')
            ->get(['id', 'display_name']);

        $selectedMitraId = $request->query('mitra_id');
        $startDate = $request->query('start_date') ? Carbon::parse($request->query('start_date')) : Carbon::now()->startOfMonth();
        $endDate = $request->query('end_date') ? Carbon::parse($request->query('end_date')) : Carbon::now()->endOfMonth();

        $reportData = [];
        $warehouseReportData = [];
        $usageAdjustments = [];
        if ($outletId && $selectedMitraId) {
            $mitra = User::find($selectedMitraId);
            if ($mitra) {
                $reportData = $this->mitraReportService->getMitraReportDataAcrossOutlets($mitra, $startDate, $endDate);
                $warehouseReportData = $this->mitraReportService->getMitraWarehouseRestockData($mitra, $startDate, $endDate);
                if (Schema::hasTable('mitra_stock_usage_adjustments')) {
                    $usageAdjustments = MitraStockUsageAdjustment::with([
                        'outlet:id,name',
                        'stockItem:id,name,unit_name',
                        'creator:id,display_name',
                    ])
                        ->where('mitra_id', $mitra->id)
                        ->whereBetween('reported_at', [$startDate->copy()->startOfDay(), $endDate->copy()->endOfDay()])
                        ->orderByDesc('reported_at')
                        ->take(150)
                        ->get()
                        ->map(fn (MitraStockUsageAdjustment $adjustment) => [
                            'id' => $adjustment->id,
                            'usage_type' => $adjustment->usage_type,
                            'quantity' => (float) $adjustment->quantity,
                            'note' => $adjustment->note,
                            'reported_at' => $adjustment->reported_at?->toDateString(),
                            'created_at' => $adjustment->created_at?->toIso8601String(),
                            'outlet_name' => $adjustment->outlet?->name,
                            'stock_item_id' => $adjustment->stock_item_id,
                            'stock_name' => $adjustment->stockItem?->name,
                            'unit_name' => $adjustment->stockItem?->unit_name,
                            'created_by_name' => $adjustment->creator?->display_name,
                        ])
                        ->values();
                }
            }
        }

        $settlements = MitraSettlement::with([
            'mitra:id,display_name',
            'validator:id,display_name',
            'payer:id,display_name',
        ])
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('Settlements/Index', [
            'mitras' => $mitras,
            'selectedMitraId' => $selectedMitraId,
            'startDate' => $startDate->format('Y-m-d'),
            'endDate' => $endDate->format('Y-m-d'),
            'reportData' => $reportData,
            'warehouseReportData' => $warehouseReportData,
            'settlements' => $settlements,
            'usageAdjustments' => $usageAdjustments,
            'isOwner' => true,
        ]);
    }

    public function storeUsageAdjustment(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isOwner() && !($user->feature_overrides['settlements'] ?? false))) {
            abort(403, 'Anda tidak memiliki akses ke halaman ini.');
        }

        if (! Schema::hasTable('mitra_stock_usage_adjustments')) {
            return back()->withErrors(['usage_adjustment' => 'Tabel catatan pemakaian belum tersedia. Jalankan migrasi database terlebih dahulu.']);
        }

        $data = $request->validate([
            'mitra_id' => ['required', 'exists:users,id'],
            'stock_item_id' => ['required', 'string', 'max:36'],
            'usage_type' => ['required', 'in:MANUAL_USAGE,STOCK_OPNAME'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'reported_at' => ['required', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        if ($data['usage_type'] === MitraStockUsageAdjustment::TYPE_MANUAL_USAGE && (float) $data['quantity'] <= 0) {
            return back()->withErrors(['usage_adjustment' => 'Jumlah pemakaian manual wajib lebih dari 0.']);
        }

        $mitra = User::find($data['mitra_id']);
        if (! $mitra || ! $mitra->isMitra()) {
            return back()->withErrors(['usage_adjustment' => 'Mitra tidak valid.']);
        }

        $stockItem = StockItem::find($data['stock_item_id']);
        if (! $stockItem || ! $mitra->mitraStockItems()->where('stock_items.id', $stockItem->id)->exists()) {
            return back()->withErrors(['usage_adjustment' => 'Bahan tidak terhubung ke mitra yang dipilih.']);
        }

        MitraStockUsageAdjustment::create([
            'outlet_id' => $stockItem->outlet_id,
            'mitra_id' => $mitra->id,
            'stock_item_id' => $stockItem->id,
            'warehouse_stock_item_id' => $stockItem->warehouse_stock_item_id,
            'usage_type' => $data['usage_type'],
            'quantity' => (float) $data['quantity'],
            'note' => $data['note'] ?? null,
            'reported_at' => Carbon::createFromFormat('Y-m-d', $data['reported_at'])->startOfDay(),
            'created_by' => $user->id,
        ]);

        return back()->with('success', $data['usage_type'] === MitraStockUsageAdjustment::TYPE_STOCK_OPNAME
            ? 'Stok akhir/opname bahan berhasil dicatat.'
            : 'Pemakaian manual bahan berhasil dicatat.');
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isOwner() && !($user->feature_overrides['settlements'] ?? false))) {
            abort(403, 'Anda tidak memiliki akses ke halaman ini.');
        }

        $outletId = $request->session()->get('outlet_id');
        
        $data = $request->validate([
            'mitra_id' => 'required|exists:users,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'calculation_method' => 'required|in:SALES,RESTOCK,CUSTOM',
            'custom_amount' => 'nullable|numeric|min:1',
            'custom_description' => 'nullable|string|max:255',
            'custom_kind' => 'nullable|in:ADJUSTMENT_ONLY,STOCK_CREDIT',
            'custom_stock_key' => 'nullable|string|max:120',
            'custom_quantity' => 'nullable|numeric|min:0.0001',
            'custom_items' => 'nullable|array|max:50',
            'custom_items.*.stock_key' => 'required_with:custom_items|string|max:120',
            'custom_items.*.quantity' => 'required_with:custom_items|numeric|min:0.0001',
        ]);

        $mitra = User::find($data['mitra_id']);
        if (! $mitra || ! $mitra->isMitra() || ! $mitra->mitraStockItems()->exists()) {
            return redirect()->back()->withErrors(['mitra_id' => 'Pengguna tidak valid.']);
        }

        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->endOfDay();
        if ($data['calculation_method'] === 'CUSTOM') {
            [$receiptData, $totalAmount] = $this->buildCustomSettlementReceipt($mitra, $data, $startDate, $endDate);

            if ($totalAmount <= 0 || empty($receiptData)) {
                return back()->withErrors(['settlement' => 'Nominal custom wajib lebih dari 0.']);
            }

            DB::transaction(function () use ($outletId, $data, $startDate, $endDate, $receiptData, $totalAmount) {
                MitraSettlement::create([
                    'outlet_id' => $outletId,
                    'mitra_id' => $data['mitra_id'],
                    'period_start' => $startDate,
                    'period_end' => $endDate,
                    'calculation_method' => 'CUSTOM',
                    'total_amount' => round($totalAmount),
                    'status' => MitraSettlement::STATUS_PENDING,
                    'receipt_data' => $receiptData,
                ]);
            });

            return redirect()->back()->with('success', 'Pengajuan setoran custom dikirim dan menunggu validasi mitra.');
        }

        $reportData = $data['calculation_method'] === 'RESTOCK'
            ? $this->mitraReportService->getMitraWarehouseRestockData($mitra, $startDate, $endDate)
            : $this->mitraReportService->getMitraReportDataAcrossOutlets($mitra, $startDate, $endDate);
        $receiptData = [];
        $totalAmount = 0.0;

        foreach ($reportData as $item) {
            $rawQty = $data['calculation_method'] === 'SALES'
                ? (float) $item['sales_qty']
                : (float) $item['restock_qty'];
            $remainingQty = array_key_exists('remaining_qty', $item)
                ? (float) $item['remaining_qty']
                : max(0, $rawQty - (float) ($item['committed_qty'] ?? $item['settled_qty'] ?? 0));
            $minQty = (float) $item['min_restock_qty'] > 0 ? (float) $item['min_restock_qty'] : 1;
            $subtotal = ($remainingQty / $minQty) * (float) $item['restock_price'];

            $receiptData[] = [
                ...$item,
                'settlement_item_key' => $item['settlement_item_key'] ?? $item['item_key'] ?? null,
                'gross_qty' => round($rawQty, 4),
                'same_method_committed_qty' => round((float) ($item['same_method_committed_qty'] ?? 0), 4),
                'cross_committed_qty' => round((float) ($item['cross_committed_qty'] ?? 0), 4),
                'pending_qty' => round((float) ($item['pending_settlement_qty'] ?? 0), 4),
                'tracking_note' => $this->settlementTrackingNote($item, $data['calculation_method']),
                'calculated_qty' => round($remainingQty, 4),
                'subtotal' => round($subtotal),
            ];
            $totalAmount += $subtotal;
        }

        $grossAmount = $totalAmount;
        $advanceApplied = 0.0;
        if ($grossAmount > 0) {
            $advanceApplied = min($grossAmount, $this->availableAdvanceCredit($mitra->id));
            if ($advanceApplied > 0) {
                $receiptData[] = $this->advanceAppliedReceiptItem($advanceApplied);
                $totalAmount -= $advanceApplied;
            }
        }

        if ($grossAmount <= 0 || empty($receiptData)) {
            return back()->withErrors(['settlement' => 'Tidak ada sisa setoran yang dapat diajukan pada periode ini.']);
        }

        DB::transaction(function () use ($outletId, $data, $startDate, $endDate, $receiptData, $totalAmount) {
            MitraSettlement::create([
                'outlet_id' => $outletId,
                'mitra_id' => $data['mitra_id'],
                'period_start' => $startDate,
                'period_end' => $endDate,
                'calculation_method' => $data['calculation_method'],
                'total_amount' => max(0, round($totalAmount)),
                'status' => MitraSettlement::STATUS_PENDING,
                'receipt_data' => $receiptData,
            ]);
        });

        return redirect()->back()->with('success', $advanceApplied > 0
            ? 'Pengajuan setoran dikirim, sudah dikurangi bon/uang muka yang tersedia, dan menunggu validasi mitra.'
            : 'Pengajuan setoran dikirim dan menunggu validasi mitra.');
    }

    public function downloadPdf(Request $request, string $id)
    {
        $user = $request->user();
        $this->authorizeSettlementAccess($user);

        $settlement = $this->settlementQueryForUser($request)
            ->where('id', $id)
            ->firstOrFail();
        $outletNames = collect($settlement->receipt_data ?? [])
            ->pluck('outlet_name')
            ->filter()
            ->unique()
            ->values();

        $pdf = Pdf::loadView('pdf.mitra-settlements', [
            'outlet' => $settlement->outlet,
            'documentOutletName' => $outletNames->count() === 1
                ? $outletNames->first()
                : "Gabungan {$outletNames->count()} Outlet",
            'settlements' => collect([$settlement]),
            'isSingle' => true,
            'reportStart' => $settlement->period_start,
            'reportEnd' => $settlement->period_end,
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait');

        $filename = 'setoran-'.Str::slug($settlement->mitra?->display_name ?: 'mitra').'-'.$settlement->created_at->format('Ymd').'.pdf';

        if ($request->boolean('browser_pdf')) {
            return response()->json([
                'filename' => $filename,
                'mime' => 'application/pdf',
                'base64' => base64_encode($pdf->output()),
            ]);
        }

        return $pdf->stream($filename);
    }

    public function exportPdf(Request $request)
    {
        $user = $request->user();
        $this->authorizeSettlementAccess($user);

        $data = $request->validate([
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'mitra_id' => ['nullable', 'string', 'max:36'],
        ]);
        $startDate = Carbon::createFromFormat('Y-m-d', $data['start_date'])->startOfDay();
        $endDate = Carbon::createFromFormat('Y-m-d', $data['end_date'])->endOfDay();

        $query = $this->settlementQueryForUser($request)
            ->where('period_start', '<=', $endDate)
            ->where('period_end', '>=', $startDate);

        if (! $user->isMitra() && ! empty($data['mitra_id'])) {
            $query->where('mitra_id', $data['mitra_id']);
        }

        $settlements = $query
            ->orderBy('period_start')
            ->orderBy('created_at')
            ->get();
        $outlet = \App\Models\Outlet::findOrFail($request->session()->get('outlet_id'));

        $pdf = Pdf::loadView('pdf.mitra-settlements', [
            'outlet' => $outlet,
            'documentOutletName' => 'Semua Outlet',
            'settlements' => $settlements,
            'isSingle' => false,
            'reportStart' => $startDate,
            'reportEnd' => $endDate,
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait');

        $filename = "rekap-setoran-{$startDate->format('Ymd')}-{$endDate->format('Ymd')}.pdf";

        if ($request->boolean('browser_pdf')) {
            return response()->json([
                'filename' => $filename,
                'mime' => 'application/pdf',
                'base64' => base64_encode($pdf->output()),
            ]);
        }

        return $pdf->stream($filename);
    }

    public function validateByMitra(Request $request, string $id)
    {
        $user = $request->user();
        abort_unless($user?->isMitra(), 403, 'Hanya mitra terkait yang dapat memvalidasi setoran.');

        $data = $request->validate([
            'decision' => ['required', 'in:APPROVE,REJECT'],
            'validation_note' => ['nullable', 'string', 'max:255', 'required_if:decision,REJECT'],
        ]);

        $settlement = MitraSettlement::where('id', $id)
            ->where('mitra_id', $user->id)
            ->firstOrFail();

        if ($settlement->status !== MitraSettlement::STATUS_PENDING) {
            return back()->withErrors(['settlement' => 'Pengajuan ini sudah pernah divalidasi.']);
        }

        $approved = $data['decision'] === 'APPROVE';
        $settlement->update([
            'status' => $approved ? MitraSettlement::STATUS_APPROVED : MitraSettlement::STATUS_REJECTED,
            'validated_at' => now(),
            'validated_by' => $user->id,
            'validation_note' => $data['validation_note'] ?? null,
        ]);

        return back()->with('success', $approved
            ? 'Pengajuan setoran disetujui. Owner dapat melanjutkan pembayaran.'
            : 'Pengajuan setoran ditolak dan dikembalikan kepada owner.');
    }

    public function cancel(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || (!$user->isOwner() && !($user->feature_overrides['settlements'] ?? false))) {
            abort(403, 'Anda tidak memiliki akses ke halaman ini.');
        }

        $data = $request->validate([
            'cancel_note' => ['nullable', 'string', 'max:255'],
        ]);

        $settlementQuery = MitraSettlement::where('id', $id);
        if (! $user->isOwner()) {
            $settlementQuery->where('outlet_id', $request->session()->get('outlet_id'));
        }
        $settlement = $settlementQuery->firstOrFail();

        if (! in_array($settlement->status, [
            MitraSettlement::STATUS_PENDING,
            MitraSettlement::STATUS_APPROVED,
        ], true)) {
            return back()->withErrors(['settlement' => 'Hanya pengajuan yang belum lunas dan belum dibatalkan yang dapat dibatalkan.']);
        }

        $note = trim((string) ($data['cancel_note'] ?? ''));
        $settlement->update([
            'status' => MitraSettlement::STATUS_CANCELED,
            'validation_note' => $note !== ''
                ? "Dibatalkan owner: {$note}"
                : 'Dibatalkan owner karena pengajuan perlu diperbaiki.',
        ]);

        return back()->with('success', 'Pengajuan setoran dibatalkan. Quantity terkait sudah bisa diajukan ulang.');
    }

    public function pay(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || (!$user->isOwner() && !($user->feature_overrides['settlements'] ?? false))) {
            abort(403, 'Anda tidak memiliki akses ke halaman ini.');
        }

        $settlementQuery = MitraSettlement::where('id', $id);
        if (! $user->isOwner()) {
            $settlementQuery->where('outlet_id', $request->session()->get('outlet_id'));
        }
        $settlement = $settlementQuery->firstOrFail();

        if ($settlement->status !== MitraSettlement::STATUS_APPROVED) {
            return back()->withErrors(['settlement' => 'Setoran harus disetujui mitra sebelum ditandai lunas.']);
        }

        $settlement->update([
            'status' => MitraSettlement::STATUS_PAID,
            'paid_at' => now(),
            'paid_by' => $user->id,
        ]);

        return redirect()->back()->with('success', 'Setoran berhasil ditandai Lunas.');
    }

    private function buildCustomSettlementReceipt(User $mitra, array $data, Carbon $startDate, Carbon $endDate): array
    {
        $amount = (float) ($data['custom_amount'] ?? 0);
        $kind = $data['custom_kind'] ?? 'ADJUSTMENT_ONLY';
        $description = trim((string) ($data['custom_description'] ?? 'Setoran custom'));
        if ($description === '') {
            $description = 'Setoran custom';
        }

        if ($kind !== 'STOCK_CREDIT') {
            if ($amount <= 0) {
                return [[], 0.0];
            }

            return [[[
                'settlement_item_key' => null,
                'item_key' => 'custom:advance',
                'name' => 'Bon / uang muka mitra',
                'unit_name' => 'item',
                'custom_kind' => 'ADJUSTMENT_ONLY',
                'advance_credit' => true,
                'credit_amount' => round($amount),
                'custom_description' => $description,
                'gross_qty' => 0,
                'same_method_committed_qty' => 0,
                'cross_committed_qty' => 0,
                'pending_qty' => 0,
                'calculated_qty' => 0,
                'subtotal' => round($amount),
                'tracking_note' => 'Uang muka/bon. Setelah status Lunas, nominal ini otomatis mengurangi setoran bahan berikutnya untuk mitra yang sama.',
            ]], $amount];
        }

        $stockOptions = collect([
            ...$this->mitraReportService->getMitraWarehouseRestockData($mitra, $startDate, $endDate),
            ...$this->mitraReportService->getMitraReportDataAcrossOutlets($mitra, $startDate, $endDate),
        ])->reduce(function ($carry, array $item) {
            $key = $item['settlement_item_key'] ?? $item['item_key'] ?? null;
            if (! $key || $carry->has($key)) {
                return $carry;
            }

            $carry->put($key, $item);

            return $carry;
        }, collect());

        $requestedRows = collect($data['custom_items'] ?? [])
            ->map(fn (array $row) => [
                'stock_key' => trim((string) ($row['stock_key'] ?? '')),
                'quantity' => (float) ($row['quantity'] ?? 0),
            ])
            ->filter(fn (array $row) => $row['stock_key'] !== '' && $row['quantity'] > 0)
            ->groupBy('stock_key')
            ->map(fn ($rows, string $stockKey) => [
                'stock_key' => $stockKey,
                'quantity' => (float) $rows->sum('quantity'),
            ])
            ->values();

        if ($requestedRows->isEmpty()) {
            $stockKey = trim((string) ($data['custom_stock_key'] ?? ''));
            $quantity = (float) ($data['custom_quantity'] ?? 0);
            if ($stockKey !== '' && $quantity > 0) {
                $requestedRows = collect([[
                    'stock_key' => $stockKey,
                    'quantity' => $quantity,
                ]]);
            }
        }

        if ($requestedRows->isEmpty()) {
            return [[], 0.0];
        }

        $receiptItems = [];
        $totalAmount = 0.0;
        foreach ($requestedRows as $row) {
            $stockKey = $row['stock_key'];
            $stockItem = $stockOptions->get($stockKey);
            if (! $stockItem) {
                continue;
            }

            $rawQuantity = (float) ($stockItem['gross_qty'] ?? $stockItem['restock_qty'] ?? $stockItem['sales_qty'] ?? 0);
            $remainingQty = array_key_exists('remaining_qty', $stockItem)
                ? (float) $stockItem['remaining_qty']
                : max(0, $rawQuantity - (float) ($stockItem['committed_qty'] ?? $stockItem['settled_qty'] ?? 0));
            $quantity = min((float) $row['quantity'], max(0, $remainingQty));
            if ($quantity <= 0) {
                continue;
            }

            $minQty = (float) $stockItem['min_restock_qty'] > 0 ? (float) $stockItem['min_restock_qty'] : 1;
            $subtotal = ($quantity / $minQty) * (float) $stockItem['restock_price'];

            $receiptItems[] = [
                ...$stockItem,
                'settlement_item_key' => $stockKey,
                'item_key' => $stockKey,
                'custom_kind' => 'STOCK_CREDIT',
                'custom_description' => $description,
                'gross_qty' => round($rawQuantity, 4),
                'same_method_committed_qty' => round((float) ($stockItem['same_method_committed_qty'] ?? 0), 4),
                'cross_committed_qty' => round((float) ($stockItem['cross_committed_qty'] ?? 0), 4),
                'pending_qty' => round((float) ($stockItem['pending_settlement_qty'] ?? 0), 4),
                'custom_requested_qty' => round((float) $row['quantity'], 4),
                'remaining_qty_before_custom' => round($remainingQty, 4),
                'remaining_qty_after_custom' => round(max(0, $remainingQty - $quantity), 4),
                'calculated_qty' => round($quantity, 4),
                'subtotal' => round($subtotal),
                'tracking_note' => 'Pelunasan custom bahan ini ikut mengunci quantity agar tidak ditagih ulang dari metode RESTOCK atau SALES.',
            ];
            $totalAmount += $subtotal;
        }

        return [$receiptItems, $totalAmount];
    }

    private function availableAdvanceCredit(string $mitraId): float
    {
        $credit = 0.0;
        $applied = 0.0;

        MitraSettlement::where('mitra_id', $mitraId)
            ->whereIn('status', [
                MitraSettlement::STATUS_PENDING,
                MitraSettlement::STATUS_APPROVED,
                MitraSettlement::STATUS_PAID,
            ])
            ->get(['status', 'receipt_data'])
            ->each(function (MitraSettlement $settlement) use (&$credit, &$applied) {
                foreach (($settlement->receipt_data ?? []) as $item) {
                    $kind = $item['custom_kind'] ?? null;
                    if ($settlement->status === MitraSettlement::STATUS_PAID && $kind === 'ADJUSTMENT_ONLY' && ($item['advance_credit'] ?? false)) {
                        $credit += (float) ($item['credit_amount'] ?? $item['subtotal'] ?? 0);
                    }

                    if ($kind === 'ADVANCE_APPLIED') {
                        $applied += abs((float) ($item['subtotal'] ?? 0));
                    }
                }
            });

        return max(0, $credit - $applied);
    }

    private function advanceAppliedReceiptItem(float $amount): array
    {
        return [
            'settlement_item_key' => null,
            'item_key' => 'custom:advance-applied',
            'name' => 'Bon / uang muka terpakai',
            'unit_name' => 'item',
            'custom_kind' => 'ADVANCE_APPLIED',
            'advance_applied' => true,
            'gross_qty' => 0,
            'same_method_committed_qty' => 0,
            'cross_committed_qty' => 0,
            'pending_qty' => 0,
            'calculated_qty' => 0,
            'subtotal' => -round($amount),
            'tracking_note' => 'Pengurang dari bon/uang muka mitra yang sudah lunas.',
        ];
    }

    private function settlementTrackingNote(array $item, string $method): string
    {
        $same = (float) ($item['same_method_committed_qty'] ?? 0);
        $cross = (float) ($item['cross_committed_qty'] ?? 0);
        $pending = (float) ($item['pending_settlement_qty'] ?? 0);

        if ($same <= 0 && $cross <= 0 && $pending <= 0) {
            return trim(($item['usage_source_note'] ?? '').' Belum ada setoran aktif/lunas untuk bahan ini pada periode overlap.');
        }

        $methodLabel = $method === 'RESTOCK' ? 'metode stok diterima' : 'metode bahan terpakai';

        return trim(($item['usage_source_note'] ?? '')." Terkunci {$same} dari {$methodLabel}, {$cross} dari metode lain, dan {$pending} masih diajukan/menunggu pembayaran.");
    }

    private function authorizeSettlementAccess(?User $user): void
    {
        $allowed = $user && (
            $user->isOwner()
            || $user->isMitra()
            || ($user->feature_overrides['settlements'] ?? false)
        );

        abort_unless($allowed, 403, 'Anda tidak memiliki akses ke dokumen setoran.');
    }

    private function settlementQueryForUser(Request $request)
    {
        $user = $request->user();

        $query = MitraSettlement::with([
            'outlet:id,name,address,phone',
            'mitra:id,display_name',
            'validator:id,display_name',
            'payer:id,display_name',
        ]);

        if ($user->isMitra()) {
            $query->where('mitra_id', $user->id);
        } elseif (! $user->isOwner()) {
            $query->where('outlet_id', $request->session()->get('outlet_id'));
        }

        return $query;
    }
}
