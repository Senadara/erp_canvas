<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outlets', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('name');
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->timestamps();
        });

        Schema::create('user_outlets', function (Blueprint $table) {
            $table->string('user_id', 36);
            $table->string('outlet_id', 36);
            $table->primary(['user_id', 'outlet_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
        });

        Schema::create('user_activity_logs', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('user_id', 36);
            $table->string('action');
            $table->string('description')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('display_groups', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('name');
            $table->integer('sort_order')->default(0);
            $table->string('context', 16); // PRODUCT, STOCK
            $table->string('outlet_id', 36)->nullable();
            $table->timestamps();
            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            $table->index(['context', 'outlet_id']);
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_items', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('name');
            $table->decimal('current_stock_biji', 18, 4)->default(0);
            $table->string('unit_name')->default('biji');
            $table->decimal('min_stock_alert', 18, 4)->default(0);
            $table->string('supplier_id', 36)->nullable();
            $table->boolean('trackable')->default(true);
            $table->string('counting_basis')->default('BIJI');
            $table->string('display_group_id', 36)->nullable();
            $table->timestamps();
            $table->foreign('outlet_id')->references('id')->on('outlets');
            $table->foreign('supplier_id')->references('id')->on('suppliers')->nullOnDelete();
            $table->foreign('display_group_id')->references('id')->on('display_groups')->nullOnDelete();
        });

        Schema::create('restock_logs', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('stock_item_id', 36);
            $table->decimal('qty_added', 18, 4);
            $table->decimal('stock_before', 18, 4);
            $table->decimal('stock_after', 18, 4);
            $table->string('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('outlet_id')->references('id')->on('outlets');
            $table->foreign('stock_item_id')->references('id')->on('stock_items');
            $table->index(['outlet_id', 'created_at']);
            $table->index(['stock_item_id', 'created_at']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('name');
            $table->string('category');
            $table->decimal('price', 18, 4);
            $table->decimal('hpp', 18, 4)->default(0);
            $table->string('image_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('display_group_id', 36)->nullable();
            $table->timestamps();
            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            $table->foreign('display_group_id')->references('id')->on('display_groups')->nullOnDelete();
            $table->index('outlet_id');
        });

        Schema::create('conversions', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('product_id', 36);
            $table->string('stock_item_id', 36);
            $table->decimal('ratio', 18, 4);
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('stock_item_id')->references('id')->on('stock_items')->cascadeOnDelete();
            $table->unique(['product_id', 'stock_item_id']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('invoice_number')->unique();
            $table->decimal('total_amount', 18, 4);
            $table->string('payment_method')->nullable();
            $table->decimal('cash_received', 18, 4)->nullable();
            $table->decimal('change_amount', 18, 4)->nullable();
            $table->string('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->string('payment_status')->default('PAID');
            $table->timestamp('paid_at')->nullable();
            $table->foreign('outlet_id')->references('id')->on('outlets');
            $table->index(['outlet_id', 'payment_status', 'created_at']);
        });

        Schema::create('transaction_items', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('transaction_id', 36);
            $table->string('product_id', 36);
            $table->string('product_name');
            $table->integer('qty_porsi');
            $table->decimal('price_per_porsi', 18, 4);
            $table->decimal('subtotal', 18, 4);
            $table->string('note')->nullable();
            $table->foreign('transaction_id')->references('id')->on('transactions')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products');
        });

        Schema::create('petty_cash', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->decimal('amount', 18, 4);
            $table->string('category');
            $table->string('description')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('outlet_id')->references('id')->on('outlets');
        });

        Schema::create('waste_logs', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('stock_item_id', 36);
            $table->decimal('qty_biji', 18, 4);
            $table->string('reason');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('outlet_id')->references('id')->on('outlets');
            $table->foreign('stock_item_id')->references('id')->on('stock_items');
        });

        Schema::create('shift_records', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('closed_at')->nullable();
            $table->decimal('opening_cash', 18, 4);
            $table->decimal('expected_cash', 18, 4)->nullable();
            $table->decimal('actual_cash', 18, 4)->nullable();
            $table->decimal('discrepancy', 18, 4)->nullable();
            $table->decimal('total_sales_cash', 18, 4)->nullable();
            $table->decimal('total_sales_qris', 18, 4)->nullable();
            $table->decimal('total_expenses', 18, 4)->nullable();
            $table->string('note')->nullable();
            $table->string('status')->default('OPEN');
            $table->foreign('outlet_id')->references('id')->on('outlets');
        });

        Schema::create('mitra_product_scopes', function (Blueprint $table) {
            $table->string('user_id', 36);
            $table->string('product_id', 36);
            $table->primary(['user_id', 'product_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        Schema::create('mitra_stock_scopes', function (Blueprint $table) {
            $table->string('user_id', 36);
            $table->string('stock_item_id', 36);
            $table->primary(['user_id', 'stock_item_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('stock_item_id')->references('id')->on('stock_items')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mitra_stock_scopes');
        Schema::dropIfExists('mitra_product_scopes');
        Schema::dropIfExists('shift_records');
        Schema::dropIfExists('waste_logs');
        Schema::dropIfExists('petty_cash');
        Schema::dropIfExists('transaction_items');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('conversions');
        Schema::dropIfExists('products');
        Schema::dropIfExists('restock_logs');
        Schema::dropIfExists('stock_items');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('display_groups');
        Schema::dropIfExists('user_activity_logs');
        Schema::dropIfExists('user_outlets');
        Schema::dropIfExists('outlets');
    }
};
