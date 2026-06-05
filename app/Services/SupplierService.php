<?php

namespace App\Services;

use App\Models\Supplier;

class SupplierService
{
    public function listSuppliers()
    {
        return Supplier::withCount('stockItems')
            ->orderBy('name')
            ->get();
    }

    public function upsertSupplier(array $data)
    {
        if (!empty($data['id'])) {
            $supplier = Supplier::findOrFail($data['id']);
            $supplier->update([
                'name' => $data['name'],
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
            ]);
            return $supplier;
        }

        return Supplier::create([
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
        ]);
    }

    public function deleteSupplier(string $id)
    {
        $supplier = Supplier::findOrFail($id);
        return $supplier->delete();
    }
}
