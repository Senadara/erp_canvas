<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_audit_counts')) {
            return;
        }

        Schema::create('stock_audit_counts', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('stock_item_id', 36);
            $table->decimal('counted_stock', 18, 4)->default(0);
            $table->decimal('system_stock', 18, 4)->default(0);
            $table->decimal('difference', 18, 4)->default(0);
            $table->timestamp('counted_at');
            $table->string('counted_by', 36)->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            $table->foreign('stock_item_id')->references('id')->on('stock_items')->cascadeOnDelete();
            $table->foreign('counted_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['outlet_id', 'stock_item_id', 'counted_at'], 'stock_audit_counts_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_audit_counts');
    }
};
