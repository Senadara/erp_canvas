<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'hpp_mode')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('hpp_mode', 16)->default('AUTO');
            });
        }

        DB::table('products')
            ->whereNull('hpp_mode')
            ->orWhere('hpp_mode', '')
            ->update(['hpp_mode' => 'AUTO']);
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'hpp_mode')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('hpp_mode');
            });
        }
    }
};
