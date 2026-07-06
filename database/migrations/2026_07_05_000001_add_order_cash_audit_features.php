<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->timestamp('canceled_at')->nullable()->after('paid_at');
            $table->string('canceled_by', 36)->nullable()->after('canceled_at');
            $table->string('cancel_reason')->nullable()->after('canceled_by');
            $table->timestamp('edited_by_owner_at')->nullable()->after('cancel_reason');
            $table->string('edited_by_owner_id', 36)->nullable()->after('edited_by_owner_at');
            $table->index(['outlet_id', 'canceled_at']);
        });

        Schema::create('transaction_stock_movements', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('transaction_id', 36);
            $table->string('stock_item_id', 36);
            $table->decimal('qty', 18, 4);
            $table->string('type', 32);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            $table->foreign('transaction_id')->references('id')->on('transactions')->cascadeOnDelete();
            $table->foreign('stock_item_id')->references('id')->on('stock_items')->cascadeOnDelete();
            $table->index(['transaction_id', 'type']);
            $table->index(['outlet_id', 'stock_item_id']);
        });

        Schema::table('petty_cash', function (Blueprint $table) {
            $table->string('payment_method', 16)->default('CASH')->after('category');
            $table->string('cash_flow', 8)->default('OUT')->after('payment_method');
            $table->timestamp('edited_by_owner_at')->nullable()->after('created_at');
            $table->string('edited_by_owner_id', 36)->nullable()->after('edited_by_owner_at');
            $table->index(['outlet_id', 'payment_method', 'cash_flow', 'created_at'], 'petty_cash_flow_idx');
        });

        Schema::table('shift_records', function (Blueprint $table) {
            $table->decimal('expected_qris', 18, 4)->nullable()->after('expected_cash');
            $table->timestamp('edited_by_owner_at')->nullable()->after('note');
            $table->string('edited_by_owner_id', 36)->nullable()->after('edited_by_owner_at');
        });
    }

    public function down(): void
    {
        Schema::table('shift_records', function (Blueprint $table) {
            $table->dropColumn(['expected_qris', 'edited_by_owner_at', 'edited_by_owner_id']);
        });

        Schema::table('petty_cash', function (Blueprint $table) {
            $table->dropIndex('petty_cash_flow_idx');
            $table->dropColumn(['payment_method', 'cash_flow', 'edited_by_owner_at', 'edited_by_owner_id']);
        });

        Schema::dropIfExists('transaction_stock_movements');

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['outlet_id', 'canceled_at']);
            $table->dropColumn([
                'canceled_at',
                'canceled_by',
                'cancel_reason',
                'edited_by_owner_at',
                'edited_by_owner_id',
            ]);
        });
    }
};
