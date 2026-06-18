<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mitra_stock_scopes', function (Blueprint $table) {
            $table->decimal('price', 18, 4)->default(0)->after('stock_item_id');
        });

        Schema::create('mitra_settlements', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('mitra_id', 36);
            $table->timestamp('period_start');
            $table->timestamp('period_end');
            $table->string('calculation_method'); // SALES, RESTOCK
            $table->decimal('total_amount', 18, 4);
            $table->string('status')->default('PENDING'); // PENDING, PAID
            $table->json('receipt_data')->nullable(); // Stores the detailed breakdown
            $table->timestamps();

            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            $table->foreign('mitra_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['outlet_id', 'mitra_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mitra_settlements');
        
        Schema::table('mitra_stock_scopes', function (Blueprint $table) {
            $table->dropColumn('price');
        });
    }
};
