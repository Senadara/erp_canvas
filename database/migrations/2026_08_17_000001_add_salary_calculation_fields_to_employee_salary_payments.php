<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employee_salary_payments')) {
            return;
        }

        Schema::table('employee_salary_payments', function (Blueprint $table) {
            if (! Schema::hasColumn('employee_salary_payments', 'salary_type')) {
                $table->string('salary_type', 16)->default('MONTHLY');
            }

            if (! Schema::hasColumn('employee_salary_payments', 'daily_rate')) {
                $table->decimal('daily_rate', 18, 4)->default(0);
            }

            if (! Schema::hasColumn('employee_salary_payments', 'payable_days')) {
                $table->unsignedInteger('payable_days')->default(0);
            }

            if (! Schema::hasColumn('employee_salary_payments', 'monthly_amount')) {
                $table->decimal('monthly_amount', 18, 4)->default(0);
            }
        });

        DB::table('employee_salary_payments')
            ->where('monthly_amount', 0)
            ->update([
                'salary_type' => 'MONTHLY',
                'monthly_amount' => DB::raw('base_amount'),
                'payable_days' => DB::raw('work_days'),
            ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('employee_salary_payments')) {
            return;
        }

        Schema::table('employee_salary_payments', function (Blueprint $table) {
            foreach (['salary_type', 'daily_rate', 'payable_days', 'monthly_amount'] as $column) {
                if (Schema::hasColumn('employee_salary_payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
