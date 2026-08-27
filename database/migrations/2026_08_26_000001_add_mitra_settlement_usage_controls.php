<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_items', 'settlement_usage_method')) {
                $table->string('settlement_usage_method', 32)->default('BOM')->after('cost_category');
            }
        });

        DB::table('stock_items')
            ->whereNull('settlement_usage_method')
            ->update(['settlement_usage_method' => 'BOM']);

        if (! Schema::hasTable('mitra_stock_usage_adjustments')) {
            Schema::create('mitra_stock_usage_adjustments', function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('outlet_id', 36);
                $table->string('mitra_id', 36);
                $table->string('stock_item_id', 36);
                $table->string('warehouse_stock_item_id', 36)->nullable();
                $table->string('usage_type', 32);
                $table->decimal('quantity', 18, 4);
                $table->text('note')->nullable();
                $table->timestamp('reported_at');
                $table->string('created_by', 36)->nullable();
                $table->timestamps();

                $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
                $table->foreign('mitra_id')->references('id')->on('users')->cascadeOnDelete();
                $table->foreign('stock_item_id')->references('id')->on('stock_items')->cascadeOnDelete();
                $table->foreign('warehouse_stock_item_id')->references('id')->on('warehouse_stock_items')->nullOnDelete();
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
                $table->index(['mitra_id', 'reported_at'], 'mitra_usage_adjustments_mitra_date_idx');
                $table->index(['stock_item_id', 'usage_type', 'reported_at'], 'mitra_usage_adjustments_stock_type_date_idx');
                $table->index(['warehouse_stock_item_id', 'usage_type', 'reported_at'], 'mitra_usage_adjustments_warehouse_type_date_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('mitra_stock_usage_adjustments');

        Schema::table('stock_items', function (Blueprint $table) {
            if (Schema::hasColumn('stock_items', 'settlement_usage_method')) {
                $table->dropColumn('settlement_usage_method');
            }
        });
    }
};
