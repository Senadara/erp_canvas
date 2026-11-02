<?php

namespace Database\Seeders;

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
        // 2. OWNER
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

        // ──────────────────────────────────────────────
        // 3. STAFF
        // ──────────────────────────────────────────────
        $staff = User::create([
            'email'         => 'staff@karsa.id',
            'password_hash' => Hash::make('Staff123!'),
            'display_name'  => 'Andi Susanto',
            'role'          => 'STAFF',
            'is_active'     => true,
        ]);
        $staff->outlets()->attach($outlet->id);

        $staff2 = User::create([
            'email'         => 'staff2@karsa.id',
            'password_hash' => Hash::make('Staff123!'),
            'display_name'  => 'Rini Wulandari',
            'role'          => 'STAFF',
            'is_active'     => true,
        ]);
        $staff2->outlets()->attach($outlet->id);

        // ──────────────────────────────────────────────
        // 4. SUPPLIER
        // ──────────────────────────────────────────────
        $supplier = Supplier::create([
            'name'    => 'CV Bahan Makanan Nusantara',
            'phone'   => '0812-3456-7890',
            'address' => 'Jl. Pasar Sentral Blok B No. 12, Makassar',
        ]);

        // ──────────────────────────────────────────────
        // 5. STOK BAHAN
        // ──────────────────────────────────────────────
        $stockDefs = [
            ['name' => 'Kopi Robusta',        'unit' => 'gram',  'stock' => 5000,  'min' => 500,  'supplier_id' => $supplier->id],
            ['name' => 'Susu UHT',            'unit' => 'ml',    'stock' => 20000, 'min' => 2000, 'supplier_id' => $supplier->id],
            ['name' => 'Gula Pasir',           'unit' => 'gram',  'stock' => 10000, 'min' => 1000, 'supplier_id' => $supplier->id],
            ['name' => 'Roti Tawar',           'unit' => 'lembar','stock' => 100,   'min' => 20,   'supplier_id' => null],
            ['name' => 'Telur Ayam',           'unit' => 'butir', 'stock' => 120,   'min' => 24,   'supplier_id' => $supplier->id],
            ['name' => 'Mentega',              'unit' => 'gram',  'stock' => 2000,  'min' => 200,  'supplier_id' => null],
            ['name' => 'Teh Celup',            'unit' => 'sachet','stock' => 200,   'min' => 30,   'supplier_id' => $supplier->id],
            ['name' => 'Sirup Coklat',         'unit' => 'ml',    'stock' => 3000,  'min' => 300,  'supplier_id' => null],
            ['name' => 'Es Batu',              'unit' => 'kg',    'stock' => 50,    'min' => 10,   'supplier_id' => null],
            ['name' => 'Pisang Cavendish',     'unit' => 'buah',  'stock' => 60,    'min' => 12,   'supplier_id' => $supplier->id],
        ];

        $stocks = [];
        foreach ($stockDefs as $def) {
            $s = StockItem::create([
                'outlet_id'         => $outlet->id,
                'name'              => $def['name'],
                'unit_name'         => $def['unit'],
                'current_stock_biji'=> $def['stock'],
                'min_stock_alert'   => $def['min'],
                'supplier_id'       => $def['supplier_id'],
                'trackable'         => true,
                'counting_basis'    => 'BIJI',
            ]);
            $stocks[$def['name']] = $s;
        }

        // ──────────────────────────────────────────────
        // 6. PRODUK
        // ──────────────────────────────────────────────
        $productDefs = [
            ['name' => 'Kopi Hitam',          'category' => 'Minuman', 'price' => 12000,  'hpp' => 3500],
            ['name' => 'Kopi Susu',           'category' => 'Minuman', 'price' => 18000,  'hpp' => 6000],
            ['name' => 'Kopi Susu Gula Aren', 'category' => 'Minuman', 'price' => 22000,  'hpp' => 7500],
            ['name' => 'Es Kopi',             'category' => 'Minuman', 'price' => 20000,  'hpp' => 7000],
            ['name' => 'Matcha Latte',        'category' => 'Minuman', 'price' => 25000,  'hpp' => 9000],
            ['name' => 'Teh Tarik',           'category' => 'Minuman', 'price' => 14000,  'hpp' => 4000],
            ['name' => 'Es Teh Manis',        'category' => 'Minuman', 'price' => 8000,   'hpp' => 2000],
            ['name' => 'Coklat Panas',        'category' => 'Minuman', 'price' => 20000,  'hpp' => 7000],
            ['name' => 'Roti Bakar Coklat',   'category' => 'Makanan', 'price' => 18000,  'hpp' => 7000],
            ['name' => 'Roti Bakar Keju',     'category' => 'Makanan', 'price' => 20000,  'hpp' => 8000],
            ['name' => 'Pisang Goreng',       'category' => 'Makanan', 'price' => 12000,  'hpp' => 4000],
            ['name' => 'Telur Dadar',         'category' => 'Makanan', 'price' => 15000,  'hpp' => 5000],
            ['name' => 'Sandwich Telur',      'category' => 'Makanan', 'price' => 22000,  'hpp' => 9000],
            ['name' => 'Nasi Goreng Kafe',    'category' => 'Makanan', 'price' => 28000,  'hpp' => 11000],
            ['name' => 'Air Mineral',         'category' => 'Minuman', 'price' => 5000,   'hpp' => 1500],
        ];

        $products = [];
        foreach ($productDefs as $def) {
            $p = Product::create([
                'outlet_id' => $outlet->id,
                'name'      => $def['name'],
                'category'  => $def['category'],
                'price'     => $def['price'],
                'hpp'       => $def['hpp'],
                'is_active' => true,
            ]);
            $products[$def['name']] = $p;
        }

        // ──────────────────────────────────────────────
        // 7. SHIFT + TRANSAKSI (30 HARI TERAKHIR)
        // ──────────────────────────────────────────────
        $today   = Carbon::today();
        $invoice = 1001;

        // Kelompok produk untuk variasi transaksi
        $minumanPagi   = ['Kopi Hitam', 'Kopi Susu', 'Teh Tarik', 'Es Teh Manis'];
        $minumanSiang  = ['Es Kopi', 'Kopi Susu Gula Aren', 'Matcha Latte', 'Coklat Panas', 'Air Mineral'];
        $makanan       = ['Roti Bakar Coklat', 'Roti Bakar Keju', 'Pisang Goreng', 'Telur Dadar', 'Sandwich Telur', 'Nasi Goreng Kafe'];

        for ($day = 29; $day >= 0; $day--) {
            $date   = $today->copy()->subDays($day);
            $isWeekend = in_array($date->dayOfWeek, [Carbon::SATURDAY, Carbon::SUNDAY]);

            // Shift Pagi
            $shiftPagiOpen  = $date->copy()->setTime(8, 0);
            $shiftPagiClose = $date->copy()->setTime(14, 30);
            $cashPagi       = $isWeekend ? 100000 : 75000;
            $salesCashPagi  = 0;
            $salesQrisPagi  = 0;
            $expensesPagi   = 0;

            // Shift Sore
            $shiftSoreOpen  = $date->copy()->setTime(14, 30);
            $shiftSoreClose = $date->copy()->setTime(21, 0);
            $cashSore       = 50000;
            $salesCashSore  = 0;
            $salesQrisSore  = 0;
            $expensesSore   = 0;

            // Buat shift pagi
            $shiftPagi = ShiftRecord::create([
                'outlet_id'       => $outlet->id,
                'opened_by'       => $staff->id,
                'closed_by'       => $staff->id,
                'opened_at'       => $shiftPagiOpen,
                'closed_at'       => $shiftPagiClose,
                'opening_cash'    => $cashPagi,
                'expected_cash'   => 0, // akan diupdate
                'actual_cash'     => 0,
                'expected_qris'   => 0,
                'discrepancy'     => 0,
                'total_sales_cash'=> 0,
                'total_sales_qris'=> 0,
                'total_expenses'  => 0,
                'status'          => 'CLOSED',
                'note'            => 'Shift pagi - demo data',
            ]);

            // Buat shift sore
            $shiftSore = ShiftRecord::create([
                'outlet_id'       => $outlet->id,
                'opened_by'       => $staff2->id,
                'closed_by'       => $staff2->id,
                'opened_at'       => $shiftSoreOpen,
                'closed_at'       => $shiftSoreClose,
                'opening_cash'    => $cashSore,
                'expected_cash'   => 0,
                'actual_cash'     => 0,
                'expected_qris'   => 0,
                'discrepancy'     => 0,
                'total_sales_cash'=> 0,
                'total_sales_qris'=> 0,
                'total_expenses'  => 0,
                'status'          => 'CLOSED',
                'note'            => 'Shift sore - demo data',
            ]);

            // Transaksi Shift Pagi (8 – 14 transaksi)
            $txCountPagi = $isWeekend ? rand(12, 18) : rand(8, 13);
            for ($t = 0; $t < $txCountPagi; $t++) {
                $minuteOffset = rand(0, 380);
                $txTime       = $shiftPagiOpen->copy()->addMinutes($minuteOffset);
                $payMethod    = (rand(1, 10) <= 6) ? 'CASH' : 'QRIS';

                [$total, $items] = $this->buildOrder($products, $minumanPagi, $makanan, $isWeekend);

                $tx = Transaction::create([
                    'outlet_id'      => $outlet->id,
                    'invoice_number' => 'INV-DEMO-' . str_pad($invoice++, 6, '0', STR_PAD_LEFT),
                    'total_amount'   => $total,
                    'payment_method' => $payMethod,
                    'cash_received'  => $payMethod === 'CASH' ? $this->roundUp($total) : null,
                    'change_amount'  => $payMethod === 'CASH' ? ($this->roundUp($total) - $total) : null,
                    'payment_status' => 'PAID',
                    'paid_at'        => $txTime,
                    'created_at'     => $txTime,
                ]);

                foreach ($items as $item) {
                    TransactionItem::create([
                        'transaction_id'  => $tx->id,
                        'product_id'      => $item['product']->id,
                        'product_name'    => $item['product']->name,
                        'qty_porsi'       => $item['qty'],
                        'price_per_porsi' => $item['product']->price,
                        'subtotal'        => $item['qty'] * $item['product']->price,
                    ]);
                }

                if ($payMethod === 'CASH') {
                    $salesCashPagi += $total;
                } else {
                    $salesQrisPagi += $total;
                }
            }

            // Pengeluaran shift pagi (1-2 kali seminggu)
            if (rand(1, 7) <= 2) {
                $expAmount = rand(2, 8) * 5000;
                PettyCash::create([
                    'outlet_id'      => $outlet->id,
                    'amount'         => $expAmount,
                    'category'       => 'Operasional',
                    'description'    => collect(['Pembelian sabun cuci', 'Pembelian tisu', 'Pembelian deterjen', 'Isi ulang gas', 'Servis peralatan'])->random(),
                    'payment_method' => 'CASH',
                    'cash_flow'      => 'OUT',
                    'created_at'     => $shiftPagiOpen->copy()->addMinutes(rand(30, 180)),
                ]);
                $expensesPagi += $expAmount;
            }

            // Transaksi Shift Sore (6 – 12 transaksi)
            $txCountSore = $isWeekend ? rand(14, 20) : rand(6, 11);
            for ($t = 0; $t < $txCountSore; $t++) {
                $minuteOffset = rand(0, 390);
                $txTime       = $shiftSoreOpen->copy()->addMinutes($minuteOffset);
                $payMethod    = (rand(1, 10) <= 5) ? 'CASH' : 'QRIS';

                [$total, $items] = $this->buildOrder($products, $minumanSiang, $makanan, $isWeekend);

                $tx = Transaction::create([
                    'outlet_id'      => $outlet->id,
                    'invoice_number' => 'INV-DEMO-' . str_pad($invoice++, 6, '0', STR_PAD_LEFT),
                    'total_amount'   => $total,
                    'payment_method' => $payMethod,
                    'cash_received'  => $payMethod === 'CASH' ? $this->roundUp($total) : null,
                    'change_amount'  => $payMethod === 'CASH' ? ($this->roundUp($total) - $total) : null,
                    'payment_status' => 'PAID',
                    'paid_at'        => $txTime,
                    'created_at'     => $txTime,
                ]);

                foreach ($items as $item) {
                    TransactionItem::create([
                        'transaction_id'  => $tx->id,
                        'product_id'      => $item['product']->id,
                        'product_name'    => $item['product']->name,
                        'qty_porsi'       => $item['qty'],
                        'price_per_porsi' => $item['product']->price,
                        'subtotal'        => $item['qty'] * $item['product']->price,
                    ]);
                }

                if ($payMethod === 'CASH') {
                    $salesCashSore += $total;
                } else {
                    $salesQrisSore += $total;
                }
            }

            // Pengeluaran shift sore (sesekali)
            if (rand(1, 10) <= 3) {
                $expAmount = rand(3, 15) * 5000;
                PettyCash::create([
                    'outlet_id'      => $outlet->id,
                    'amount'         => $expAmount,
                    'category'       => collect(['Bahan Baku', 'Operasional', 'Utilitas'])->random(),
                    'description'    => collect(['Pembelian kopi', 'Pembelian susu', 'Rekening listrik', 'Pembelian gula', 'Pembelian es batu'])->random(),
                    'payment_method' => 'CASH',
                    'cash_flow'      => 'OUT',
                    'created_at'     => $shiftSoreOpen->copy()->addMinutes(rand(30, 200)),
                ]);
                $expensesSore += $expAmount;
            }

            // Update ringkasan shift
            $actualCashPagi = $cashPagi + $salesCashPagi - $expensesPagi;
            $shiftPagi->update([
                'total_sales_cash' => $salesCashPagi,
                'total_sales_qris' => $salesQrisPagi,
                'total_expenses'   => $expensesPagi,
                'expected_cash'    => $actualCashPagi,
                'actual_cash'      => $actualCashPagi + rand(-5000, 5000), // sedikit selisih realistis
                'expected_qris'    => $salesQrisPagi,
                'discrepancy'      => rand(-5000, 5000),
            ]);

            $actualCashSore = $cashSore + $salesCashSore - $expensesSore;
            $shiftSore->update([
                'total_sales_cash' => $salesCashSore,
                'total_sales_qris' => $salesQrisSore,
                'total_expenses'   => $expensesSore,
                'expected_cash'    => $actualCashSore,
                'actual_cash'      => $actualCashSore + rand(-5000, 5000),
                'expected_qris'    => $salesQrisSore,
                'discrepancy'      => rand(-5000, 5000),
            ]);
        }

        // Shift aktif hari ini (belum tutup)
        ShiftRecord::create([
            'outlet_id'       => $outlet->id,
            'opened_by'       => $staff->id,
            'closed_by'       => null,
            'opened_at'       => $today->copy()->setTime(8, 0),
            'closed_at'       => null,
            'opening_cash'    => 75000,
            'expected_cash'   => null,
            'actual_cash'     => null,
            'expected_qris'   => null,
            'discrepancy'     => null,
            'total_sales_cash'=> 0,
            'total_sales_qris'=> 0,
            'total_expenses'  => 0,
            'status'          => 'OPEN',
            'note'            => 'Shift aktif hari ini',
        ]);

        // ──────────────────────────────────────────────
        // 8. PAYROLL BULAN LALU
        // ──────────────────────────────────────────────
        $lastMonthStart = $today->copy()->startOfMonth()->subMonth();
        $lastMonthEnd   = $lastMonthStart->copy()->endOfMonth();

        foreach ([$staff, $staff2] as $idx => $karyawan) {
            $shiftCount  = rand(20, 26);
            $workDays    = rand(18, 24);
            $totalMins   = $shiftCount * rand(360, 480);
            $baseSalary  = 2500000;
            $bonus        = $idx === 0 ? 250000 : 150000;

            EmployeeSalaryPayment::create([
                'employee_id'     => $karyawan->id,
                'employee_name'   => $karyawan->display_name,
                'period_start'    => $lastMonthStart,
                'period_end'      => $lastMonthEnd,
                'work_days'       => $workDays,
                'shift_count'     => $shiftCount,
                'total_minutes'   => $totalMins,
                'average_minutes' => (int) ($totalMins / $shiftCount),
                'longest_shift_minutes'  => 480,
                'shortest_shift_minutes' => 360,
                'salary_type'     => 'MONTHLY',
                'monthly_amount'  => $baseSalary,
                'daily_rate'      => 0,
                'payable_days'    => $workDays,
                'base_amount'     => $baseSalary,
                'bonus_amount'    => $bonus,
                'deduction_amount'=> 0,
                'total_amount'    => $baseSalary + $bonus,
                'note'            => 'Gaji bulan ' . $lastMonthStart->translatedFormat('F Y'),
                'paid_at'         => $lastMonthEnd->copy()->addDays(3),
                'paid_by'         => $owner->id,
            ]);
        }
    }

    // ──────────────────────────────────────────────
    // Helper: Buat order acak
    // ──────────────────────────────────────────────
    private function buildOrder(array $products, array $menuList, array $makananList, bool $isWeekend): array
    {
        $items      = [];
        $total      = 0;
        $itemCount  = rand(1, $isWeekend ? 4 : 3);

        // Selalu ada minimal 1 minuman
        $menuKey = $menuList[array_rand($menuList)];
        if (isset($products[$menuKey])) {
            $qty    = rand(1, 2);
            $items[] = ['product' => $products[$menuKey], 'qty' => $qty];
            $total  += $qty * $products[$menuKey]->price;
        }

        // Tambahan item
        for ($i = 1; $i < $itemCount; $i++) {
            $allMenu  = array_merge($menuList, $makananList);
            $key      = $allMenu[array_rand($allMenu)];
            if (isset($products[$key])) {
                $qty    = 1;
                $items[] = ['product' => $products[$key], 'qty' => $qty];
                $total  += $qty * $products[$key]->price;
            }
        }

        return [$total, $items];
    }

    // Helper: Bulatkan ke 1000 terdekat ke atas
    private function roundUp(int $amount): int
    {
        return (int) (ceil($amount / 1000) * 1000);
    }
}
