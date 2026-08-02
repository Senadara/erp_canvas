<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'supplier_id')) {
                $table->string('supplier_id', 36)->nullable()->after('role');
                $table->foreign('supplier_id')->references('id')->on('suppliers')->nullOnDelete();
                $table->index(['role', 'supplier_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'supplier_id')) {
                $table->dropForeign(['supplier_id']);
                $table->dropIndex(['role', 'supplier_id']);
                $table->dropColumn('supplier_id');
            }
        });
    }
};
