<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shift_records', function (Blueprint $table) {
            if (! Schema::hasColumn('shift_records', 'opened_by')) {
                $table->string('opened_by', 36)->nullable()->after('name');
                $table->foreign('opened_by')->references('id')->on('users')->nullOnDelete();
            }

            if (! Schema::hasColumn('shift_records', 'closed_by')) {
                $table->string('closed_by', 36)->nullable()->after('opened_by');
                $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('shift_records', function (Blueprint $table) {
            if (Schema::hasColumn('shift_records', 'opened_by')) {
                $table->dropForeign(['opened_by']);
                $table->dropColumn('opened_by');
            }

            if (Schema::hasColumn('shift_records', 'closed_by')) {
                $table->dropForeign(['closed_by']);
                $table->dropColumn('closed_by');
            }
        });
    }
};
