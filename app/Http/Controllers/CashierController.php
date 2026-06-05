<?php

namespace App\Http\Controllers;

use App\Services\ProductService;
use App\Services\ShiftService;
use App\Services\TransactionService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CashierController extends Controller
{
    public function __construct(
        private ProductService $productService,
        private ShiftService $shiftService,
        private TransactionService $transactionService
    ) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        
        $openShift = $this->shiftService->getOpenShift($outletId);
        
        $products = [];
        $shiftTransactions = [];
        if ($openShift) {
            $products = $this->productService->listProducts($outletId);
            $shiftTransactions = $this->transactionService->getShiftTransactions($outletId, $openShift->opened_at);
        }

        return Inertia::render('Cashier/Index', [
            'openShift' => $openShift,
            'products' => $products,
            'shiftTransactions' => $shiftTransactions,
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $openShift = $this->shiftService->getOpenShift($outletId);
        
        if (!$openShift) {
            return redirect()->back()->withErrors(['error' => 'Shift belum dibuka.']);
        }

        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string',
            'items.*.product_name' => 'required|string',
            'items.*.qty_porsi' => 'required|integer|min:1',
            'items.*.price_per_porsi' => 'required|numeric|min:0',
            'items.*.note' => 'nullable|string',
            'payment_status' => 'required|in:PAID,UNPAID',
            'payment_method' => 'nullable|in:CASH,QRIS',
            'cash_received' => 'nullable|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        $data['outlet_id'] = $outletId;

        try {
            $transaction = $this->transactionService->processSale($data);
            return redirect()->back()
                ->with('success', 'Transaksi berhasil disimpan. No: ' . $transaction->invoice_number)
                ->with('new_transaction', $transaction->toArray());
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function payDebt(Request $request, string $id)
    {
        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'payment_method' => 'required|in:CASH,QRIS',
            'cash_received' => 'nullable|numeric|min:0',
        ]);

        try {
            $transaction = $this->transactionService->payDebt($id, $outletId, $data['payment_method'], $data['cash_received'] ?? null);
            return redirect()->back()
                ->with('success', 'Pembayaran berhasil. No: ' . $transaction->invoice_number)
                ->with('new_transaction', $transaction->toArray());
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
