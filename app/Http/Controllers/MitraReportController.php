<?php

namespace App\Http\Controllers;

use App\Services\MitraReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MitraReportController extends Controller
{
    public function __construct(private MitraReportService $mitraReportService) {}

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isMitra()) {
            abort(403, 'Hanya mitra yang dapat mengakses halaman ini.');
        }

        $outletId = $request->session()->get('outlet_id');
        
        $startDate = $request->query('start_date') 
            ? Carbon::parse($request->query('start_date')) 
            : Carbon::now()->startOfMonth();
            
        $endDate = $request->query('end_date') 
            ? Carbon::parse($request->query('end_date')) 
            : Carbon::now()->endOfMonth();

        $reportData = [];
        if ($outletId) {
            $reportData = $this->mitraReportService->getMitraReportData($outletId, $user, $startDate, $endDate);
        }

        return Inertia::render('MitraReports/Index', [
            'reportData' => $reportData,
            'startDate' => $startDate->format('Y-m-d'),
            'endDate' => $endDate->format('Y-m-d'),
        ]);
    }
}
