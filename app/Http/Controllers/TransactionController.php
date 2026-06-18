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
        $user = $request->user();

        if ($user && $user->isMitra() && !$user->mitra_can_view_sales) {
            abort(403, 'Anda tidak memiliki akses untuk melihat data penjualan.');
        }

        $transactions = $this->transactionService->listTransactions($outletId);

        if ($user && $user->isMitra()) {
            $mitraProductIds = $user->getMitraProductIds();
            
            // Filter the paginated transactions to only include those that have the mitra's products
            // Note: Since listTransactions returns a paginator or collection, we need to filter the collection.
            // Ideally, this filtering should be done in the TransactionService query to keep pagination intact,
            // but since listTransactions is used elsewhere, we can filter it here for simplicity or update the service.
            // Let's filter the collection if it's not paginated, or just filter the items.
            // Actually, listTransactions returns latest()->take(100)->get() or similar. Let's filter it.
            $transactions = collect($transactions)->filter(function ($t) use ($mitraProductIds) {
                foreach ($t->items as $item) {
                    if (in_array($item->product_id, $mitraProductIds)) {
                        return true;
                    }
                }
                return false;
            })->values();
        }

        return Inertia::render('Transactions/Index', [
            'transactions' => $transactions,
        ]);
    }
}
