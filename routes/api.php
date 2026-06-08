<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', fn () => response()->json(['ok' => true, 'time' => now()->toIso8601String()]));

    // Sync status (no auth required for PWA health check)
    Route::get('/sync/status', fn () => response()->json([
        'ok' => true,
        'serverTime' => now()->toIso8601String(),
        'version' => config('app.version', '1.0.0'),
    ]));

    Route::middleware('auth:sanctum')->group(function () {
        // Catalog sync — PWA downloads product list + prices for offline use
        Route::get('/sync/catalog', function (Request $request) {
            $outletId = $request->header('X-Outlet-Id') ?? $request->query('outlet_id');
            if (! $outletId) {
                return response()->json(['error' => 'Outlet required'], 400);
            }

            $products = \App\Models\Product::query()
                ->where('outlet_id', $outletId)
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'category', 'price', 'image_url']);

            $stockItems = \App\Models\StockItem::query()
                ->where('outlet_id', $outletId)
                ->where('trackable', true)
                ->get(['id', 'name', 'current_stock_biji', 'unit_name']);

            $etag = md5(json_encode($products) . json_encode($stockItems));

            if ($request->header('If-None-Match') === $etag) {
                return response()->json(null, 304);
            }

            return response()->json([
                'outletId' => $outletId,
                'products' => $products,
                'stockItems' => $stockItems,
                'cachedAt' => now()->toIso8601String(),
            ])->header('ETag', $etag);
        });

        // Batch sync sales from offline queue (IndexedDB → server)
        Route::post('/sync/sales', function (Request $request) {
            $outletId = $request->header('X-Outlet-Id') ?? $request->input('outlet_id');
            if (! $outletId) {
                return response()->json(['error' => 'Outlet required'], 400);
            }

            $pendingSales = $request->input('sales', []);
            if (empty($pendingSales)) {
                return response()->json(['queued' => 0, 'message' => 'Tidak ada penjualan untuk disinkronkan.']);
            }

            $transactionService = app(\App\Services\TransactionService::class);
            $results = [];
            $errors = [];

            foreach ($pendingSales as $idx => $sale) {
                try {
                    $sale['outlet_id'] = $outletId;
                    $transaction = $transactionService->processSale($sale);
                    $results[] = [
                        'localId' => $sale['local_id'] ?? $idx,
                        'serverId' => $transaction->id,
                        'invoiceNumber' => $transaction->invoice_number,
                        'status' => 'ok',
                    ];
                } catch (\Exception $e) {
                    $errors[] = [
                        'localId' => $sale['local_id'] ?? $idx,
                        'error' => $e->getMessage(),
                        'status' => 'failed',
                    ];
                }
            }

            return response()->json([
                'queued' => count($results),
                'failed' => count($errors),
                'results' => $results,
                'errors' => $errors,
                'syncedAt' => now()->toIso8601String(),
            ]);
        })->middleware('web');
    });
});
