<?php

namespace App\Services;

use App\Models\PettyCash;
use App\Models\StockItem;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function getMonthlyReport(string $outletId, int $month, int $year)
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = Carbon::create($year, $month, 1)->endOfMonth();

        $transactions = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->with(['items.product'])
            ->get();

        $omzet = 0;
        $hpp = 0;

        foreach ($transactions as $t) {
            $omzet += $t->total_amount;
            foreach ($t->items as $it) {
                if ($it->product) {
                    $hpp += ($it->product->hpp * $it->qty_porsi);
                }
            }
        }

        $pengeluaran = PettyCash::where('outlet_id', $outletId)
            ->whereBetween('created_at', [$start, $end])
            ->sum('amount');

        $netProfit = $omzet - $hpp - $pengeluaran;

        return [
            'omzet' => $omzet,
            'hpp' => $hpp,
            'pengeluaran' => $pengeluaran,
            'netProfit' => $netProfit,
            'transactionCount' => $transactions->count(),
        ];
    }

    public function getDailySummary(string $outletId, Carbon $date)
    {
        $start = clone $date;
        $start->startOfDay();
        $end = clone $date;
        $end->endOfDay();

        $transactions = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->get();

        $total = 0;
        $cash = 0;
        $qris = 0;

        foreach ($transactions as $t) {
            $total += $t->total_amount;
            if ($t->payment_method === 'CASH') $cash += $t->total_amount;
            elseif ($t->payment_method === 'QRIS') $qris += $t->total_amount;
        }

        $expenses = PettyCash::where('outlet_id', $outletId)
            ->whereBetween('created_at', [$start, $end])
            ->sum('amount');

        return [
            'transactionCount' => $transactions->count(),
            'totalSales' => $total,
            'cashSales' => $cash,
            'qrisSales' => $qris,
            'expenses' => $expenses,
        ];
    }

    public function getLast7DaysRevenue(string $outletId)
    {
        $end = Carbon::now()->endOfDay();
        $start = clone $end;
        $start->subDays(6)->startOfDay();

        $transactions = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->get();

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
                $byDay[$key]['total'] += $t->total_amount;
                if ($t->payment_method === 'CASH') {
                    $byDay[$key]['cash'] += $t->total_amount;
                } else {
                    $byDay[$key]['qris'] += $t->total_amount;
                }
            }
        }

        return array_values($byDay);
    }

    public function getLowStockCount(string $outletId)
    {
        $items = StockItem::where('outlet_id', $outletId)
            ->where('trackable', true)
            ->get();
            
        $n = 0;
        foreach ($items as $it) {
            if ($it->current_stock_biji <= $it->min_stock_alert) {
                $n++;
            }
        }
        return $n;
    }
}
