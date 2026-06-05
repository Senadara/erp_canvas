<?php

namespace App\Services;

use App\Models\DisplayGroup;
use App\Models\Product;
use App\Models\StockItem;

class DisplayGroupService
{
    public function listDisplayGroups(string $context, string $outletId)
    {
        return DisplayGroup::where('context', $context)
            ->where('outlet_id', $outletId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    public function createDisplayGroup(array $data)
    {
        return DisplayGroup::create([
            'name' => $data['name'],
            'context' => $data['context'],
            'outlet_id' => $data['outlet_id'],
            'sort_order' => $data['sort_order'] ?? 0,
        ]);
    }

    public function renameDisplayGroup(string $id, string $name)
    {
        $g = DisplayGroup::findOrFail($id);
        $g->update(['name' => $name]);
        return $g;
    }

    public function deleteDisplayGroup(string $id)
    {
        $g = DisplayGroup::findOrFail($id);
        Product::where('display_group_id', $id)->update(['display_group_id' => null]);
        StockItem::where('display_group_id', $id)->update(['display_group_id' => null]);
        return $g->delete();
    }
}
