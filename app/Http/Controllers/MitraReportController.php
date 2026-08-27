<?php

namespace App\Http\Controllers;

use App\Models\User;
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
        if (!$user || (!$user->isOwner() && !$user->isMitra())) {
            abort(403, 'Hanya owner dan mitra yang dapat mengakses halaman ini.');
        }

        $outletId = $request->session()->get('outlet_id');
        
        $startDate = $request->query('start_date') 
            ? Carbon::parse($request->query('start_date')) 
            : Carbon::now()->startOfMonth();
            
        $endDate = $request->query('end_date') 
            ? Carbon::parse($request->query('end_date')) 
            : Carbon::now()->endOfMonth();

        $reportData = [];
        $overview = [
            'items' => [],
            'summary' => [],
            'product_usage' => [],
            'deliveries' => [],
            'restock_history' => [],
            'settlements' => [],
        ];

        $mitras = [];
        $selectedMitraId = null;
        $selectedMitra = null;

        if ($user->isOwner()) {
            $mitras = User::where('role', 'MITRA')
                ->where('is_active', true)
                ->orderBy('display_name')
                ->get(['id', 'display_name', 'email'])
                ->map(fn (User $mitra) => [
                    'id' => $mitra->id,
                    'display_name' => $mitra->display_name,
                    'email' => $mitra->email,
                ])
                ->values()
                ->all();

            $selectedMitraId = $request->query('mitra_id') ?: ($mitras[0]['id'] ?? null);
            $selectedMitra = $selectedMitraId
                ? User::where('role', 'MITRA')->where('is_active', true)->find($selectedMitraId)
                : null;

            if ($selectedMitra) {
                $overview = $this->mitraReportService->getMitraReportOverviewAcrossOutlets($selectedMitra, $startDate, $endDate);
                $reportData = $overview['items'];
            }
        } elseif ($outletId) {
            $selectedMitraId = $user->id;
            $selectedMitra = $user;
            $overview = $this->mitraReportService->getMitraReportOverview($outletId, $user, $startDate, $endDate);
            $reportData = $overview['items'];
        }

        return Inertia::render('MitraReports/Index', [
            'reportData' => $reportData,
            'overview' => $overview,
            'startDate' => $startDate->format('Y-m-d'),
            'endDate' => $endDate->format('Y-m-d'),
            'mitras' => $mitras,
            'selectedMitraId' => $selectedMitraId,
            'selectedMitra' => $selectedMitra ? [
                'id' => $selectedMitra->id,
                'display_name' => $selectedMitra->display_name,
                'email' => $selectedMitra->email,
            ] : null,
            'isOwner' => $user->isOwner(),
        ]);
    }
}
