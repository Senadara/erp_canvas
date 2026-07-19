<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('name');
            $table->string('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('warehouse_stock_items', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('warehouse_id', 36);
            $table->string('mitra_id', 36);
            $table->string('name');
            $table->string('normalized_name');
            $table->string('unit_name')->default('biji');
            $table->decimal('current_stock', 18, 4)->default(0);
            $table->decimal('min_stock_alert', 18, 4)->default(0);
            $table->decimal('min_restock_qty', 18, 4)->default(1);
            $table->decimal('restock_price', 18, 4)->default(0);
            $table->timestamps();

            $table->foreign('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();
            $table->foreign('mitra_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(
                ['warehouse_id', 'mitra_id', 'normalized_name', 'unit_name'],
                'warehouse_stock_identity_unique'
            );
            $table->index(['mitra_id', 'warehouse_id']);
        });

        Schema::table('stock_items', function (Blueprint $table) {
            $table->string('warehouse_stock_item_id', 36)->nullable()->after('outlet_id');
            $table->foreign('warehouse_stock_item_id')
                ->references('id')
                ->on('warehouse_stock_items')
                ->nullOnDelete();
            $table->index('warehouse_stock_item_id');
        });

        Schema::table('mitra_stock_deliveries', function (Blueprint $table) {
            $table->string('warehouse_id', 36)->nullable()->after('id');
            $table->string('warehouse_stock_item_id', 36)->nullable()->after('warehouse_id');
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->nullOnDelete();
            $table->foreign('warehouse_stock_item_id')
                ->references('id')
                ->on('warehouse_stock_items')
                ->nullOnDelete();
            $table->index(['warehouse_id', 'status', 'sent_at'], 'warehouse_delivery_status_index');
        });

        Schema::create('warehouse_stock_transfers', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('warehouse_id', 36);
            $table->string('warehouse_stock_item_id', 36);
            $table->string('outlet_id', 36);
            $table->string('stock_item_id', 36);
            $table->decimal('quantity', 18, 4);
            $table->decimal('warehouse_stock_before', 18, 4);
            $table->decimal('warehouse_stock_after', 18, 4);
            $table->decimal('outlet_stock_before', 18, 4);
            $table->decimal('outlet_stock_after', 18, 4);
            $table->string('note')->nullable();
            $table->string('transferred_by', 36)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('warehouse_id')->references('id')->on('warehouses');
            $table->foreign('warehouse_stock_item_id')->references('id')->on('warehouse_stock_items');
            $table->foreign('outlet_id')->references('id')->on('outlets');
            $table->foreign('stock_item_id')->references('id')->on('stock_items');
            $table->foreign('transferred_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['outlet_id', 'created_at']);
            $table->index(['warehouse_stock_item_id', 'created_at'], 'warehouse_transfer_item_date_index');
        });

        $warehouseId = (string) Str::ulid();
        DB::table('warehouses')->insert([
            'id' => $warehouseId,
            'name' => 'Gudang Pusat',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $scopedItems = DB::table('mitra_stock_scopes')
            ->join('stock_items', 'mitra_stock_scopes.stock_item_id', '=', 'stock_items.id')
            ->select([
                'mitra_stock_scopes.user_id as mitra_id',
                'stock_items.id as stock_item_id',
                'stock_items.name',
                'stock_items.unit_name',
                'stock_items.min_stock_alert',
                'stock_items.min_restock_qty',
                'stock_items.restock_price',
            ])
            ->orderBy('stock_items.created_at')
            ->get();
        $warehouseItems = [];

        foreach ($scopedItems as $item) {
            $normalizedName = Str::lower(trim(preg_replace('/\s+/', ' ', $item->name)));
            $key = implode('|', [$item->mitra_id, $normalizedName, Str::lower($item->unit_name)]);

            if (! isset($warehouseItems[$key])) {
                $warehouseStockItemId = (string) Str::ulid();
                $warehouseItems[$key] = $warehouseStockItemId;
                DB::table('warehouse_stock_items')->insert([
                    'id' => $warehouseStockItemId,
                    'warehouse_id' => $warehouseId,
                    'mitra_id' => $item->mitra_id,
                    'name' => $item->name,
                    'normalized_name' => $normalizedName,
                    'unit_name' => $item->unit_name,
                    'current_stock' => 0,
                    'min_stock_alert' => $item->min_stock_alert,
                    'min_restock_qty' => $item->min_restock_qty,
                    'restock_price' => $item->restock_price,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('stock_items')
                ->where('id', $item->stock_item_id)
                ->update(['warehouse_stock_item_id' => $warehouseItems[$key]]);
        }

        $pendingOrHistoricalDeliveries = DB::table('mitra_stock_deliveries')
            ->whereNotNull('stock_item_id')
            ->get(['id', 'mitra_id', 'stock_item_id']);

        foreach ($pendingOrHistoricalDeliveries as $delivery) {
            $warehouseStockItemId = DB::table('stock_items')
                ->where('id', $delivery->stock_item_id)
                ->value('warehouse_stock_item_id');

            if ($warehouseStockItemId) {
                DB::table('mitra_stock_deliveries')
                    ->where('id', $delivery->id)
                    ->update([
                        'warehouse_id' => $warehouseId,
                        'warehouse_stock_item_id' => $warehouseStockItemId,
                    ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_stock_transfers');

        Schema::table('mitra_stock_deliveries', function (Blueprint $table) {
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['warehouse_stock_item_id']);
            $table->dropIndex('warehouse_delivery_status_index');
            $table->dropColumn(['warehouse_id', 'warehouse_stock_item_id']);
        });

        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropForeign(['warehouse_stock_item_id']);
            $table->dropIndex(['warehouse_stock_item_id']);
            $table->dropColumn('warehouse_stock_item_id');
        });

        Schema::dropIfExists('warehouse_stock_items');
        Schema::dropIfExists('warehouses');
    }
};
