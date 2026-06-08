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
        Schema::create('investments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('outlet_id')->constrained('outlets')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->integer('lots')->default(0);
            $table->decimal('lot_value', 15, 4);
            $table->decimal('total_value', 15, 4);
            $table->string('status')->default('PENDING'); // PENDING, APPROVED, REJECTED
            $table->string('note')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investments');
    }
};
