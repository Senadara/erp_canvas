<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mitra_stock_deliveries', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('outlet_id', 36);
            $table->string('mitra_id', 36);
            $table->string('stock_item_id', 36);
            $table->decimal('qty_sent', 18, 4);
            $table->decimal('qty_received', 18, 4)->nullable();
            $table->string('status')->default('SENT');
            $table->string('sender_note')->nullable();
            $table->string('receiver_note')->nullable();
            $table->timestamp('sent_at');
            $table->timestamp('received_at')->nullable();
            $table->string('received_by', 36)->nullable();
            $table->string('restock_log_id', 36)->nullable();
            $table->timestamps();

            $table->foreign('outlet_id')->references('id')->on('outlets')->cascadeOnDelete();
            $table->foreign('mitra_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('stock_item_id')->references('id')->on('stock_items');
            $table->foreign('received_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['outlet_id', 'status', 'sent_at']);
            $table->index(['mitra_id', 'outlet_id', 'sent_at']);
        });

        Schema::table('mitra_settlements', function (Blueprint $table) {
            $table->timestamp('validated_at')->nullable()->after('status');
            $table->string('validated_by', 36)->nullable()->after('validated_at');
            $table->string('validation_note')->nullable()->after('validated_by');
            $table->timestamp('paid_at')->nullable()->after('validation_note');
            $table->string('paid_by', 36)->nullable()->after('paid_at');

            $table->foreign('validated_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('paid_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('mitra_settlements', function (Blueprint $table) {
            $table->dropForeign(['validated_by']);
            $table->dropForeign(['paid_by']);
            $table->dropColumn([
                'validated_at',
                'validated_by',
                'validation_note',
                'paid_at',
                'paid_by',
            ]);
        });

        Schema::dropIfExists('mitra_stock_deliveries');
    }
};
