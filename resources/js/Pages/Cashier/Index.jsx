import { useState, useEffect } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { enqueueSale, isOnline, onConnectivityChange } from '@/pwa/offlineQueue';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function CashierIndex({ openShift, products, shiftTransactions = [], unpaidTransactions = [] }) {
    const [cart, setCart] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [paymentStatus, setPaymentStatus] = useState('PAID');
    const [cashReceived, setCashReceived] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [processing, setProcessing] = useState(false);
    const [receiptTransaction, setReceiptTransaction] = useState(null);
    const [isOffline, setIsOffline] = useState(!isOnline());
    const [localTransactions, setLocalTransactions] = useState([]);

    // Mobile Cart State
    const [isCartVisible, setIsCartVisible] = useState(false);
    const [bluetoothDevice, setBluetoothDevice] = useState(null);

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    // Checkout Modal State
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyTab, setHistoryTab] = useState('UNPAID');
    const [selectedUnpaidTx, setSelectedUnpaidTx] = useState(null);
    const [payDebtMethod, setPayDebtMethod] = useState('CASH');
    const [payDebtCash, setPayDebtCash] = useState('');
    const [debtProcessing, setDebtProcessing] = useState(false);

    const { flash } = usePage().props;

    // Monitor connectivity changes
    useEffect(() => {
        const cleanup = onConnectivityChange((online) => {
            setIsOffline(!online);
        });
        return cleanup;
    }, []);

    useEffect(() => {
        if (flash?.new_transaction) {
            setReceiptTransaction(flash.new_transaction);
            // Otomatis memicu pop-up print setelah render hanya jika PAID
            if (flash.new_transaction.payment_status === 'PAID') {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        }
    }, [flash]);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product_id === product.id);
            if (existing) {
                return prev.map(item => 
                    item.product_id === product.id 
                    ? { ...item, qty_porsi: item.qty_porsi + 1 }
                    : item
                );
            }
            return [...prev, {
                product_id: product.id,
                product_name: product.name,
                price_per_porsi: product.price,
                qty_porsi: 1,
                note: ''
            }];
        });
    };

    const updateQty = (productId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product_id === productId) {
                    const newQty = item.qty_porsi + delta;
                    return newQty > 0 ? { ...item, qty_porsi: newQty } : item;
                }
                return item;
            });
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product_id !== productId));
    };

    const total = cart.reduce((sum, item) => sum + (item.price_per_porsi * item.qty_porsi), 0);

    // Get unique categories from products
    const categories = ['ALL', ...new Set(products.filter(p => p.is_active).map(p => p.category).filter(Boolean))];

    // Filter products based on search and category
    const filteredProducts = products.filter(p => {
        if (!p.is_active) return false;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleSaveOrder = async () => {
        if (processing) return;
        setProcessing(true);

        const salePayload = {
            items: cart,
            payment_status: 'UNPAID',
            payment_method: null,
            cash_received: null,
            note: customerName ? `Customer: ${customerName}` : ''
        };

        // If offline, use offline queue
        if (isOffline) {
            try {
                const localId = await enqueueSale(salePayload);
                const itemsWithSubtotal = cart.map(item => ({
                    ...item,
                    subtotal: item.qty_porsi * item.price_per_porsi
                }));
                const localTx = {
                    id: `local-${localId}`,
                    localId,
                    invoice_number: `OFF-${Date.now()}`,
                    items: itemsWithSubtotal,
                    total_amount: total,
                    payment_status: 'UNPAID',
                    payment_method: null,
                    cash_received: null,
                    change_amount: 0,
                    note: customerName ? `Customer: ${customerName}` : '',
                    created_at: new Date().toISOString(),
                    isOffline: true
                };
                setLocalTransactions(prev => [...prev, localTx]);
                alert('Pesanan disimpan (belum dibayar).');
                setCart([]);
                setCustomerName('');
                setIsCheckoutModalOpen(false);
                setProcessing(false);
                return;
            } catch (error) {
                console.error('Failed to enqueue offline sale:', error);
                alert('Gagal menyimpan pesanan.');
                setProcessing(false);
                return;
            }
        }

        // If online, use normal API call
        router.post(route('cashier.store'), salePayload, {
            onSuccess: () => {
                setCart([]);
                setCustomerName('');
                setIsCheckoutModalOpen(false);
            },
            onFinish: () => setProcessing(false),
        });
    };

    const handlePayNow = () => {
        setIsCheckoutModalOpen(false);
        setIsPaymentModalOpen(true);
        setCashReceived('');
    };

    const handleCheckout = async (e) => {
        e.preventDefault();
        if (processing) return;
        setProcessing(true);

        const salePayload = {
            items: cart,
            payment_status: 'PAID',
            payment_method: paymentMethod,
            cash_received: cashReceived ? Number(cashReceived) : null,
            note: customerName ? `Customer: ${customerName}` : ''
        };

        // If offline, use offline queue
        if (isOffline) {
            try {
                const localId = await enqueueSale(salePayload);
                const itemsWithSubtotal = cart.map(item => ({
                    ...item,
                    subtotal: item.qty_porsi * item.price_per_porsi
                }));
                const localTx = {
                    id: `local-${localId}`,
                    localId,
                    invoice_number: `OFF-${Date.now()}`,
                    items: itemsWithSubtotal,
                    total_amount: total,
                    payment_status: 'PAID',
                    payment_method: paymentMethod,
                    cash_received: cashReceived ? Number(cashReceived) : null,
                    change_amount: cashReceived ? Number(cashReceived) - total : 0,
                    note: customerName ? `Customer: ${customerName}` : '',
                    created_at: new Date().toISOString(),
                    isOffline: true
                };
                setLocalTransactions(prev => [...prev, localTx]);
                setReceiptTransaction(localTx);
                alert('Penjualan disimpan offline. Akan disinkronkan saat online.');
                setCart([]);
                setCashReceived('');
                setCustomerName('');
                setPaymentMethod('CASH');
                setIsPaymentModalOpen(false);
                setProcessing(false);
                return;
            } catch (error) {
                console.error('Failed to enqueue offline sale:', error);
                alert('Gagal menyimpan penjualan offline.');
                setProcessing(false);
                return;
            }
        }

        // If online, use normal API call
        router.post(route('cashier.store'), salePayload, {
            onSuccess: () => {
                setCart([]);
                setCashReceived('');
                setCustomerName('');
                setPaymentMethod('CASH');
                setIsPaymentModalOpen(false);
            },
            onFinish: () => setProcessing(false),
        });
    };

    const handleAddNominal = (amount) => {
        const current = Number(cashReceived) || 0;
        setCashReceived(String(current + amount));
    };

    const handleSetExactAmount = () => {
        setCashReceived(String(total));
    };

    const allUnpaidTransactions = [...unpaidTransactions, ...localTransactions.filter(t => t.payment_status === 'UNPAID')];
    const paidTransactions = [...shiftTransactions.filter(t => t.payment_status === 'PAID'), ...localTransactions.filter(t => t.payment_status === 'PAID')];

    const handlePayDebt = (e) => {
        e.preventDefault();
        if (debtProcessing || !selectedUnpaidTx) return;
        setDebtProcessing(true);

        router.post(route('cashier.pay-debt', selectedUnpaidTx.id), {
            payment_method: payDebtMethod,
            cash_received: payDebtCash ? Number(payDebtCash) : null,
        }, {
            onSuccess: () => {
                setSelectedUnpaidTx(null);
                setIsHistoryModalOpen(false);
                setPayDebtCash('');
            },
            onFinish: () => setDebtProcessing(false)
        });
    };

    const printToBluetooth = async (transaction) => {
        try {
            // Check if Web Bluetooth API is supported
            if (!navigator.bluetooth) {
                alert('Browser Anda tidak mendukung Bluetooth. Gunakan Chrome atau Edge di Android/Desktop.');
                return;
            }

            let device;
            let server;
            let characteristic = null;
            let service = null;

            // Build ESC/POS commands for receipt
            const encoder = new TextEncoder();
            let commands = [];

            // Initialize printer
            commands.push(0x1B, 0x40); // Initialize
            commands.push(0x1B, 0x61, 0x01); // Center align

            // Store name
            const storeName = openShift?.outlet?.name || 'Toko';
            commands.push(...encoder.encode(storeName + '\n'));

            // Store address
            if (openShift?.outlet?.address) {
                commands.push(...encoder.encode(openShift.outlet.address + '\n'));
            }

            // Date and invoice number
            const dateStr = new Date(transaction.created_at).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            commands.push(...encoder.encode(dateStr + '\n'));
            commands.push(...encoder.encode('No: ' + transaction.invoice_number + '\n'));

            // Separator
            commands.push(0x1B, 0x61, 0x00); // Left align
            commands.push(...encoder.encode('--------------------------------\n'));

            // Items
            transaction.items?.forEach(item => {
                const itemLine = `${item.product_name}\n${item.qty_porsi} x ${formatRupiah(item.price_per_porsi)} = ${formatRupiah(item.subtotal)}\n`;
                commands.push(...encoder.encode(itemLine));
            });

            // Separator
            commands.push(...encoder.encode('--------------------------------\n'));

            // Total
            commands.push(0x1B, 0x45, 0x01); // Bold on
            commands.push(...encoder.encode(`TOTAL: ${formatRupiah(transaction.total_amount)}\n`));
            commands.push(0x1B, 0x45, 0x00); // Bold off

            // Payment method
            if (transaction.payment_method === 'CASH' && transaction.cash_received) {
                commands.push(...encoder.encode(`Tunai: ${formatRupiah(transaction.cash_received)}\n`));
                commands.push(...encoder.encode(`Kembali: ${formatRupiah(transaction.change_amount)}\n`));
            } else if (transaction.payment_method === 'QRIS') {
                commands.push(...encoder.encode('Dibayar dengan: QRIS\n'));
            }

            // Payment status
            if (transaction.payment_status === 'UNPAID') {
                commands.push(...encoder.encode('STATUS: BELUM BAYAR (UTANG)\n'));
            }

            // Note
            if (transaction.note) {
                commands.push(...encoder.encode(`Catatan: ${transaction.note}\n`));
            }

            // Footer
            commands.push(0x1B, 0x61, 0x01); // Center align
            commands.push(...encoder.encode('\nTerima Kasih Atas Kunjungan Anda!\n\n'));

            // Cut paper
            commands.push(0x1D, 0x56, 0x42, 0x00); // Partial cut

            const dataArray = new Uint8Array(commands);

            // Try to reconnect if device is already stored and connected
            if (bluetoothDevice && bluetoothDevice.gatt.connected) {
                device = bluetoothDevice;
                server = device.gatt;
                console.log('Reusing existing connection');
            } else {
                // Request Bluetooth device - try without optional services first
                try {
                    device = await navigator.bluetooth.requestDevice({
                        acceptAllDevices: true,
                        // Don't request optional services initially to see if device stays connected
                    });
                } catch (error) {
                    if (error.name === 'NotFoundError') {
                        alert('Pemilihan printer dibatalkan.');
                        return;
                    }
                    throw error;
                }

                setBluetoothDevice(device);

                // Use gattserverconnected event to get services immediately after connection
                const connectionPromise = new Promise((resolve, reject) => {
                    device.addEventListener('gattserverdisconnected', () => {
                        console.log('Device disconnected');
                    });

                    device.gatt.connect().then(async (gattServer) => {
                        console.log('Connected to device:', device.name);
                        server = gattServer;

                        // Try to get services - first try SPP directly, then all services
                        try {
                            // Try SPP first
                            console.log('Trying Serial Port Profile...');
                            const sppService = await server.getPrimaryService('00001101-0000-1000-8000-00805f9b34fb');
                            console.log('SPP Service found');
                            service = sppService;

                            const characteristics = await sppService.getCharacteristics();
                            console.log('SPP Characteristics:', characteristics.map(c => c.uuid));

                            for (const char of characteristics) {
                                if (char.properties.write || char.properties.writeWithoutResponse) {
                                    characteristic = char;
                                    console.log('Found writable characteristic:', char.uuid);
                                    resolve();
                                    return;
                                }
                            }
                        } catch (sppError) {
                            console.log('SPP not available, trying all services:', sppError);
                        }

                        // If SPP fails, try all services
                        try {
                            const services = await server.getPrimaryServices();
                            console.log('Available services:', services.map(s => s.uuid));

                            let found = false;
                            for (const srv of services) {
                                try {
                                    const characteristics = await srv.getCharacteristics();
                                    console.log(`Service ${srv.uuid} characteristics:`, characteristics.map(c => c.uuid));

                                    for (const char of characteristics) {
                                        if (char.properties.write || char.properties.writeWithoutResponse) {
                                            characteristic = char;
                                            service = srv;
                                            console.log('Found writable characteristic:', char.uuid, 'properties:', char.properties);
                                            found = true;
                                            break;
                                        }
                                    }

                                    if (found) break;
                                } catch (error) {
                                    console.log('Error getting characteristics for service:', srv.uuid, error);
                                    continue;
                                }
                            }

                            if (!characteristic) {
                                reject(new Error('Tidak dapat menemukan karakteristik yang dapat ditulis pada printer.'));
                            } else {
                                resolve();
                            }
                        } catch (error) {
                            reject(error);
                        }
                    }).catch(reject);
                });

                await connectionPromise;
            }

            if (!characteristic) {
                throw new Error('Tidak dapat menemukan karakteristik yang dapat ditulis pada printer. Pastikan printer mendukung Bluetooth printing.');
            }

            // Send commands to printer in chunks
            console.log('Total data size:', dataArray.length, 'bytes');
            console.log('Sending to characteristic:', characteristic.uuid);

            // Try writeWithoutResponse first (faster, no acknowledgment)
            if (characteristic.properties.writeWithoutResponse) {
                console.log('Using writeWithoutResponse');
                const chunkSize = 512;
                for (let i = 0; i < dataArray.length; i += chunkSize) {
                    const chunk = dataArray.slice(i, i + chunkSize);
                    await characteristic.writeValueWithoutResponse(chunk);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else if (characteristic.properties.write) {
                console.log('Using write (with response)');
                const chunkSize = 512;
                for (let i = 0; i < dataArray.length; i += chunkSize) {
                    const chunk = dataArray.slice(i, i + chunkSize);
                    await characteristic.writeValue(chunk);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                throw new Error('Characteristic does not support write operations');
            }

            console.log('Data sent successfully');

            await new Promise(resolve => setTimeout(resolve, 500));

            await server.disconnect();
            console.log('Disconnected');

            alert('Struk berhasil dikirim ke printer!');
        } catch (error) {
            console.error('Bluetooth printing error:', error);
            if (error.name === 'NetworkError') {
                alert('Koneksi Bluetooth terputus. Silakan coba lagi atau pastikan printer dalam jangkauan.');
            } else if (error.name === 'NotFoundError') {
                alert('Printer tidak ditemukan atau koneksi dibatalkan.');
            } else {
                alert('Gagal mencetak via Bluetooth: ' + error.message + '\n\nCek console (F12) untuk detail error dan services yang tersedia.');
            }
        }
    };

    if (!openShift) {
        return (
            <ErpLayout title="Kasir">
                <Head title="Kasir" />
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold mb-2">Shift Belum Dibuka</h2>
                    <p className="mb-4">Anda harus membuka shift terlebih dahulu sebelum dapat mengakses kasir.</p>
                    <button 
                        onClick={() => router.get(route('shifts'))}
                        className="bg-amber-600 text-white px-4 py-2 rounded font-medium hover:bg-amber-700"
                    >
                        Buka Shift Sekarang
                    </button>
                </div>
            </ErpLayout>
        );
    }

    return (
        <ErpLayout title="Kasir">
            <Head title="Kasir" />

            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-slate-900 hidden md:block">Kasir</h1>
                    {isOffline && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Offline Mode
                        </span>
                    )}
                </div>
                <div className="flex-1 md:flex-none flex justify-end gap-2">
                    <button 
                        onClick={() => {
                            setHistoryTab(allUnpaidTransactions.length > 0 ? 'UNPAID' : 'PAID');
                            setIsHistoryModalOpen(true);
                        }}
                        className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 text-sm font-medium flex items-center gap-2 shadow-sm"
                    >
                        Riwayat Pesanan
                        {allUnpaidTransactions.length > 0 && (
                            <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                                {allUnpaidTransactions.length} Belum Bayar
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
                {/* Produk Grid */}
                <div className="lg:col-span-2 bg-white shadow-sm rounded-lg border border-slate-200 p-4 flex flex-col h-full overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Pilih Produk</h2>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => setIsCartVisible(true)}
                                className="lg:hidden bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span>Keranjang ({cart.length})</span>
                            </button>
                        </div>
                    </div>

                    {/* Search and Filter */}
                    <div className="mb-4">
                        <div className="flex gap-2">
                            {/* Search - Always visible */}
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Cari produk..."
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            {/* Category Filter - Button */}
                            <button
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors whitespace-nowrap"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                {selectedCategory === 'ALL' ? 'Semua' : selectedCategory}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto pr-2 pb-4">
                        {filteredProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="flex flex-col items-center p-2 sm:p-3 border border-slate-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all active:scale-95 bg-slate-50 text-left"
                            >
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-20 sm:h-24 object-cover rounded mb-2 bg-white" />
                                ) : (
                                    <div className="w-full h-20 sm:h-24 bg-slate-200 rounded mb-2 flex items-center justify-center text-slate-400 text-xs">Img</div>
                                )}
                                <span className="font-medium text-xs sm:text-sm text-slate-900 w-full truncate">{product.name}</span>
                                <span className="text-indigo-600 font-semibold text-xs sm:text-sm w-full">{formatRupiah(product.price)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile backdrop */}
                {isCartVisible && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                        onClick={() => setIsCartVisible(false)}
                    />
                )}

                {/* Keranjang & Checkout */}
                <div className={`bg-white shadow-sm rounded-lg border border-slate-200 p-4 flex flex-col h-full fixed inset-y-0 right-0 z-40 lg:relative lg:z-0 transform transition-transform duration-300 ${isCartVisible ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} w-full lg:w-auto max-w-md lg:max-w-none`}>
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-lg font-semibold text-slate-900">Pesanan Saat Ini</h2>
                        <button
                            onClick={() => setIsCartVisible(false)}
                            className="lg:hidden text-slate-400 hover:text-slate-600"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto mb-4">
                        {cart.length === 0 ? (
                            <div className="text-center text-slate-400 mt-10">Keranjang kosong</div>
                        ) : (
                            <ul className="space-y-2 sm:space-y-3">
                                {cart.map(item => (
                                    <li key={item.product_id} className="flex justify-between items-start border-b border-slate-100 pb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-xs sm:text-sm text-slate-900 truncate">{item.product_name}</div>
                                            <div className="text-xs text-slate-500">{formatRupiah(item.price_per_porsi)} x {item.qty_porsi}</div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 ml-2">
                                            <div className="font-semibold text-xs sm:text-sm text-slate-900">{formatRupiah(item.price_per_porsi * item.qty_porsi)}</div>
                                            <div className="flex items-center gap-1 sm:gap-2">
                                                <button onClick={() => updateQty(item.product_id, -1)} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs sm:text-sm">-</button>
                                                <span className="text-xs sm:text-sm font-medium w-3 sm:w-4 text-center">{item.qty_porsi}</span>
                                                <button onClick={() => updateQty(item.product_id, 1)} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs sm:text-sm">+</button>
                                                <button onClick={() => removeFromCart(item.product_id)} className="ml-1 sm:ml-2 text-rose-500 hover:text-rose-700 text-xs font-medium">Hapus</button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-base sm:text-lg font-bold text-slate-900">Total</span>
                            <span className="text-xl sm:text-2xl font-bold text-indigo-700">{formatRupiah(total)}</span>
                        </div>

                        {cart.length > 0 && (
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Nama Pelanggan (Opsional)</label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Nama Pelanggan / Meja"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setIsCheckoutModalOpen(true)}
                            disabled={cart.length === 0}
                            className="w-full text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base bg-indigo-600 hover:bg-indigo-700"
                        >
                            PROSES PESANAN
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
            {isCheckoutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900">Proses Pesanan</h2>
                        </div>
                        <div className="p-6">
                            <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-slate-600">Total Pesanan</span>
                                    <span className="text-xl font-bold text-indigo-700">{formatRupiah(total)}</span>
                                </div>
                                <div className="text-sm text-slate-500">{cart.length} item</div>
                            </div>
                            <div className="space-y-3">
                                <button
                                    onClick={handleSaveOrder}
                                    disabled={processing}
                                    className="w-full bg-rose-600 text-white font-bold py-3 rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {processing ? 'Memproses...' : 'SIMPAN PESANAN (BELUM BAYAR)'}
                                </button>
                                <button
                                    onClick={handlePayNow}
                                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    BAYAR SEKARANG
                                </button>
                                <button
                                    onClick={() => setIsCheckoutModalOpen(false)}
                                    className="w-full bg-slate-100 text-slate-700 font-medium py-3 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    BATAL
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">Pembayaran</h2>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-slate-600">Total Tagihan</span>
                                    <span className="text-2xl font-bold text-indigo-700">{formatRupiah(total)}</span>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Metode Pembayaran</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('CASH')}
                                        className={`py-3 text-sm font-medium rounded border ${paymentMethod === 'CASH' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-300 text-slate-600'}`}
                                    >
                                        Tunai
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('QRIS')}
                                        className={`py-3 text-sm font-medium rounded border ${paymentMethod === 'QRIS' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-300 text-slate-600'}`}
                                    >
                                        QRIS
                                    </button>
                                </div>
                            </div>

                            {paymentMethod === 'CASH' && (
                                <>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Uang Diterima</label>
                                        <input
                                            type="number"
                                            value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            className="w-full border border-slate-300 rounded-md px-4 py-3 text-lg font-semibold focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="0"
                                        />
                                        <div className="flex justify-between items-center mt-2 gap-2">
                                            <button
                                                onClick={handleSetExactAmount}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition-colors"
                                            >
                                                Uang Pas
                                            </button>
                                            <button
                                                onClick={() => setCashReceived('')}
                                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded transition-colors"
                                            >
                                                Reset
                                            </button>
                                            {cashReceived && Number(cashReceived) >= total && (
                                                <span className="text-emerald-600 font-semibold text-sm">
                                                    Kembalian: {formatRupiah(Number(cashReceived) - total)}
                                                </span>
                                            )}
                                            {cashReceived && Number(cashReceived) < total && (
                                                <span className="text-rose-500 font-semibold text-sm">Kurang: {formatRupiah(total - Number(cashReceived))}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Nominal Cepat</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[1000, 2000, 5000, 10000, 20000, 50000, 100000].map(nominal => (
                                                <button
                                                    key={nominal}
                                                    onClick={() => handleAddNominal(nominal)}
                                                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-sm transition-colors"
                                                >
                                                    {formatRupiah(nominal)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {paymentMethod === 'QRIS' && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                    <p className="text-blue-800 text-sm">Scan QRIS untuk pembayaran</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={handleCheckout}
                                disabled={processing || (paymentMethod === 'CASH' && (!cashReceived || Number(cashReceived) < total))}
                                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {processing ? 'Memproses...' : 'KONFIRMASI PEMBAYARAN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Selection Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">Pilih Kategori</h2>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <div className="p-4 max-h-96 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-2">
                                {categories.map(category => (
                                    <button
                                        key={category}
                                        onClick={() => {
                                            setSelectedCategory(category);
                                            setIsCategoryModalOpen(false);
                                        }}
                                        className={`px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                                            selectedCategory === category
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                    >
                                        {category === 'ALL' ? 'Semua' : category}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {receiptTransaction && (
                <>
                    <style type="text/css" media="print">
                        {`
                            body * {
                                visibility: hidden;
                            }
                            #receipt-content, #receipt-content * {
                                visibility: visible;
                            }
                            #receipt-content {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                margin: 0;
                                padding: 10px;
                                color: black !important;
                            }
                        `}
                    </style>
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] print:shadow-none">
                            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-slate-900">Struk Pembayaran</h2>
                                <button onClick={() => setReceiptTransaction(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                            </div>
                            <div className="p-6 overflow-y-auto text-slate-800" id="receipt-content">
                                {/* Receipt content */}
                                <div className="text-center mb-4">
                                    <h3 className="font-bold text-lg">{openShift?.outlet?.name || 'Toko'}</h3>
                                    {openShift?.outlet?.address && <p className="text-xs text-slate-600">{openShift.outlet.address}</p>}
                                    {openShift?.outlet?.phone && <p className="text-xs text-slate-600">Telp: {openShift.outlet.phone}</p>}
                                    <p className="text-xs text-slate-500 mt-1">{new Date(receiptTransaction.created_at).toLocaleString('id-ID', { 
                                        timeZone: 'Asia/Jakarta',
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })}</p>
                                    <p className="text-xs text-slate-500">No: {receiptTransaction.invoice_number}</p>
                                </div>
                                <div className="border-t border-b border-dashed border-slate-300 py-3 mb-3 space-y-2">
                                    {receiptTransaction.items?.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <div>
                                                <span>{item.product_name}</span>
                                                <div className="text-xs text-slate-500">{item.qty_porsi} x {formatRupiah(item.price_per_porsi)}</div>
                                            </div>
                                            <span>{formatRupiah(item.subtotal)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between font-bold">
                                        <span>Total</span>
                                        <span>{formatRupiah(receiptTransaction.total_amount)}</span>
                                    </div>
                                    {receiptTransaction.payment_method === 'CASH' && receiptTransaction.cash_received && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Tunai</span>
                                                <span>{formatRupiah(receiptTransaction.cash_received)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Kembali</span>
                                                <span>{formatRupiah(receiptTransaction.change_amount)}</span>
                                            </div>
                                        </>
                                    )}
                                    {receiptTransaction.payment_method === 'QRIS' && (
                                        <div className="flex justify-between text-blue-600 mt-2">
                                            <span>Dibayar dengan</span>
                                            <span className="font-bold">QRIS</span>
                                        </div>
                                    )}
                                    {receiptTransaction.payment_status === 'UNPAID' && (
                                        <div className="flex justify-between text-rose-600 mt-2 font-bold">
                                            <span>Status</span>
                                            <span>BELUM BAYAR (UTANG)</span>
                                        </div>
                                    )}
                                </div>
                                {receiptTransaction.note && (
                                    <div className="mt-4 text-xs italic text-center text-slate-600">
                                        Catatan: {receiptTransaction.note}
                                    </div>
                                )}
                                <div className="mt-6 text-center text-xs font-semibold text-slate-500">
                                    Terima Kasih Atas Kunjungan Anda!
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                                <button onClick={() => setReceiptTransaction(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                    Tutup
                                </button>
                                <button onClick={() => window.print()} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    Cetak Struk
                                </button>
                                <button onClick={() => printToBluetooth(receiptTransaction)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                    </svg>
                                    Bluetooth
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* History & Unpaid Modal */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">Riwayat Pesanan (Shift Ini)</h2>
                            <button onClick={() => { setIsHistoryModalOpen(false); setSelectedUnpaidTx(null); }} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        
                        {!selectedUnpaidTx ? (
                            <>
                                <div className="flex border-b border-slate-200 px-6 pt-2">
                                    <button
                                        onClick={() => setHistoryTab('UNPAID')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 ${historyTab === 'UNPAID' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Belum Bayar ({allUnpaidTransactions.length})
                                    </button>
                                    <button
                                        onClick={() => setHistoryTab('PAID')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 ${historyTab === 'PAID' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Selesai ({paidTransactions.length})
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                                    {historyTab === 'UNPAID' && (
                                        <div className="space-y-3">
                                            {allUnpaidTransactions.length === 0 ? (
                                                <p className="text-center text-slate-500 py-8">Tidak ada pesanan yang belum dibayar.</p>
                                            ) : (
                                                allUnpaidTransactions.map(tx => (
                                                    <div key={tx.id} className="bg-white p-4 rounded-lg border border-rose-200 shadow-sm flex justify-between items-center">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-semibold text-slate-900">{tx.invoice_number}</span>
                                                                <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-medium">Utang</span>
                                                            </div>
                                                            <div className="text-sm text-slate-600 mb-1">{tx.note || 'Tanpa Nama'} • {new Date(tx.created_at).toLocaleString('id-ID', { 
                                                                timeZone: 'Asia/Jakarta',
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}</div>
                                                            <div className="text-xs text-slate-500">
                                                                {tx.items.length} item: {tx.items.slice(0, 2).map(i => `${i.qty_porsi}x ${i.product_name}`).join(', ')}
                                                                {tx.items.length > 2 && ' ...'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-lg text-slate-900 mb-2">{formatRupiah(tx.total_amount)}</div>
                                                            <button 
                                                                onClick={() => setSelectedUnpaidTx(tx)}
                                                                className="bg-rose-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-rose-700 transition-colors shadow-sm"
                                                            >
                                                                Bayar Sekarang
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {historyTab === 'PAID' && (
                                        <div className="space-y-3">
                                            {paidTransactions.length === 0 ? (
                                                <p className="text-center text-slate-500 py-8">Tidak ada riwayat pesanan selesai.</p>
                                            ) : (
                                                paidTransactions.map(tx => (
                                                    <div key={tx.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-semibold text-slate-900">{tx.invoice_number}</span>
                                                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">Lunas ({tx.payment_method})</span>
                                                            </div>
                                                            <div className="text-sm text-slate-600 mb-1">{tx.note || 'Tanpa Nama'} • {new Date(tx.created_at).toLocaleString('id-ID', { 
                                                                timeZone: 'Asia/Jakarta',
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}</div>
                                                            <div className="text-xs text-slate-500">
                                                                {tx.items.length} item: {tx.items.slice(0, 2).map(i => `${i.qty_porsi}x ${i.product_name}`).join(', ')}
                                                                {tx.items.length > 2 && ' ...'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-2">
                                                            <div className="font-bold text-lg text-slate-900">{formatRupiah(tx.total_amount)}</div>
                                                            <button 
                                                                onClick={() => {
                                                                    setReceiptTransaction(tx);
                                                                    setIsHistoryModalOpen(false);
                                                                }}
                                                                className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1"
                                                            >
                                                                Cetak Ulang Struk
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* Settle Unpaid Order View */
                            <div className="p-6 bg-slate-50/50 flex-1">
                                <button 
                                    onClick={() => setSelectedUnpaidTx(null)}
                                    className="text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center gap-1 mb-4"
                                >
                                    &larr; Kembali ke daftar
                                </button>
                                
                                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm mb-6">
                                    <h3 className="font-semibold text-lg text-slate-900 mb-2">Penyelesaian Pembayaran</h3>
                                    <div className="text-sm text-slate-600 mb-4">
                                        <p><strong>Invoice:</strong> {selectedUnpaidTx.invoice_number}</p>
                                        <p><strong>Pelanggan:</strong> {selectedUnpaidTx.note || '-'}</p>
                                    </div>
                                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-md border border-slate-100 mb-4">
                                        <span className="text-slate-700 font-medium">Total Tagihan</span>
                                        <span className="text-2xl font-bold text-rose-600">{formatRupiah(selectedUnpaidTx.total_amount)}</span>
                                    </div>

                                    <form onSubmit={handlePayDebt} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Metode Pembayaran</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setPayDebtMethod('CASH')}
                                                    className={`py-2 text-sm font-medium rounded border ${payDebtMethod === 'CASH' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    Tunai
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPayDebtMethod('QRIS')}
                                                    className={`py-2 text-sm font-medium rounded border ${payDebtMethod === 'QRIS' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    QRIS
                                                </button>
                                            </div>
                                        </div>

                                        {payDebtMethod === 'CASH' && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Uang Diterima (Rp)</label>
                                                <input
                                                    type="number"
                                                    value={payDebtCash}
                                                    onChange={e => setPayDebtCash(e.target.value)}
                                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="Masukkan nominal uang pelanggan"
                                                    required
                                                />
                                                {payDebtCash && Number(payDebtCash) >= selectedUnpaidTx.total_amount && (
                                                    <p className="text-emerald-600 text-xs mt-1 font-medium">
                                                        Kembalian: {formatRupiah(Number(payDebtCash) - selectedUnpaidTx.total_amount)}
                                                    </p>
                                                )}
                                                {payDebtCash && Number(payDebtCash) < selectedUnpaidTx.total_amount && (
                                                    <p className="text-rose-500 text-xs mt-1 font-medium">Uang masih kurang!</p>
                                                )}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={debtProcessing || (payDebtMethod === 'CASH' && (!payDebtCash || Number(payDebtCash) < selectedUnpaidTx.total_amount))}
                                            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-md hover:bg-emerald-700 disabled:opacity-50 mt-4"
                                        >
                                            {debtProcessing ? 'Memproses...' : 'LUNASI SEKARANG'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
