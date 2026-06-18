<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            $table->decimal('min_restock_qty', 18, 4)->default(1)->after('min_stock_alert');
            $table->decimal('restock_price', 18, 4)->default(0)->after('min_restock_qty');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropColumn(['min_restock_qty', 'restock_price']);
        });
    }
};
