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
        Schema::table('shift_records', function (Blueprint $table) {
            $table->string('name')->nullable()->after('outlet_id');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->string('shift_id', 36)->nullable()->after('outlet_id');
            $table->foreign('shift_id')->references('id')->on('shift_records')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['shift_id']);
            $table->dropColumn('shift_id');
        });

        Schema::table('shift_records', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }
};
