<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ModulePageController;
use App\Http\Controllers\OutletSessionController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::middleware(['auth', 'outlet'])->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::post('/outlet', [OutletSessionController::class, 'store'])->name('outlet.set');

    // Display Groups
    Route::post('/display-groups', [\App\Http\Controllers\DisplayGroupController::class, 'store'])->name('display-groups.store');
    Route::delete('/display-groups/{id}', [\App\Http\Controllers\DisplayGroupController::class, 'destroy'])->name('display-groups.destroy');

    // Products
    Route::get('/products', [\App\Http\Controllers\ProductController::class, 'index'])->name('products');
    Route::post('/products', [\App\Http\Controllers\ProductController::class, 'store'])->name('products.store');
    Route::delete('/products/{id}', [\App\Http\Controllers\ProductController::class, 'destroy'])->name('products.destroy');
    Route::post('/products/{id}/conversions', [\App\Http\Controllers\ProductController::class, 'setConversions'])->name('products.conversions');

    // Stock
    Route::get('/stock', [\App\Http\Controllers\StockController::class, 'index'])->name('stock');
    Route::post('/stock', [\App\Http\Controllers\StockController::class, 'store'])->name('stock.store');
    Route::delete('/stock/{id}', [\App\Http\Controllers\StockController::class, 'destroy'])->name('stock.destroy');
    Route::post('/stock/{id}/add', [\App\Http\Controllers\StockController::class, 'addStock'])->name('stock.add');
    Route::post('/stock/{id}/waste', [\App\Http\Controllers\StockController::class, 'recordWaste'])->name('stock.waste');
    Route::put('/stock/{id}/mitra-price', [\App\Http\Controllers\StockController::class, 'updateMitraPrice'])->name('stock.update-mitra-price');

    // Cashier (Kasir)
    Route::get('/cashier', [\App\Http\Controllers\CashierController::class, 'index'])->name('cashier');
    Route::post('/cashier', [\App\Http\Controllers\CashierController::class, 'store'])->name('cashier.store');
    Route::post('/cashier/pay-debt/{id}', [\App\Http\Controllers\CashierController::class, 'payDebt'])->name('cashier.pay-debt');

    // Transactions (Struk / Receipts)
    Route::get('/receipts', [\App\Http\Controllers\TransactionController::class, 'index'])->name('receipts');

    // Shifts
    Route::get('/shifts', [\App\Http\Controllers\ShiftController::class, 'index'])->name('shifts');
    Route::get('/shifts/{id}/detail', [\App\Http\Controllers\ShiftController::class, 'show'])->name('shifts.show');
    Route::post('/shifts/open', [\App\Http\Controllers\ShiftController::class, 'store'])->name('shifts.store');
    Route::post('/shifts/{id}/close', [\App\Http\Controllers\ShiftController::class, 'update'])->name('shifts.update');

    // Expenses (Pengeluaran)
    Route::get('/expenses', [\App\Http\Controllers\ExpenseController::class, 'index'])->name('expenses');
    Route::post('/expenses', [\App\Http\Controllers\ExpenseController::class, 'store'])->name('expenses.store');
    Route::put('/expenses/{id}', [\App\Http\Controllers\ExpenseController::class, 'update'])->name('expenses.update');
    Route::delete('/expenses/{id}', [\App\Http\Controllers\ExpenseController::class, 'destroy'])->name('expenses.destroy');

    // Reports (Laporan)
    Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index'])->name('reports');
    
    // Mitra Reports
    Route::get('/mitra-reports', [\App\Http\Controllers\MitraReportController::class, 'index'])->name('mitra-reports');

    // Settlements
    Route::get('/settlements', [\App\Http\Controllers\MitraSettlementController::class, 'index'])->name('settlements');
    Route::post('/settlements', [\App\Http\Controllers\MitraSettlementController::class, 'store'])->name('settlements.store');
    Route::post('/settlements/{id}/pay', [\App\Http\Controllers\MitraSettlementController::class, 'pay'])->name('settlements.pay');

    // Owner Dashboard
    Route::get('/owner', [\App\Http\Controllers\OwnerController::class, 'index'])->name('owner');

    // Users (Pengguna)
    Route::get('/users', [\App\Http\Controllers\UserController::class, 'index'])->name('users');
    Route::post('/users', [\App\Http\Controllers\UserController::class, 'store'])->name('users.store');
    Route::put('/users/{id}', [\App\Http\Controllers\UserController::class, 'update'])->name('users.update');
    Route::delete('/users/{id}', [\App\Http\Controllers\UserController::class, 'destroy'])->name('users.destroy');

    // Suppliers
    Route::get('/suppliers', [\App\Http\Controllers\SupplierController::class, 'index'])->name('suppliers');
    Route::post('/suppliers', [\App\Http\Controllers\SupplierController::class, 'store'])->name('suppliers.store');
    Route::delete('/suppliers/{id}', [\App\Http\Controllers\SupplierController::class, 'destroy'])->name('suppliers.destroy');

    // Waste
    Route::get('/waste', [\App\Http\Controllers\WasteController::class, 'index'])->name('waste');
    Route::post('/waste', [\App\Http\Controllers\WasteController::class, 'store'])->name('waste.store');

    // Outlets
    Route::get('/outlets', [\App\Http\Controllers\OutletController::class, 'index'])->name('outlets');
    Route::post('/outlets', [\App\Http\Controllers\OutletController::class, 'store'])->name('outlets.store');
    Route::delete('/outlets/{id}', [\App\Http\Controllers\OutletController::class, 'destroy'])->name('outlets.destroy');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');

    // Investments
    Route::get('/investments', [\App\Http\Controllers\InvestmentController::class, 'index'])->name('investments');
    Route::post('/investments', [\App\Http\Controllers\InvestmentController::class, 'store'])->name('investments.store');
    Route::post('/investments/{id}/approve', [\App\Http\Controllers\InvestmentController::class, 'approve'])->name('investments.approve');
    Route::post('/investments/{id}/reject', [\App\Http\Controllers\InvestmentController::class, 'reject'])->name('investments.reject');
});

require __DIR__.'/auth.php';
