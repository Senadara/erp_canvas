<?php

namespace App\Http\Controllers;

use App\Services\MitraStockDeliveryService;
use Illuminate\Http\Request;

class MitraStockDeliveryController extends Controller
{
    public function __construct(private MitraStockDeliveryService $deliveryService) {}

    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless($user?->isMitra(), 403, 'Hanya mitra yang dapat mencatat pengiriman.');

        $data = $request->validate([
            'stock_item_id' => ['required', 'string', 'max:36'],
            'qty_sent' => ['required', 'numeric', 'min:0.0001'],
            'sender_note' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $this->deliveryService->create(
                $user,
                (string) $request->session()->get('outlet_id'),
                $data['stock_item_id'],
                (float) $data['qty_sent'],
                $data['sender_note'] ?? null,
            );
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['delivery' => $exception->getMessage()]);
        }

        return back()->with('success', 'Pengiriman stok berhasil dicatat dan menunggu pemeriksaan outlet.');
    }

    public function receive(Request $request, string $id)
    {
        $user = $request->user();
        abort_if(! $user || $user->isMitra(), 403, 'Hanya petugas outlet yang dapat memeriksa pengiriman.');

        $data = $request->validate([
            'qty_received' => ['required', 'numeric', 'min:0'],
            'receiver_note' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $delivery = $this->deliveryService->receive(
                $id,
                (string) $request->session()->get('outlet_id'),
                $user,
                (float) $data['qty_received'],
                $data['receiver_note'] ?? null,
            );
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['delivery' => $exception->getMessage()]);
        }

        $message = $delivery->status === \App\Models\MitraStockDelivery::STATUS_RECEIVED_MATCH
            ? 'Pengiriman diterima. Jumlah sesuai dengan catatan mitra.'
            : 'Pengiriman diterima dengan selisih jumlah yang tercatat.';

        return back()->with('success', $message);
    }
}
