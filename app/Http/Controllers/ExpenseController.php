<?php

namespace App\Http\Controllers;

use App\Services\PettyCashService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ExpenseController extends Controller
{
    public function __construct(
        private PettyCashService $pettyCashService,
        private ShiftService $shiftService
    ) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $selectedCategory = $this->normalizeCategoryFilter($request->query('category'));
        $dateFilters = $this->normalizeDateFilters($request);
        $hasActiveFilter = $selectedCategory || $dateFilters['start'] || $dateFilters['end'];
        $expenses = $this->pettyCashService->listExpenses(
            $outletId,
            $selectedCategory,
            $hasActiveFilter ? null : 100,
            $dateFilters['start'],
            $dateFilters['end']
        );
        $categoryOptions = $this->pettyCashService->listCategories($outletId);
        if ($selectedCategory && ! in_array($selectedCategory, $categoryOptions, true)) {
            $categoryOptions[] = $selectedCategory;
        }
        $openShift = $this->shiftService->getOpenShift($outletId);

        return Inertia::render('Expenses/Index', [
            'expenses' => $expenses,
            'openShift' => $openShift,
            'categoryOptions' => $categoryOptions,
            'categorySummaries' => $this->pettyCashService->summarizeCategories(
                $outletId,
                $dateFilters['start'],
                $dateFilters['end']
            ),
            'filters' => [
                'category' => $selectedCategory ?? 'ALL',
                'date_from' => $dateFilters['date_from'],
                'date_to' => $dateFilters['date_to'],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        if ($request->user()?->isMitra()) {
            abort(403, 'Mitra tidak dapat mencatat mutasi kas.');
        }

        $data = $this->validateExpenseData($request);
        if (($data['category'] ?? null) === 'Penarikan' && ! $request->user()?->isOwner()) {
            abort(403, 'Hanya owner yang dapat melakukan penarikan kas.');
        }

        $data['outlet_id'] = $outletId;

        $this->pettyCashService->createExpense($data);

        return redirect()->back()->with('success', 'Pengeluaran berhasil dicatat.');
    }

    public function update(Request $request, string $id)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat mengubah mutasi kas.');
        $outletId = $request->session()->get('outlet_id');

        $data = $this->validateExpenseData($request);
        if (($data['category'] ?? null) === 'Penarikan' && ! $request->user()?->isOwner()) {
            abort(403, 'Hanya owner yang dapat melakukan penarikan kas.');
        }

        $this->pettyCashService->updateExpense($id, $outletId, $data, $request->user()->id);

        return redirect()->back()->with('success', 'Pengeluaran berhasil diubah.');
    }

    public function destroy(Request $request, string $id)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat menghapus mutasi kas.');
        $outletId = $request->session()->get('outlet_id');
        $this->pettyCashService->deleteExpense($id, $outletId);

        return redirect()->back()->with('success', 'Pengeluaran berhasil dihapus.');
    }

    private function validateExpenseData(Request $request): array
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'category' => 'required|string|max:80',
            'payment_method' => 'nullable|in:CASH,QRIS,PRIVATE',
            'cash_flow' => 'nullable|in:IN,OUT',
            'description' => 'nullable|string|max:255',
            'date' => 'nullable|date',
        ]);

        $data['category'] = trim((string) $data['category']);
        if ($data['category'] === '') {
            throw ValidationException::withMessages([
                'category' => 'Kategori wajib diisi.',
            ]);
        }

        if (array_key_exists('description', $data) && $data['description'] !== null) {
            $data['description'] = trim((string) $data['description']);
        }

        return $data;
    }

    private function normalizeCategoryFilter(mixed $category): ?string
    {
        $category = trim((string) $category);

        if ($category === '' || $category === 'ALL') {
            return null;
        }

        return $category;
    }

    private function normalizeDateFilters(Request $request): array
    {
        $filters = $request->validate([
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
        ]);

        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        return [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'start' => $dateFrom ? Carbon::parse($dateFrom)->startOfDay() : null,
            'end' => $dateTo ? Carbon::parse($dateTo)->endOfDay() : null,
        ];
    }
}
