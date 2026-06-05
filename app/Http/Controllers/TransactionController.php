<?php

namespace App\Http\Controllers;

use App\Services\TransactionService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TransactionController extends Controller
{
    public function __construct(private TransactionService $transactionService) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $transactions = $this->transactionService->listTransactions($outletId);

        return Inertia::render('Transactions/Index', [
            'transactions' => $transactions,
        ]);
    }
}
