<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
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

        $monthlyReport = $this->reportService->getMonthlyReport($outletId, (int)$month, (int)$year, $mitraProductIds);
        $dailySummary = $this->reportService->getDailySummary($outletId, Carbon::now(), $mitraProductIds);
        $revenue7Days = $this->reportService->getLast7DaysRevenue($outletId, $mitraProductIds);
        $lowStockCount = $this->reportService->getLowStockCount($outletId, $mitraStockIds);

        return Inertia::render('Reports/Index', [
            'monthlyReport' => $monthlyReport,
            'dailySummary' => $dailySummary,
            'revenue7Days' => $revenue7Days,
            'lowStockCount' => $lowStockCount,
            'currentMonth' => (int)$month,
            'currentYear' => (int)$year,
        ]);
    }
}
