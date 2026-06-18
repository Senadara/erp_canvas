<?php

namespace App\Services;

use App\Models\PettyCash;
use App\Models\StockItem;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function getMonthlyReport(string $outletId, int $month, int $year, ?array $mitraProductIds = null)
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = Carbon::create($year, $month, 1)->endOfMonth();

        $query = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->with(['items.product']);

        if ($mitraProductIds !== null) {
            $query->whereHas('items', function ($q) use ($mitraProductIds) {
                $q->whereIn('product_id', $mitraProductIds);
            });
        }

        $transactions = $query->get();

        $omzet = 0;
        $hpp = 0;

        foreach ($transactions as $t) {
            $hasMitraProduct = false;
            foreach ($t->items as $it) {
                if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                    $hasMitraProduct = true;
                    if ($it->product) {
                        $hpp += ($it->product->hpp * $it->qty_porsi);
                    }
                    $omzet += $it->subtotal; // Use subtotal instead of total_amount for specific items
                }
            }
        }

        $pengeluaran = 0;
        if ($mitraProductIds === null) {
            $pengeluaran = PettyCash::where('outlet_id', $outletId)
                ->whereBetween('created_at', [$start, $end])
                ->sum('amount');
        }

        $netProfit = $omzet - $hpp - $pengeluaran;

        return [
            'omzet' => $omzet,
            'hpp' => $hpp,
            'pengeluaran' => $pengeluaran,
            'netProfit' => $netProfit,
            'transactionCount' => $transactions->count(),
        ];
    }

    public function getDailySummary(string $outletId, Carbon $date, ?array $mitraProductIds = null)
    {
        $start = clone $date;
        $start->startOfDay();
        $end = clone $date;
        $end->endOfDay();

        $query = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->with('items');

        if ($mitraProductIds !== null) {
            $query->whereHas('items', function ($q) use ($mitraProductIds) {
                $q->whereIn('product_id', $mitraProductIds);
            });
        }

        $transactions = $query->get();

        $total = 0;
        $cash = 0;
        $qris = 0;

        foreach ($transactions as $t) {
            $tTotal = 0;
            foreach ($t->items as $it) {
                 if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                     $tTotal += $it->subtotal;
                 }
            }

            $total += $tTotal;
            if ($t->payment_method === 'CASH') $cash += $tTotal;
            elseif ($t->payment_method === 'QRIS') $qris += $tTotal;
        }

        $expenses = 0;
        if ($mitraProductIds === null) {
            $expenses = PettyCash::where('outlet_id', $outletId)
                ->whereBetween('created_at', [$start, $end])
                ->sum('amount');
        }

        return [
            'transactionCount' => $transactions->count(),
            'totalSales' => $total,
            'cashSales' => $cash,
            'qrisSales' => $qris,
            'expenses' => $expenses,
        ];
    }

    public function getLast7DaysRevenue(string $outletId, ?array $mitraProductIds = null)
    {
        $end = Carbon::now()->endOfDay();
        $start = clone $end;
        $start->subDays(6)->startOfDay();

        $query = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->with('items');

        if ($mitraProductIds !== null) {
            $query->whereHas('items', function ($q) use ($mitraProductIds) {
                $q->whereIn('product_id', $mitraProductIds);
            });
        }

        $transactions = $query->get();

        $byDay = [];
        for ($i = 0; $i < 7; $i++) {
            $d = clone $start;
            $d->addDays($i);
            $key = $d->format('Y-m-d');
            $byDay[$key] = ['date' => $key, 'total' => 0, 'cash' => 0, 'qris' => 0];
        }

        foreach ($transactions as $t) {
            $key = $t->created_at->format('Y-m-d');
            if (isset($byDay[$key])) {
                $tTotal = 0;
                foreach ($t->items as $it) {
                    if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                        $tTotal += $it->subtotal;
                    }
                }

                $byDay[$key]['total'] += $tTotal;
                if ($t->payment_method === 'CASH') {
                    $byDay[$key]['cash'] += $tTotal;
                } else {
                    $byDay[$key]['qris'] += $tTotal;
                }
            }
        }

        return array_values($byDay);
    }

    public function getLowStockCount(string $outletId, ?array $mitraStockIds = null)
    {
        $query = StockItem::where('outlet_id', $outletId)
            ->where('trackable', true);

        if ($mitraStockIds !== null) {
            $query->whereIn('id', $mitraStockIds);
        }

        $items = $query->get();
            
        $n = 0;
        foreach ($items as $it) {
            if ($it->current_stock_biji <= $it->min_stock_alert) {
                $n++;
            }
        }
        return $n;
    }
}
