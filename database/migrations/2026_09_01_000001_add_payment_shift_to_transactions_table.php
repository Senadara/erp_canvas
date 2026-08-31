<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('transactions', 'payment_shift_id')) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) {
            $table->string('payment_shift_id', 36)->nullable()->after('shift_id');
            $table->foreign('payment_shift_id', 'transactions_payment_shift_id_fk')->references('id')->on('shift_records')->nullOnDelete();
            $table->index(['outlet_id', 'payment_shift_id', 'paid_at'], 'transactions_payment_shift_idx');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('transactions', 'payment_shift_id')) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign('transactions_payment_shift_id_fk');
            $table->dropIndex('transactions_payment_shift_idx');
            $table->dropColumn('payment_shift_id');
        });
    }
};
