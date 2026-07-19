<?php

namespace App\Http\Controllers;

use App\Models\MitraSettlement;
use App\Models\User;
use App\Services\MitraReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        if ($outletId && $selectedMitraId) {
            $mitra = User::find($selectedMitraId);
            if ($mitra) {
                $reportData = $this->mitraReportService->getMitraReportDataAcrossOutlets($mitra, $startDate, $endDate);
                $warehouseReportData = $this->mitraReportService->getMitraWarehouseRestockData($mitra, $startDate, $endDate);
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
            'isOwner' => true,
        ]);
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
            'calculation_method' => 'required|in:SALES,RESTOCK',
        ]);

        $mitra = User::find($data['mitra_id']);
        if (! $mitra || ! $mitra->isMitra() || ! $mitra->mitraStockItems()->exists()) {
            return redirect()->back()->withErrors(['mitra_id' => 'Pengguna tidak valid.']);
        }

        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->endOfDay();
        $reportData = $data['calculation_method'] === 'RESTOCK'
            ? $this->mitraReportService->getMitraWarehouseRestockData($mitra, $startDate, $endDate)
            : $this->mitraReportService->getMitraReportDataAcrossOutlets($mitra, $startDate, $endDate);
        $receiptData = [];
        $totalAmount = 0.0;

        foreach ($reportData as $item) {
            $rawQty = $data['calculation_method'] === 'SALES'
                ? (float) $item['sales_qty']
                : (float) $item['restock_qty'];
            $remainingQty = max(0, $rawQty - (float) ($item['committed_qty'] ?? $item['settled_qty'] ?? 0));
            $minQty = (float) $item['min_restock_qty'] > 0 ? (float) $item['min_restock_qty'] : 1;
            $subtotal = ($remainingQty / $minQty) * (float) $item['restock_price'];

            $receiptData[] = [
                ...$item,
                'calculated_qty' => round($remainingQty, 4),
                'subtotal' => round($subtotal),
            ];
            $totalAmount += $subtotal;
        }

        if ($totalAmount <= 0 || empty($receiptData)) {
            return back()->withErrors(['settlement' => 'Tidak ada sisa setoran yang dapat diajukan pada periode ini.']);
        }

        DB::transaction(function () use ($outletId, $data, $startDate, $endDate, $receiptData, $totalAmount) {
            MitraSettlement::create([
                'outlet_id' => $outletId,
                'mitra_id' => $data['mitra_id'],
                'period_start' => $startDate,
                'period_end' => $endDate,
                'calculation_method' => $data['calculation_method'],
                'total_amount' => round($totalAmount),
                'status' => MitraSettlement::STATUS_PENDING,
                'receipt_data' => $receiptData,
            ]);
        });

        return redirect()->back()->with('success', 'Pengajuan setoran dikirim dan menunggu validasi mitra.');
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

        return $pdf->download($filename);
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

        return $pdf->download("rekap-setoran-{$startDate->format('Ymd')}-{$endDate->format('Ymd')}.pdf");
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
