<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('waste_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('waste_logs', 'source_type')) {
                $table->string('source_type', 16)->default('STOCK')->after('stock_item_id');
            }
            if (! Schema::hasColumn('waste_logs', 'product_id')) {
                $table->string('product_id', 36)->nullable()->after('source_type');
            }
            if (! Schema::hasColumn('waste_logs', 'product_name')) {
                $table->string('product_name')->nullable()->after('product_id');
            }
            if (! Schema::hasColumn('waste_logs', 'qty_porsi')) {
                $table->decimal('qty_porsi', 18, 4)->nullable()->after('qty_biji');
            }
            if (! Schema::hasColumn('waste_logs', 'waste_type')) {
                $table->string('waste_type', 32)->default('OTHER')->after('reason');
            }
            if (! Schema::hasColumn('waste_logs', 'loss_amount')) {
                $table->decimal('loss_amount', 18, 4)->default(0)->after('waste_type');
            }
            if (! Schema::hasColumn('waste_logs', 'affects_mitra_settlement')) {
                $table->boolean('affects_mitra_settlement')->default(true)->after('loss_amount');
            }
            $table->index(['outlet_id', 'waste_type', 'created_at'], 'waste_logs_type_idx');
        });
    }

    public function down(): void
    {
        Schema::table('waste_logs', function (Blueprint $table) {
            $table->dropIndex('waste_logs_type_idx');
            $table->dropColumn([
                'source_type',
                'product_id',
                'product_name',
                'qty_porsi',
                'waste_type',
                'loss_amount',
                'affects_mitra_settlement',
            ]);
        });
    }
};
