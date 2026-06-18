<?php

namespace App\Http\Controllers;

use App\Models\MitraSettlement;
use App\Models\User;
use App\Services\MitraReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MitraSettlementController extends Controller
{
    public function __construct(private MitraReportService $mitraReportService) {}

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isOwner() && !($user->feature_overrides['settlements'] ?? false))) {
            abort(403, 'Anda tidak memiliki akses ke halaman ini.');
        }

        $outletId = $request->session()->get('outlet_id');
        
        $mitras = User::where('role', 'MITRA')->where('is_active', true)->orderBy('display_name')->get(['id', 'display_name']);

        $selectedMitraId = $request->query('mitra_id');
        $startDate = $request->query('start_date') ? Carbon::parse($request->query('start_date')) : Carbon::now()->startOfMonth();
        $endDate = $request->query('end_date') ? Carbon::parse($request->query('end_date')) : Carbon::now()->endOfMonth();

        $reportData = [];
        if ($outletId && $selectedMitraId) {
            $mitra = User::find($selectedMitraId);
            if ($mitra) {
                $reportData = $this->mitraReportService->getMitraReportData($outletId, $mitra, $startDate, $endDate);
            }
        }

        $settlements = MitraSettlement::with('mitra:id,display_name')
            ->where('outlet_id', $outletId)
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('Settlements/Index', [
            'mitras' => $mitras,
            'selectedMitraId' => $selectedMitraId,
            'startDate' => $startDate->format('Y-m-d'),
            'endDate' => $endDate->format('Y-m-d'),
            'reportData' => $reportData,
            'settlements' => $settlements,
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
            'end_date' => 'required|date',
            'calculation_method' => 'required|in:SALES,RESTOCK',
            'total_amount' => 'required|numeric|min:0',
            'receipt_data' => 'required|array',
        ]);

        $mitra = User::find($data['mitra_id']);
        if (!$mitra || !$mitra->isMitra()) {
            return redirect()->back()->withErrors(['mitra_id' => 'Pengguna tidak valid.']);
        }

        MitraSettlement::create([
            'outlet_id' => $outletId,
            'mitra_id' => $data['mitra_id'],
            'period_start' => Carbon::parse($data['start_date'])->startOfDay(),
            'period_end' => Carbon::parse($data['end_date'])->endOfDay(),
            'calculation_method' => $data['calculation_method'],
            'total_amount' => $data['total_amount'],
            'status' => 'PENDING',
            'receipt_data' => $data['receipt_data'],
        ]);

        return redirect()->back()->with('success', 'Struk setoran berhasil dibuat.');
    }

    public function pay(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || (!$user->isOwner() && !($user->feature_overrides['settlements'] ?? false))) {
            abort(403, 'Anda tidak memiliki akses ke halaman ini.');
        }

        $settlement = MitraSettlement::findOrFail($id);
        $settlement->update(['status' => 'PAID']);

        return redirect()->back()->with('success', 'Setoran berhasil ditandai Lunas.');
    }
}
