<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_items', 'cost_category')) {
                $table->string('cost_category', 32)->default('MATERIAL');
            }
        });

        DB::table('stock_items')
            ->whereNull('cost_category')
            ->orWhere('cost_category', '')
            ->update(['cost_category' => 'MATERIAL']);

        Schema::table('transaction_items', function (Blueprint $table) {
            if (! Schema::hasColumn('transaction_items', 'hpp_per_porsi')) {
                $table->decimal('hpp_per_porsi', 18, 4)->nullable();
            }
            if (! Schema::hasColumn('transaction_items', 'hpp_total')) {
                $table->decimal('hpp_total', 18, 4)->nullable();
            }
            if (! Schema::hasColumn('transaction_items', 'hpp_source')) {
                $table->string('hpp_source', 32)->nullable();
            }
            if (! Schema::hasColumn('transaction_items', 'hpp_snapshot')) {
                $table->json('hpp_snapshot')->nullable();
            }
        });

        $this->backfillLegacyTransactionHpp();
    }

    private function backfillLegacyTransactionHpp(): void
    {
        DB::table('transaction_items')
            ->whereNull('hpp_source')
            ->chunkById(500, function ($items): void {
                $products = DB::table('products')
                    ->whereIn('id', $items->pluck('product_id')->filter()->unique()->values())
                    ->get(['id', 'name', 'hpp'])
                    ->keyBy('id');

                foreach ($items as $item) {
                    $product = $products->get($item->product_id);
                    $manualHpp = (float) ($product->hpp ?? 0);
                    $quantity = (float) ($item->qty_porsi ?? 0);

                    DB::table('transaction_items')
                        ->where('id', $item->id)
                        ->update([
                            'hpp_per_porsi' => $manualHpp,
                            'hpp_total' => $manualHpp * $quantity,
                            'hpp_source' => 'LEGACY_MANUAL',
                            'hpp_snapshot' => json_encode([
                                'source' => 'LEGACY_MANUAL',
                                'product_id' => $item->product_id,
                                'product_name' => $product->name ?? $item->product_name,
                                'manual_hpp' => $manualHpp,
                                'quantity' => $quantity,
                                'components' => [],
                            ]),
                        ]);
                }
            }, 'id');
    }

    public function down(): void
    {
        Schema::table('transaction_items', function (Blueprint $table) {
            foreach (['hpp_per_porsi', 'hpp_total', 'hpp_source', 'hpp_snapshot'] as $column) {
                if (Schema::hasColumn('transaction_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('stock_items', function (Blueprint $table) {
            if (Schema::hasColumn('stock_items', 'cost_category')) {
                $table->dropColumn('cost_category');
            }
        });
    }
};
