<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function __construct(private ReportService $reportService) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $user = $request->user();

        $mitraProductIds = null;
        $mitraStockIds = null;
        if ($user && $user->isMitra()) {
            $mitraProductIds = $user->getMitraProductIds();
            $mitraStockIds = $user->getMitraStockIds();
        }

        $month = $request->query('month', Carbon::now()->month);
        $year = $request->query('year', Carbon::now()->year);
        $monthStart = Carbon::create((int) $year, (int) $month, 1)->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();

        $validated = $request->validate([
            'product_start' => ['nullable', 'date_format:Y-m-d'],
            'product_end' => ['nullable', 'date_format:Y-m-d'],
            'product_id' => ['nullable', 'string', 'max:36'],
        ]);

        $productStart = isset($validated['product_start'])
            ? Carbon::createFromFormat('Y-m-d', $validated['product_start'])->startOfDay()
            : $monthStart->copy();
        $productEnd = isset($validated['product_end'])
            ? Carbon::createFromFormat('Y-m-d', $validated['product_end'])->endOfDay()
            : $monthEnd->copy();

        if ($productEnd->lt($productStart)) {
            $productEnd = $productStart->copy()->endOfDay();
        }

        $monthlyReport = $this->reportService->getMonthlyReport($outletId, (int)$month, (int)$year, $mitraProductIds);
        $dailySummary = $this->reportService->getDailySummary($outletId, Carbon::now(), $mitraProductIds);
        $revenue7Days = $this->reportService->getLast7DaysRevenue($outletId, $mitraProductIds);
        $lowStockCount = $this->reportService->getLowStockCount($outletId, $mitraStockIds);
        $productPerformance = $this->reportService->getProductPerformance(
            $outletId,
            $productStart,
            $productEnd,
            $mitraProductIds,
            $validated['product_id'] ?? null,
        );

        return Inertia::render('Reports/Index', [
            'monthlyReport' => $monthlyReport,
            'dailySummary' => $dailySummary,
            'revenue7Days' => $revenue7Days,
            'lowStockCount' => $lowStockCount,
            'currentMonth' => (int)$month,
            'currentYear' => (int)$year,
            'productPerformance' => $productPerformance,
        ]);
    }

    public function eSettlement(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $user = $request->user();
        $mitraProductIds = $user && $user->isMitra() ? $user->getMitraProductIds() : null;

        [$startDate, $endDate] = $this->settlementDateRange($request);

        return Inertia::render('Reports/ESettlement', [
            'filters' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'report' => $this->reportService->getESettlementReport($outletId, $startDate, $endDate, $mitraProductIds),
        ]);
    }

    public function eSettlementPdf(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $user = $request->user();
        $mitraProductIds = $user && $user->isMitra() ? $user->getMitraProductIds() : null;
        [$startDate, $endDate] = $this->settlementDateRange($request);

        $report = $this->reportService->getESettlementReport($outletId, $startDate, $endDate, $mitraProductIds);

        $pdf = Pdf::loadView('pdf.e-settlement', [
            'outlet' => Outlet::find($outletId),
            'report' => $report,
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait');

        $filename = "e-settlement-{$startDate->format('Ymd')}-{$endDate->format('Ymd')}.pdf";

        if ($request->boolean('browser_pdf')) {
            return response()->json([
                'filename' => $filename,
                'mime' => 'application/pdf',
                'base64' => base64_encode($pdf->output()),
            ]);
        }

        return $pdf->stream($filename);
    }

    private function settlementDateRange(Request $request): array
    {
        $validated = $request->validate([
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d'],
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

        return [$startDate, $endDate];
    }
}
