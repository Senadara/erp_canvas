<?php

namespace App\Http\Controllers;

use App\Services\StockAuditService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StockAuditController extends Controller
{
    public function __construct(private StockAuditService $stockAuditService) {}

    public function index(Request $request)
    {
        abort_if($request->user()?->isMitra(), 403, 'Audit stok membaca data penjualan outlet dan tidak tersedia untuk mitra.');

        $outletId = (string) $request->session()->get('outlet_id');
        $validated = $request->validate([
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d'],
            'stock_item_id' => ['nullable', 'string', 'max:36'],
        ]);

        $startDate = isset($validated['start_date'])
            ? Carbon::createFromFormat('Y-m-d', $validated['start_date'])->startOfDay()
            : Carbon::now()->startOfMonth();
        $endDate = isset($validated['end_date'])
            ? Carbon::createFromFormat('Y-m-d', $validated['end_date'])->endOfDay()
            : Carbon::now()->endOfDay();

        if ($endDate->lt($startDate)) {
            $endDate = $startDate->copy()->endOfDay();
        }

        return Inertia::render('StockAudit/Index', [
            'filters' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'stock_item_id' => $validated['stock_item_id'] ?? null,
            ],
            'report' => $this->stockAuditService->getReport(
                $outletId,
                $startDate,
                $endDate,
                $validated['stock_item_id'] ?? null
            ),
        ]);
    }

    public function storeCount(Request $request)
    {
        abort_if($request->user()?->isMitra(), 403, 'Mitra tidak dapat mencatat cek fisik stok.');

        $outletId = (string) $request->session()->get('outlet_id');
        $data = $request->validate([
            'stock_item_id' => ['required', 'string', 'max:36'],
            'counted_stock' => ['required', 'numeric', 'min:0'],
            'counted_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $this->stockAuditService->recordPhysicalCount(
            $outletId,
            $data['stock_item_id'],
            (float) $data['counted_stock'],
            isset($data['counted_at']) ? Carbon::parse($data['counted_at']) : now(),
            $data['note'] ?? null,
            $request->user()?->id
        );

        return back()->with('success', 'Cek fisik stok berhasil dicatat.');
    }
}
