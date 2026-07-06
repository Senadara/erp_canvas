<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\StockItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ConversionOutletResolver
{
    public function repairForListing(Conversion $conversion, string $outletId): ?Conversion
    {
        return $this->resolve($conversion, $outletId, null, false);
    }

    public function resolveForSale(Conversion $conversion, string $outletId, string $productName): ?Conversion
    {
        return $this->resolve($conversion, $outletId, $productName, true);
    }

    private function resolve(Conversion $conversion, string $outletId, ?string $productName, bool $failWhenUnresolved): ?Conversion
    {
        $stockItem = $conversion->stockItem;

        if (! $stockItem) {
            if ($failWhenUnresolved) {
                throw new \Exception("Konversi produk {$productName} memiliki bahan yang tidak ditemukan.");
            }

            return null;
        }

        if ($stockItem->outlet_id === $outletId) {
            return $conversion;
        }

        $replacement = $this->findMatchingStockItem($stockItem, $outletId);

        if (! $replacement) {
            if ($failWhenUnresolved) {
                throw new \Exception("Konversi produk {$productName} belum punya bahan stok \"{$stockItem->name}\" di outlet ini.");
            }

            return null;
        }

        $duplicate = Conversion::query()
            ->where('product_id', $conversion->product_id)
            ->where('stock_item_id', $replacement->id)
            ->where('id', '<>', $conversion->id)
            ->first();

        if ($duplicate) {
            $conversion->delete();

            return null;
        }

        $conversion->stock_item_id = $replacement->id;
        $conversion->save();
        $conversion->setRelation('stockItem', $replacement);

        return $conversion;
    }

    private function findMatchingStockItem(StockItem $source, string $outletId): ?StockItem
    {
        $normalizedName = Str::lower(trim($source->name));

        $matches = StockItem::query()
            ->where('outlet_id', $outletId)
            ->whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName])
            ->get();

        if ($matches->count() === 1) {
            return $matches->first();
        }

        $strictMatches = $matches->filter(function (StockItem $candidate) use ($source) {
            return $candidate->unit_name === $source->unit_name
                && $candidate->counting_basis === $source->counting_basis;
        });

        return $this->singleOrNull($strictMatches);
    }

    private function singleOrNull(Collection $matches): ?StockItem
    {
        return $matches->count() === 1 ? $matches->first() : null;
    }
}
