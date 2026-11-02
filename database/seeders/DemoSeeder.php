<?php

namespace Database\Seeders;

use App\Models\Conversion;
use App\Models\EmployeeSalaryPayment;
use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\Product;
use App\Models\ShiftRecord;
use App\Models\StockItem;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // ──────────────────────────────────────────────
        // 1. OUTLET
        // ──────────────────────────────────────────────
        $outlet = Outlet::create([
            'name'    => 'Kafe Karsa Demo',
            'address' => 'Jl. Sudirman No. 42, Makassar',
            'phone'   => '0411-123456',
        ]);

        // ──────────────────────────────────────────────
        // 2. USERS (OWNER & STAFF)
        // ──────────────────────────────────────────────
        $ownerEmail    = env('SEED_OWNER_EMAIL', 'demo@karsa.id');
        $ownerPassword = env('SEED_OWNER_PASSWORD', 'Demo123!');

        $owner = User::create([
            'email'         => $ownerEmail,
            'password_hash' => Hash::make($ownerPassword),
            'display_name'  => 'Owner Demo',
            'role'          => 'OWNER',
            'is_active'     => true,
        ]);
        $owner->outlets()->attach($outlet->id);

        $staff1 = User::create([
            'email'         => 'staff@karsa.id',
            'password_hash' => Hash::make('Staff123!'),
            'display_name'  => 'Andi Susanto',
            'role'          => 'STAFF',
            'is_active'     => true,
        ]);
        $staff1->outlets()->attach($outlet->id);

        $staff2 = User::create([
            'email'         => 'staff2@karsa.id',
            'password_hash' => Hash::make('Staff123!'),
            'display_name'  => 'Rini Wulandari',
            'role'          => 'STAFF',
            'is_active'     => true,
        ]);
        $staff2->outlets()->attach($outlet->id);

        // ──────────────────────────────────────────────
        // 3. SUPPLIER & STOK BAHAN
        // ──────────────────────────────────────────────
        $supplier = Supplier::create([
            'name'    => 'CV Bahan Makanan Nusantara',
            'phone'   => '0812-3456-7890',
            'address' => 'Jl. Pasar Sentral Blok B No. 12, Makassar',
        ]);

        $stockDefs = [
            ['name' => 'Kopi Robusta',    'unit' => 'gram',   'stock' => 5000,  'min' => 500,  'supplier_id' => $supplier->id],
            ['name' => 'Susu UHT',        'unit' => 'ml',     'stock' => 20000, 'min' => 2000, 'supplier_id' => $supplier->id],
            ['name' => 'Gula Pasir',      'unit' => 'gram',   'stock' => 10000, 'min' => 1000, 'supplier_id' => $supplier->id],
            ['name' => 'Roti Tawar',      'unit' => 'lembar', 'stock' => 100,   'min' => 20,   'supplier_id' => null],
            ['name' => 'Pisang Cavendish','unit' => 'buah',   'stock' => 80,    'min' => 15,   'supplier_id' => $supplier->id],
            ['name' => 'Teh Celup',       'unit' => 'sachet', 'stock' => 250,   'min' => 30,   'supplier_id' => $supplier->id],
            ['name' => 'Sirup Coklat',    'unit' => 'ml',     'stock' => 3000,  'min' => 300,  'supplier_id' => null],
            ['name' => 'Es Batu',         'unit' => 'kg',     'stock' => 50,    'min' => 10,   'supplier_id' => null],
        ];

        $stocks = [];
        foreach ($stockDefs as $def) {
            $stocks[$def['name']] = StockItem::create([
                'outlet_id'         => $outlet->id,
                'name'              => $def['name'],
                'unit_name'         => $def['unit'],
                'current_stock_biji'=> $def['stock'],
                'min_stock_alert'   => $def['min'],
                'supplier_id'       => $def['supplier_id'],
                'trackable'         => true,
                'counting_basis'    => 'BIJI',
            ]);
        }

        // ──────────────────────────────────────────────
        // 4. PRODUK & BOM
        // ──────────────────────────────────────────────
        $productDefs = [
            ['name' => 'Kopi Susu',           'category' => 'Minuman', 'price' => 18000, 'hpp' => 5500],
            ['name' => 'Kopi Hitam',          'category' => 'Minuman', 'price' => 12000, 'hpp' => 3000],
            ['name' => 'Es Kopi Gula Aren',   'category' => 'Minuman', 'price' => 20000, 'hpp' => 6500],
            ['name' => 'Teh Tarik',           'category' => 'Minuman', 'price' => 14000, 'hpp' => 4000],
            ['name' => 'Es Teh Manis',        'category' => 'Minuman', 'price' => 8000,  'hpp' => 2000],
            ['name' => 'Coklat Panas',        'category' => 'Minuman', 'price' => 20000, 'hpp' => 7000],
            ['name' => 'Roti Bakar Coklat',   'category' => 'Makanan', 'price' => 16000, 'hpp' => 6000],
            ['name' => 'Pisang Goreng Keju',  'category' => 'Makanan', 'price' => 15000, 'hpp' => 5000],
            ['name' => 'Nasi Goreng Kafe',    'category' => 'Makanan', 'price' => 28000, 'hpp' => 11000],
            ['name' => 'Air Mineral',         'category' => 'Minuman', 'price' => 5000,  'hpp' => 1500],
        ];

        $products = [];
        foreach ($productDefs as $def) {
            $products[$def['name']] = Product::create([
                'outlet_id' => $outlet->id,
                'name'      => $def['name'],
                'category'  => $def['category'],
                'price'     => $def['price'],
                'hpp'       => $def['hpp'],
                'is_active' => true,
            ]);
        }

        // Setup BOM sederhana untuk beberapa produk
        if (isset($products['Kopi Susu'], $stocks['Kopi Robusta'], $stocks['Susu UHT'])) {
            Conversion::create(['product_id' => $products['Kopi Susu']->id, 'stock_item_id' => $stocks['Kopi Robusta']->id, 'ratio' => 15]);
            Conversion::create(['product_id' => $products['Kopi Susu']->id, 'stock_item_id' => $stocks['Susu UHT']->id, 'ratio' => 120]);
        }
        if (isset($products['Kopi Hitam'], $stocks['Kopi Robusta'])) {
            Conversion::create(['product_id' => $products['Kopi Hitam']->id, 'stock_item_id' => $stocks['Kopi Robusta']->id, 'ratio' => 15]);
        }
        if (isset($products['Es Teh Manis'], $stocks['Teh Celup'], $stocks['Gula Pasir'])) {
            Conversion::create(['product_id' => $products['Es Teh Manis']->id, 'stock_item_id' => $stocks['Teh Celup']->id, 'ratio' => 1]);
            Conversion::create(['product_id' => $products['Es Teh Manis']->id, 'stock_item_id' => $stocks['Gula Pasir']->id, 'ratio' => 20]);
        }

        // ──────────────────────────────────────────────
        // 5. SHIFT & TRANSAKSI REALISTIS (7 HARI TERAKHIR)
        // ──────────────────────────────────────────────
        $today = Carbon::today();
        $invoiceSeq = 1001;

        // Preset menu order realistis yang sering dipesan pelanggan
        $orderPresets = [
            [
                ['name' => 'Kopi Susu', 'qty' => 2],
                ['name' => 'Roti Bakar Coklat', 'qty' => 1],
            ],
            [
                ['name' => 'Kopi Hitam', 'qty' => 1],
                ['name' => 'Pisang Goreng Keju', 'qty' => 1],
            ],
            [
                ['name' => 'Es Kopi Gula Aren', 'qty' => 1],
                ['name' => 'Air Mineral', 'qty' => 1],
            ],
            [
                ['name' => 'Nasi Goreng Kafe', 'qty' => 1],
                ['name' => 'Es Teh Manis', 'qty' => 1],
            ],
            [
                ['name' => 'Teh Tarik', 'qty' => 2],
                ['name' => 'Pisang Goreng Keju', 'qty' => 1],
            ],
            [
                ['name' => 'Coklat Panas', 'qty' => 1],
                ['name' => 'Roti Bakar Coklat', 'qty' => 1],
            ],
            [
                ['name' => 'Kopi Susu', 'qty' => 1],
                ['name' => 'Kopi Hitam', 'qty' => 1],
            ],
            [
                ['name' => 'Es Teh Manis', 'qty' => 2],
                ['name' => 'Nasi Goreng Kafe', 'qty' => 2],
            ],
        ];

        // 7 Hari terakhir (H-6 s.d H-1 shift closed, H-0 shift hari ini)
        for ($dayOffset = 6; $dayOffset >= 1; $dayOffset--) {
            $date = $today->copy()->subDays($dayOffset);

            // ── Shift 1: Pagi (08:00 - 15:00) oleh Andi Susanto ──
            $pagiOpen  = $date->copy()->setTime(8, 0);
            $pagiClose = $date->copy()->setTime(15, 0);
            $pagiOpeningCash = 50000;

            $shiftPagi = ShiftRecord::create([
                'outlet_id'        => $outlet->id,
                'name'             => 'Shift Pagi ' . $date->format('d/m/Y'),
                'opened_by'        => $staff1->id,
                'closed_by'        => $staff1->id,
                'opened_at'        => $pagiOpen,
                'closed_at'        => $pagiClose,
                'opening_cash'     => $pagiOpeningCash,
                'status'           => 'CLOSED',
                'note'             => 'Operasional lancar',
            ]);

            [$salesCashPagi, $salesQrisPagi] = $this->seedShiftTransactions(
                $outlet->id,
                $shiftPagi->id,
                $pagiOpen,
                $products,
                $orderPresets,
                $invoiceSeq,
                rand(5, 7)
            );

            // 1 Pengeluaran kasir di shift pagi (sesekali)
            $pagiExpenses = 0;
            if ($dayOffset % 2 === 0) {
                $pagiExpenses = 20000;
                PettyCash::create([
                    'outlet_id'      => $outlet->id,
                    'amount'         => $pagiExpenses,
                    'category'       => 'Operasional',
                    'description'    => 'Beli Es Batu Kristal 2 Bal',
                    'payment_method' => 'CASH',
                    'cash_flow'      => 'OUT',
                    'created_at'     => $pagiOpen->copy()->addHours(2),
                ]);
            }

            $expectedCashPagi = $pagiOpeningCash + $salesCashPagi - $pagiExpenses;
            $shiftPagi->update([
                'total_sales_cash' => $salesCashPagi,
                'total_sales_qris' => $salesQrisPagi,
                'total_expenses'   => $pagiExpenses,
                'expected_cash'    => $expectedCashPagi,
                'actual_cash'      => $expectedCashPagi, // Pas / akurat
                'expected_qris'    => $salesQrisPagi,
                'discrepancy'      => 0,
            ]);

            // ── Shift 2: Sore (15:00 - 22:00) oleh Rini Wulandari ──
            $soreOpen  = $date->copy()->setTime(15, 0);
            $soreClose = $date->copy()->setTime(22, 0);
            $soreOpeningCash = 50000;

            $shiftSore = ShiftRecord::create([
                'outlet_id'        => $outlet->id,
                'name'             => 'Shift Sore ' . $date->format('d/m/Y'),
                'opened_by'        => $staff2->id,
                'closed_by'        => $staff2->id,
                'opened_at'        => $soreOpen,
                'closed_at'        => $soreClose,
                'opening_cash'     => $soreOpeningCash,
                'status'           => 'CLOSED',
                'note'             => 'Tutup shift malam',
            ]);

            [$salesCashSore, $salesQrisSore] = $this->seedShiftTransactions(
                $outlet->id,
                $shiftSore->id,
                $soreOpen,
                $products,
                $orderPresets,
                $invoiceSeq,
                rand(6, 8)
            );

            $soreExpenses = 0;
            if ($dayOffset % 3 === 0) {
                $soreExpenses = 22000;
                PettyCash::create([
                    'outlet_id'      => $outlet->id,
                    'amount'         => $soreExpenses,
                    'category'       => 'Operasional',
                    'description'    => 'Isi Ulang Gas LPG 3kg',
                    'payment_method' => 'CASH',
                    'cash_flow'      => 'OUT',
                    'created_at'     => $soreOpen->copy()->addHours(3),
                ]);
            }

            $expectedCashSore = $soreOpeningCash + $salesCashSore - $soreExpenses;
            $shiftSore->update([
                'total_sales_cash' => $salesCashSore,
                'total_sales_qris' => $salesQrisSore,
                'total_expenses'   => $soreExpenses,
                'expected_cash'    => $expectedCashSore,
                'actual_cash'      => $expectedCashSore,
                'expected_qris'    => $salesQrisSore,
                'discrepancy'      => 0,
            ]);
        }

        // ── Shift Hari Ini (H-0): Sedang Berjalan (OPEN) ──
        $todayOpen = $today->copy()->setTime(8, 0);
        $todayOpeningCash = 50000;

        $activeShift = ShiftRecord::create([
            'outlet_id'        => $outlet->id,
            'name'             => 'Shift Pagi ' . $today->format('d/m/Y'),
            'opened_by'        => $staff1->id,
            'closed_by'        => null,
            'opened_at'        => $todayOpen,
            'closed_at'        => null,
            'opening_cash'     => $todayOpeningCash,
            'status'           => 'OPEN',
            'note'             => 'Shift sedang berjalan hari ini',
        ]);

        // Berikan beberapa transaksi awal hari ini agar terlihat aktif
        [$todayCash, $todayQris] = $this->seedShiftTransactions(
            $outlet->id,
            $activeShift->id,
            $todayOpen,
            $products,
            $orderPresets,
            $invoiceSeq,
            4
        );

        // ──────────────────────────────────────────────
        // 6. HISTORI GAJI (PAYROLL) BULAN LALU
        // ──────────────────────────────────────────────
        $lastMonthStart = $today->copy()->startOfMonth()->subMonth();
        $lastMonthEnd   = $lastMonthStart->copy()->endOfMonth();

        foreach ([$staff1, $staff2] as $idx => $karyawan) {
            $shiftCount  = $idx === 0 ? 24 : 22;
            $workDays    = $idx === 0 ? 24 : 22;
            $totalMins   = $shiftCount * 420; // ~7 jam per shift
            $baseSalary  = 2500000;
            $bonus       = $idx === 0 ? 200000 : 150000;

            EmployeeSalaryPayment::create([
                'employee_id'            => $karyawan->id,
                'employee_name'          => $karyawan->display_name,
                'period_start'           => $lastMonthStart,
                'period_end'             => $lastMonthEnd,
                'work_days'              => $workDays,
                'shift_count'            => $shiftCount,
                'total_minutes'          => $totalMins,
                'average_minutes'        => 420,
                'longest_shift_minutes'  => 450,
                'shortest_shift_minutes' => 390,
                'salary_type'            => 'MONTHLY',
                'monthly_amount'         => $baseSalary,
                'daily_rate'             => 0,
                'payable_days'           => $workDays,
                'base_amount'            => $baseSalary,
                'bonus_amount'           => $bonus,
                'deduction_amount'       => 0,
                'total_amount'           => $baseSalary + $bonus,
                'note'                   => 'Gaji bulan ' . $lastMonthStart->translatedFormat('F Y'),
                'paid_at'                => $lastMonthEnd->copy()->addDays(2),
                'paid_by'                => $owner->id,
            ]);
        }
    }

    /**
     * Helper untuk membuat transaksi dalam suatu shift secara konsisten
     */
    private function seedShiftTransactions(
        string $outletId,
        string $shiftId,
        Carbon $startTime,
        array $products,
        array $orderPresets,
        int &$invoiceSeq,
        int $count
    ): array {
        $salesCash = 0;
        $salesQris = 0;

        for ($i = 0; $i < $count; $i++) {
            $txTime = $startTime->copy()->addMinutes(30 + ($i * 50) + rand(-10, 10));
            $preset = $orderPresets[$i % count($orderPresets)];

            $total = 0;
            $itemsData = [];

            foreach ($preset as $orderItem) {
                $pName = $orderItem['name'];
                if (!isset($products[$pName])) continue;

                $product = $products[$pName];
                $qty = $orderItem['qty'];
                $subtotal = $qty * $product->price;
                $total += $subtotal;

                $itemsData[] = [
                    'product_id'      => $product->id,
                    'product_name'    => $product->name,
                    'qty_porsi'       => $qty,
                    'price_per_porsi' => $product->price,
                    'subtotal'        => $subtotal,
                ];
            }

            // Pola metode bayar bergantian (CASH / QRIS)
            $payMethod = ($i % 2 === 0) ? 'CASH' : 'QRIS';
            $cashReceived = $payMethod === 'CASH' ? (int) (ceil($total / 10000) * 10000) : null;
            if ($cashReceived !== null && $cashReceived < $total) {
                $cashReceived = $total;
            }
            $changeAmount = $cashReceived !== null ? ($cashReceived - $total) : null;

            $tx = Transaction::create([
                'outlet_id'        => $outletId,
                'shift_id'         => $shiftId,
                'payment_shift_id' => $shiftId,
                'invoice_number'   => 'INV-' . $txTime->format('ymd') . '-' . str_pad($invoiceSeq++, 4, '0', STR_PAD_LEFT),
                'total_amount'     => $total,
                'payment_method'   => $payMethod,
                'cash_received'    => $cashReceived,
                'change_amount'    => $changeAmount,
                'payment_status'   => 'PAID',
                'paid_at'          => $txTime,
                'created_at'       => $txTime,
            ]);

            foreach ($itemsData as $item) {
                TransactionItem::create([
                    'transaction_id'  => $tx->id,
                    'product_id'      => $item['product_id'],
                    'product_name'    => $item['product_name'],
                    'qty_porsi'       => $item['qty_porsi'],
                    'price_per_porsi' => $item['price_per_porsi'],
                    'subtotal'        => $item['subtotal'],
                ]);
            }

            if ($payMethod === 'CASH') {
                $salesCash += $total;
            } else {
                $salesQris += $total;
            }
        }

        return [$salesCash, $salesQris];
    }
}
