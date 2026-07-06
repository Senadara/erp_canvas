<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restock_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('restock_logs', 'fund_source')) {
                $table->string('fund_source', 32)->default('CASHIER_CASH')->after('note');
            }
            if (! Schema::hasColumn('restock_logs', 'restock_cost')) {
                $table->decimal('restock_cost', 18, 4)->default(0)->after('fund_source');
            }
            if (! Schema::hasColumn('restock_logs', 'petty_cash_id')) {
                $table->string('petty_cash_id', 36)->nullable()->after('restock_cost');
            }
        });
    }

    public function down(): void
    {
        Schema::table('restock_logs', function (Blueprint $table) {
            $table->dropColumn(['fund_source', 'restock_cost', 'petty_cash_id']);
        });
    }
};
