<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\StockItem;
use App\Models\WasteLog;
use App\Services\ConversionOutletResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WasteController extends Controller
{
    public function __construct(private ConversionOutletResolver $conversionOutletResolver) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');

        $wasteLogs = WasteLog::where('outlet_id', $outletId)
            ->with(['stockItem:id,name,unit_name', 'product:id,name'])
            ->orderByDesc('created_at')
            ->take(100)
            ->get();

        $summaryRows = WasteLog::where('outlet_id', $outletId)->get();
        $summaryByType = $summaryRows
            ->groupBy('waste_type')
            ->map(fn ($rows, $type) => [
                'type' => $type,
                'count' => $rows->count(),
                'loss_amount' => (float) $rows->sum('loss_amount'),
            ])
            ->values()
            ->all();

        $stockItems = StockItem::where('outlet_id', $outletId)
            ->where('trackable', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit_name', 'current_stock_biji', 'min_restock_qty', 'restock_price']);

        $products = Product::where('outlet_id', $outletId)
            ->where('is_active', true)
            ->with('conversions.stockItem:id,name,outlet_id,unit_name,current_stock_biji,min_restock_qty,restock_price,trackable,counting_basis')
            ->orderBy('name')
            ->get(['id', 'name', 'hpp']);

        return Inertia::render('Waste/Index', [
            'wasteLogs' => $wasteLogs,
            'stockItems' => $stockItems,
            'products' => $products,
            'summary' => [
                'total_loss' => (float) $summaryRows->sum('loss_amount'),
                'total_count' => $summaryRows->count(),
                'by_type' => $summaryByType,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');

        $data = $request->validate([
            'source_type' => 'required|in:STOCK,PRODUCT',
            'stock_item_id' => 'required_if:source_type,STOCK|nullable|string',
            'product_id' => 'required_if:source_type,PRODUCT|nullable|string',
            'qty_biji' => 'required_if:source_type,STOCK|nullable|numeric|min:0.0001',
            'qty_porsi' => 'required_if:source_type,PRODUCT|nullable|numeric|min:0.0001',
            'waste_type' => 'required|in:EXPIRED,OWNER_REQUEST,DAMAGED,OTHER',
            'reason' => 'required|string',
        ]);

        try {
            if ($data['source_type'] === WasteLog::SOURCE_PRODUCT) {
                $this->recordProductWaste($outletId, $data);

                return redirect()->back()->with('success', 'Waste produk berhasil dicatat dan stok bahan dikurangi.');
            }

            $this->recordStockWaste($outletId, $data);
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }

        return redirect()->back()->with('success', 'Waste berhasil dicatat dan stok dikurangi.');
    }

    private function recordStockWaste(string $outletId, array $data): void
    {
        DB::transaction(function () use ($outletId, $data) {
            $stockItem = StockItem::where('id', $data['stock_item_id'])
                ->where('outlet_id', $outletId)
                ->lockForUpdate()
                ->firstOrFail();

            $qty = (float) $data['qty_biji'];
            if ($stockItem->current_stock_biji < $qty) {
                throw new \InvalidArgumentException("Stok tidak cukup. Tersisa: {$stockItem->current_stock_biji}");
            }

            WasteLog::create([
                'outlet_id' => $outletId,
                'stock_item_id' => $stockItem->id,
                'source_type' => WasteLog::SOURCE_STOCK,
                'qty_biji' => $qty,
                'reason' => $data['reason'],
                'waste_type' => $data['waste_type'],
                'loss_amount' => $this->stockLossAmount($stockItem, $qty),
                'affects_mitra_settlement' => true,
                'created_at' => now(),
            ]);

            $stockItem->decrement('current_stock_biji', $qty);
        });
    }

    private function recordProductWaste(string $outletId, array $data): void
    {
        DB::transaction(function () use ($outletId, $data) {
            $product = Product::where('id', $data['product_id'])
                ->where('outlet_id', $outletId)
                ->with('conversions.stockItem')
                ->firstOrFail();

            $qtyPorsi = (float) $data['qty_porsi'];
            if ($product->conversions->isEmpty()) {
                throw new \InvalidArgumentException("Produk {$product->name} belum memiliki konversi bahan.");
            }

            $rows = [];
            foreach ($product->conversions as $conversion) {
                $conversion = $this->conversionOutletResolver->resolveForSale($conversion, $outletId, $product->name);
                if (! $conversion || ! $conversion->stockItem) {
                    continue;
                }

                $stockItem = StockItem::where('id', $conversion->stock_item_id)
                    ->where('outlet_id', $outletId)
                    ->lockForUpdate()
                    ->firstOrFail();
                $qtyBiji = $qtyPorsi * (float) $conversion->ratio;

                if ($stockItem->trackable && $stockItem->current_stock_biji < $qtyBiji) {
                    throw new \InvalidArgumentException("Stok {$stockItem->name} tidak cukup. Tersisa: {$stockItem->current_stock_biji}");
                }

                $rows[] = [$stockItem, $qtyBiji];
            }

            if (empty($rows)) {
                throw new \InvalidArgumentException("Produk {$product->name} belum memiliki bahan stok yang valid.");
            }

            foreach ($rows as [$stockItem, $qtyBiji]) {
                WasteLog::create([
                    'outlet_id' => $outletId,
                    'stock_item_id' => $stockItem->id,
                    'source_type' => WasteLog::SOURCE_PRODUCT,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'qty_biji' => $qtyBiji,
                    'qty_porsi' => $qtyPorsi,
                    'reason' => $data['reason'],
                    'waste_type' => $data['waste_type'],
                    'loss_amount' => $this->stockLossAmount($stockItem, $qtyBiji),
                    'affects_mitra_settlement' => true,
                    'created_at' => now(),
                ]);

                if ($stockItem->trackable) {
                    $stockItem->decrement('current_stock_biji', $qtyBiji);
                }
            }
        });
    }

    private function stockLossAmount(StockItem $stockItem, float $qty): float
    {
        $minQty = (float) $stockItem->min_restock_qty;
        $price = (float) $stockItem->restock_price;

        if ($minQty <= 0 || $price <= 0) {
            return 0;
        }

        return ($qty / $minQty) * $price;
    }
}
