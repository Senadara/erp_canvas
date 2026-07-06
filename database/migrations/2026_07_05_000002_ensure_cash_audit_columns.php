<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('transactions', 'canceled_at')) {
                $table->timestamp('canceled_at')->nullable();
            }
            if (! Schema::hasColumn('transactions', 'canceled_by')) {
                $table->string('canceled_by', 36)->nullable();
            }
            if (! Schema::hasColumn('transactions', 'cancel_reason')) {
                $table->string('cancel_reason')->nullable();
            }
            if (! Schema::hasColumn('transactions', 'edited_by_owner_at')) {
                $table->timestamp('edited_by_owner_at')->nullable();
            }
            if (! Schema::hasColumn('transactions', 'edited_by_owner_id')) {
                $table->string('edited_by_owner_id', 36)->nullable();
            }
        });

        if (! Schema::hasTable('transaction_stock_movements')) {
            Schema::create('transaction_stock_movements', function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('outlet_id', 36);
                $table->string('transaction_id', 36);
                $table->string('stock_item_id', 36);
                $table->decimal('qty', 18, 4);
                $table->string('type', 32);
                $table->timestamp('created_at')->useCurrent();
                $table->index(['transaction_id', 'type']);
                $table->index(['outlet_id', 'stock_item_id']);
            });
        }

        Schema::table('petty_cash', function (Blueprint $table) {
            if (! Schema::hasColumn('petty_cash', 'payment_method')) {
                $table->string('payment_method', 16)->default('CASH');
            }
            if (! Schema::hasColumn('petty_cash', 'cash_flow')) {
                $table->string('cash_flow', 8)->default('OUT');
            }
            if (! Schema::hasColumn('petty_cash', 'edited_by_owner_at')) {
                $table->timestamp('edited_by_owner_at')->nullable();
            }
            if (! Schema::hasColumn('petty_cash', 'edited_by_owner_id')) {
                $table->string('edited_by_owner_id', 36)->nullable();
            }
        });

        Schema::table('shift_records', function (Blueprint $table) {
            if (! Schema::hasColumn('shift_records', 'expected_qris')) {
                $table->decimal('expected_qris', 18, 4)->nullable();
            }
            if (! Schema::hasColumn('shift_records', 'edited_by_owner_at')) {
                $table->timestamp('edited_by_owner_at')->nullable();
            }
            if (! Schema::hasColumn('shift_records', 'edited_by_owner_id')) {
                $table->string('edited_by_owner_id', 36)->nullable();
            }
        });
    }

    public function down(): void
    {
        //
    }
};
