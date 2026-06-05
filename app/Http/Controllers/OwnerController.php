<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OwnerController extends Controller
{
    public function __construct(private ReportService $reportService) {}

    public function index(Request $request)
    {
        $outlets = Outlet::withCount(['products', 'stockItems'])->get();

        $outletSummaries = [];
        foreach ($outlets as $outlet) {
            $daily = $this->reportService->getDailySummary($outlet->id, Carbon::now());
            $lowStock = $this->reportService->getLowStockCount($outlet->id);

            $outletSummaries[] = [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'address' => $outlet->address,
                'products_count' => $outlet->products_count,
                'stock_items_count' => $outlet->stock_items_count,
                'today' => $daily,
                'low_stock_count' => $lowStock,
            ];
        }

        return Inertia::render('Owner/Index', [
            'outletSummaries' => $outletSummaries,
        ]);
    }
}
