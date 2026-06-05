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
        
        $month = $request->query('month', Carbon::now()->month);
        $year = $request->query('year', Carbon::now()->year);

        $monthlyReport = $this->reportService->getMonthlyReport($outletId, (int)$month, (int)$year);
        $dailySummary = $this->reportService->getDailySummary($outletId, Carbon::now());
        $revenue7Days = $this->reportService->getLast7DaysRevenue($outletId);
        $lowStockCount = $this->reportService->getLowStockCount($outletId);

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
