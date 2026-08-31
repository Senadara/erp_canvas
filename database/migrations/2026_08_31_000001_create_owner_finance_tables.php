<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('partner_profiles')) {
            Schema::create('partner_profiles', function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('user_id', 36)->unique();
                $table->decimal('default_salary', 18, 4)->default(0);
                $table->boolean('is_active')->default(true);
                $table->text('note')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('partner_capital_loans')) {
            Schema::create('partner_capital_loans', function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('borrower_user_id', 36);
                $table->string('lender_user_id', 36);
                $table->string('investment_id', 36)->nullable();
                $table->decimal('principal_amount', 18, 4)->default(0);
                $table->decimal('remaining_amount', 18, 4)->default(0);
                $table->string('status', 16)->default('ACTIVE');
                $table->text('note')->nullable();
                $table->string('created_by', 36)->nullable();
                $table->timestamps();

                $table->foreign('borrower_user_id', 'pcl_borrower_fk')->references('id')->on('users')->cascadeOnDelete();
                $table->foreign('lender_user_id', 'pcl_lender_fk')->references('id')->on('users')->cascadeOnDelete();
                $table->foreign('investment_id', 'pcl_investment_fk')->references('id')->on('investments')->nullOnDelete();
                $table->foreign('created_by', 'pcl_created_by_fk')->references('id')->on('users')->nullOnDelete();
                $table->index(['borrower_user_id', 'status'], 'pcl_borrower_status_idx');
                $table->index(['lender_user_id', 'status'], 'pcl_lender_status_idx');
            });
        }

        if (! Schema::hasTable('owner_finance_batches')) {
            Schema::create('owner_finance_batches', function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('outlet_id', 36);
                $table->timestamp('period_start');
                $table->timestamp('period_end');
                $table->string('status', 16)->default('DRAFT');
                $table->string('payout_method', 16)->default('CASH');
                $table->decimal('total_salary', 18, 4)->default(0);
                $table->decimal('total_dividend', 18, 4)->default(0);
                $table->decimal('total_loan_repayment', 18, 4)->default(0);
                $table->decimal('total_payout', 18, 4)->default(0);
                $table->decimal('retained_amount', 18, 4)->default(0);
                $table->json('summary_snapshot')->nullable();
                $table->text('note')->nullable();
                $table->string('created_by', 36)->nullable();
                $table->string('posted_by', 36)->nullable();
                $table->timestamp('posted_at')->nullable();
                $table->timestamps();

                $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
                $table->foreign('created_by', 'ofb_created_by_fk')->references('id')->on('users')->nullOnDelete();
                $table->foreign('posted_by', 'ofb_posted_by_fk')->references('id')->on('users')->nullOnDelete();
                $table->index(['outlet_id', 'period_start', 'period_end'], 'ofb_outlet_period_idx');
                $table->index(['status', 'posted_at'], 'ofb_status_posted_idx');
            });
        }

        if (! Schema::hasTable('owner_finance_items')) {
            Schema::create('owner_finance_items', function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('owner_finance_batch_id', 36);
                $table->string('source_user_id', 36)->nullable();
                $table->string('recipient_user_id', 36)->nullable();
                $table->string('partner_capital_loan_id', 36)->nullable();
                $table->string('petty_cash_id', 36)->nullable();
                $table->string('type', 32);
                $table->string('payment_method', 16)->default('CASH');
                $table->decimal('amount', 18, 4)->default(0);
                $table->text('note')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();

                $table->foreign('owner_finance_batch_id', 'ofi_batch_fk')->references('id')->on('owner_finance_batches')->cascadeOnDelete();
                $table->foreign('source_user_id', 'ofi_source_user_fk')->references('id')->on('users')->nullOnDelete();
                $table->foreign('recipient_user_id', 'ofi_recipient_user_fk')->references('id')->on('users')->nullOnDelete();
                $table->foreign('partner_capital_loan_id', 'ofi_loan_fk')->references('id')->on('partner_capital_loans')->nullOnDelete();
                $table->foreign('petty_cash_id', 'ofi_petty_cash_fk')->references('id')->on('petty_cash')->nullOnDelete();
                $table->index(['recipient_user_id', 'type'], 'ofi_recipient_type_idx');
                $table->index(['type', 'payment_method'], 'ofi_type_method_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_finance_items');
        Schema::dropIfExists('owner_finance_batches');
        Schema::dropIfExists('partner_capital_loans');
        Schema::dropIfExists('partner_profiles');
    }
};
