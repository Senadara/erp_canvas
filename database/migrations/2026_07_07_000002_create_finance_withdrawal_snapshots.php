<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('finance_withdrawal_snapshots')) {
            return;
        }

        Schema::create('finance_withdrawal_snapshots', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('petty_cash_id', 36)->unique();
            $table->timestamp('period_start');
            $table->timestamp('period_end');
            $table->decimal('withdrawal_amount', 18, 4)->default(0);
            $table->string('withdrawal_method', 16)->default('CASH');
            $table->decimal('omzet_total', 18, 4)->default(0);
            $table->decimal('cash_sales', 18, 4)->default(0);
            $table->decimal('qris_sales', 18, 4)->default(0);
            $table->decimal('hpp_total', 18, 4)->default(0);
            $table->decimal('gross_profit', 18, 4)->default(0);
            $table->decimal('expense_total', 18, 4)->default(0);
            $table->decimal('cash_expense', 18, 4)->default(0);
            $table->decimal('qris_expense', 18, 4)->default(0);
            $table->decimal('outside_expense', 18, 4)->default(0);
            $table->decimal('cashier_topups', 18, 4)->default(0);
            $table->decimal('net_profit', 18, 4)->default(0);
            $table->decimal('net_after_allocations', 18, 4)->default(0);
            $table->decimal('cash_balance_before', 18, 4)->default(0);
            $table->decimal('qris_balance_before', 18, 4)->default(0);
            $table->decimal('available_before', 18, 4)->default(0);
            $table->decimal('remaining_after', 18, 4)->default(0);
            $table->unsignedInteger('transaction_count')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            $table->foreign('petty_cash_id')->references('id')->on('petty_cash')->cascadeOnDelete();
            $table->index(['outlet_id', 'period_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_withdrawal_snapshots');
    }
};
