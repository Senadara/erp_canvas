<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mitra_stock_deliveries', function (Blueprint $table) {
            $table->dropForeign(['outlet_id']);
            $table->dropForeign(['stock_item_id']);
        });

        Schema::table('mitra_stock_deliveries', function (Blueprint $table) {
            $table->string('outlet_id', 36)->nullable()->change();
            $table->string('stock_item_id', 36)->nullable()->change();
        });

        Schema::table('mitra_stock_deliveries', function (Blueprint $table) {
            $table->foreign('outlet_id')->references('id')->on('outlets')->nullOnDelete();
            $table->foreign('stock_item_id')->references('id')->on('stock_items')->nullOnDelete();
        });

        DB::table('mitra_stock_deliveries')
            ->whereNotNull('warehouse_stock_item_id')
            ->update(['outlet_id' => null]);
    }

    public function down(): void
    {
        Schema::table('mitra_stock_deliveries', function (Blueprint $table) {
            $table->dropForeign(['outlet_id']);
            $table->dropForeign(['stock_item_id']);
            $table->foreign('outlet_id')->references('id')->on('outlets')->nullOnDelete();
            $table->foreign('stock_item_id')->references('id')->on('stock_items')->nullOnDelete();
        });
    }
};
