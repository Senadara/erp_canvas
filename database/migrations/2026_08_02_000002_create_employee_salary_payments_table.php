<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('employee_salary_payments')) {
            $this->ensureIndexes();

            return;
        }

        Schema::create('employee_salary_payments', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('employee_id', 36)->nullable();
            $table->string('employee_name');
            $table->timestamp('period_start');
            $table->timestamp('period_end');
            $table->unsignedInteger('work_days')->default(0);
            $table->unsignedInteger('shift_count')->default(0);
            $table->unsignedInteger('total_minutes')->default(0);
            $table->unsignedInteger('average_minutes')->default(0);
            $table->unsignedInteger('longest_shift_minutes')->default(0);
            $table->unsignedInteger('shortest_shift_minutes')->default(0);
            $table->decimal('base_amount', 18, 4)->default(0);
            $table->decimal('bonus_amount', 18, 4)->default(0);
            $table->decimal('deduction_amount', 18, 4)->default(0);
            $table->decimal('total_amount', 18, 4)->default(0);
            $table->text('note')->nullable();
            $table->json('shift_snapshot')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('paid_by', 36)->nullable();
            $table->timestamps();

            $table->foreign('employee_id', 'esp_employee_fk')->references('id')->on('users')->nullOnDelete();
            $table->foreign('paid_by', 'esp_paid_by_fk')->references('id')->on('users')->nullOnDelete();
            $table->index(['employee_id', 'period_start', 'period_end'], 'esp_emp_period_idx');
            $table->index(['paid_at'], 'esp_paid_at_idx');
        });
    }

    private function ensureIndexes(): void
    {
        Schema::table('employee_salary_payments', function (Blueprint $table) {
            if (! Schema::hasIndex('employee_salary_payments', 'esp_emp_period_idx')) {
                $table->index(['employee_id', 'period_start', 'period_end'], 'esp_emp_period_idx');
            }

            if (! Schema::hasIndex('employee_salary_payments', 'esp_paid_at_idx')) {
                $table->index(['paid_at'], 'esp_paid_at_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_salary_payments');
    }
};
