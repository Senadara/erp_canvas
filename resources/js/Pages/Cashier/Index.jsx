import { useState, useEffect } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { enqueueSale, isOnline, onConnectivityChange } from '@/pwa/offlineQueue';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return 'Rp' + n.toLocaleString('id-ID');
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
    const [bluetoothCharacteristic, setBluetoothCharacteristic] = useState(null);
    const [bluetoothService, setBluetoothService] = useState(null);
    const [pairedPrinter, setPairedPrinter] = useState(() => {
        const saved = localStorage.getItem('pairedPrinter');
        return saved ? JSON.parse(saved) : null;
    });
    const [printerSettings, setPrinterSettings] = useState(() => {
        const saved = localStorage.getItem('printerSettings');
        return saved ? JSON.parse(saved) : { customHeader: '', customFooter: '' };
    });
    const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);

    // Listen for printer settings event from profile dropdown
    useEffect(() => {
        const handleOpenPrinterSettings = () => setIsPrinterSettingsOpen(true);
        window.addEventListener('openPrinterSettings', handleOpenPrinterSettings);
        return () => window.removeEventListener('openPrinterSettings', handleOpenPrinterSettings);
    }, []);



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

    const { flash, errors } = usePage().props;

    // Show backend errors to user
    useEffect(() => {
        if (errors?.error) {
            alert(errors.error);
        } else if (errors && Object.keys(errors).length > 0) {
            const firstErrorKey = Object.keys(errors)[0];
            alert(errors[firstErrorKey]);
        }
    }, [errors]);

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
            // Print otomatis via web ditiadakan, akan diprint via bluetooth
        }
    }, [flash]);

    // Helper untuk kalkulasi maksimal porsi berdasarkan stok bahan
    const getMaxPortions = (product) => {
        if (!product.conversions || product.conversions.length === 0) return null; // tidak ditrack

        let maxPortions = Infinity;
        let hasTrackable = false;

        for (const conv of product.conversions) {
            if (conv.stock_item && conv.stock_item.trackable) {
                hasTrackable = true;
                const ratio = parseFloat(conv.ratio);
                if (ratio > 0) {
                    const currentStock = parseFloat(conv.stock_item.current_stock_biji) || 0;
                    const portions = Math.floor(currentStock / ratio);
                    if (portions < maxPortions) {
                        maxPortions = portions;
                    }
                }
            }
        }

        return hasTrackable ? Math.max(0, maxPortions) : null;
    };

    const addToCart = (product) => {
        const max = getMaxPortions(product);
        if (max !== null && max <= 0) {
            alert('Stok habis!');
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.product_id === product.id);
            const currentQty = existing ? existing.qty_porsi : 0;
            
            if (max !== null && currentQty >= max) {
                alert(`Stok tidak mencukupi. Sisa maksimal: ${max} porsi.`);
                return prev;
            }

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
                    if (delta > 0) {
                        const product = products.find(p => p.id === productId);
                        if (product) {
                            const max = getMaxPortions(product);
                            if (max !== null && newQty > max) {
                                alert(`Stok tidak mencukupi. Sisa maksimal: ${max} porsi.`);
                                return item;
                            }
                        }
                    }
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

    const handleDebtAddNominal = (amount) => {
        const current = Number(payDebtCash) || 0;
        setPayDebtCash(String(current + amount));
    };

    const handleDebtSetExactAmount = () => {
        if (selectedUnpaidTx) {
            setPayDebtCash(String(selectedUnpaidTx.total_amount));
        }
    };

    const handlePairPrinter = async () => {
        try {
            if (!navigator.bluetooth) {
                alert('Browser Anda tidak mendukung Bluetooth. Gunakan Chrome atau Edge di Android/Desktop.');
                return;
            }

            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
            });

            const printerInfo = {
                id: device.id,
                name: device.name || 'Unknown Printer',
            };

            setPairedPrinter(printerInfo);
            localStorage.setItem('pairedPrinter', JSON.stringify(printerInfo));
            alert(`Printer "${device.name}" berhasil dipasangkan!`);
        } catch (error) {
            if (error.name === 'NotFoundError') {
                alert('Pemilihan printer dibatalkan.');
            } else {
                console.error('Error pairing printer:', error);
                alert('Gagal memasangkan printer. Coba lagi.');
            }
        }
    };

    const handleUnpairPrinter = () => {
        setPairedPrinter(null);
        localStorage.removeItem('pairedPrinter');
        alert('Printer berhasil dilepas.');
    };

    const handleSavePrinterSettings = () => {
        localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
        setIsPrinterSettingsOpen(false);
        alert('Pengaturan printer berhasil disimpan.');
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

            // Check if site is using HTTPS (required for Web Bluetooth on deployed sites)
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                alert('Bluetooth printing hanya bekerja di HTTPS. Pastikan website Anda menggunakan HTTPS atau gunakan localhost untuk testing.');
                return;
            }

            let device;
            let server;
            let characteristic = null;
            let service = null;

            // Check if we have an existing connected device
            if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
                console.log('Reusing existing connection to:', bluetoothDevice.name);
                device = bluetoothDevice;
                server = device.gatt;
                // Reuse stored characteristic and service if available
                if (bluetoothCharacteristic && bluetoothService) {
                    characteristic = bluetoothCharacteristic;
                    service = bluetoothService;
                    console.log('Reusing stored characteristic:', characteristic.uuid);
                } else {
                    // If no characteristic stored, rediscover services
                    console.log('No stored characteristic, rediscovering services...');
                    characteristic = null;
                    service = null;
                }
            } else if (bluetoothDevice) {
                // Try to reconnect to the stored device without showing dialog
                console.log('Device disconnected, attempting to reconnect to:', bluetoothDevice.name);
                console.log('Device gatt available:', !!bluetoothDevice.gatt);
                try {
                    device = bluetoothDevice;
                    if (device.gatt) {
                        server = await device.gatt.connect();
                        console.log('Reconnected successfully to:', device.name);
                        // Clear stored characteristic/service on reconnect as they might be invalid
                        setBluetoothCharacteristic(null);
                        setBluetoothService(null);
                    } else {
                        console.log('Device gatt not available, need to request device');
                        device = null;
                    }
                } catch (error) {
                    console.log('Failed to reconnect to stored device:', error);
                    device = null;
                    server = null;
                }
            }

            // If still no device, try to request new device
            if (!device) {
                if (pairedPrinter) {
                    try {
                        console.log('Requesting device with name filter:', pairedPrinter.name);
                        device = await navigator.bluetooth.requestDevice({
                            filters: [{ name: pairedPrinter.name }],
                            optionalServices: ['00001101-0000-1000-8000-00805f9b34fb']
                        });
                        console.log('Device selected:', device.name);
                    } catch (error) {
                        console.log('Failed to request device with filter, trying acceptAllDevices:', error);
                        device = null;
                    }
                }

                if (!device) {
                    try {
                        device = await navigator.bluetooth.requestDevice({
                            acceptAllDevices: true,
                            optionalServices: ['00001101-0000-1000-8000-00805f9b34fb']
                        });
                        console.log('New device selected:', device.name);

                        // Save as paired printer
                        const printerInfo = {
                            id: device.id,
                            name: device.name || 'Unknown Printer',
                        };
                        setPairedPrinter(printerInfo);
                        localStorage.setItem('pairedPrinter', JSON.stringify(printerInfo));
                    } catch (error) {
                        if (error.name === 'NotFoundError') {
                            alert('Pemilihan printer dibatalkan.');
                            return;
                        }
                        throw error;
                    }
                }
            }

            // Build ESC/POS commands for receipt
            const encoder = new TextEncoder();
            let commands = [];

            // Initialize printer
            commands.push(0x1B, 0x40); // Initialize
            commands.push(0x1B, 0x61, 0x01); // Center align

            // Custom header if set
            if (printerSettings.customHeader) {
                commands.push(...encoder.encode(printerSettings.customHeader + '\n'));
                commands.push(...encoder.encode('--------------------------------\n'));
            }

            // Logo - fetch and convert to base64 if exists (optimized for thermal printer)
            if (openShift?.outlet?.logo) {
                try {
                    console.log('Fetching logo from:', `/storage/${openShift.outlet.logo}`);
                    const logoResponse = await fetch(`/storage/${openShift.outlet.logo}`);
                    if (logoResponse.ok) {
                        const logoBlob = await logoResponse.blob();
                        console.log('Logo blob size:', logoBlob.size);

                        // Create an image to get dimensions
                        const imgBitmap = await createImageBitmap(logoBlob);
                        console.log('Logo dimensions:', imgBitmap.width, 'x', imgBitmap.height);

                        // Resize to max width 96 pixels (thermal printer standard width is 384 dots, 96px = 384/4 bytes)
                        // This provides better visibility while keeping data manageable
                        const maxWidth = 96;
                        const scale = Math.min(maxWidth / imgBitmap.width, 1);
                        const newWidth = Math.floor(imgBitmap.width * scale);
                        const newHeight = Math.floor(imgBitmap.height * scale);

                        // Create canvas for resizing and converting to monochrome
                        const canvas = document.createElement('canvas');
                        canvas.width = newWidth;
                        canvas.height = newHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(imgBitmap, 0, 0, newWidth, newHeight);

                        // Get image data and convert to monochrome
                        const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
                        const pixels = imageData.data;
                        const monochromeData = [];

                        // Convert to 1-bit monochrome (ESC/POS format)
                        for (let y = 0; y < newHeight; y++) {
                            for (let x = 0; x < newWidth; x += 8) {
                                let byte = 0;
                                for (let bit = 0; bit < 8; bit++) {
                                    if (x + bit < newWidth) {
                                        const pixelIndex = ((y * newWidth) + (x + bit)) * 4;
                                        const r = pixels[pixelIndex];
                                        const g = pixels[pixelIndex + 1];
                                        const b = pixels[pixelIndex + 2];
                                        const brightness = (r + g + b) / 3;
                                        if (brightness < 128) {
                                            byte |= (1 << (7 - bit));
                                        }
                                    }
                                }
                                monochromeData.push(byte);
                            }
                        }

                        console.log('Monochrome data size:', monochromeData.length);

                        // ESC/POS commands for image using GS v 0 command
                        // Format: GS v 0 m xL xH yL yH d1...dk
                        // m = mode (0x30 for normal)
                        // xL, xH = width in bytes (low, high)
                        // yL, yH = height in dots (low, high)
                        commands.push(0x1B, 0x61, 0x01); // Center align
                        commands.push(0x1D, 0x76, 0x30, 0x00); // GS v 0
                        commands.push((newWidth / 8) & 0xFF, ((newWidth / 8) >> 8) & 0xFF); // Width in bytes
                        commands.push(newHeight & 0xFF, (newHeight >> 8) & 0xFF); // Height in dots
                        commands.push(...monochromeData); // Image data
                        commands.push(0x0A); // Line feed
                    } else {
                        console.log('Logo fetch failed:', logoResponse.status);
                    }
                } catch (error) {
                    console.log('Error loading logo:', error);
                }
            }

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

            // Custom footer if set
            if (printerSettings.customFooter) {
                commands.push(...encoder.encode('--------------------------------\n'));
                commands.push(0x1B, 0x61, 0x01); // Center align
                commands.push(...encoder.encode(printerSettings.customFooter + '\n'));
            }

            // Footer
            commands.push(0x1B, 0x61, 0x01); // Center align
            commands.push(...encoder.encode('\nTerima Kasih Atas Kunjungan Anda!\n\n'));

            // Cut paper
            commands.push(0x1D, 0x56, 0x42, 0x00); // Partial cut

            const dataArray = new Uint8Array(commands);

            // Connect to device if not already connected
            if (!server) {
                setBluetoothDevice(device);

                // Use gattserverconnected event to get services immediately after connection
                const connectionPromise = new Promise((resolve, reject) => {
                    device.addEventListener('gattserverdisconnected', () => {
                        console.log('Device disconnected');
                        // Don't clear bluetoothDevice - keep it for reconnection attempts
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
                                    setBluetoothCharacteristic(char);
                                    setBluetoothService(sppService);
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
                                            setBluetoothCharacteristic(char);
                                            setBluetoothService(srv);
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

            // If still no characteristic after connection, try to discover services
            if (!characteristic && server) {
                console.log('No characteristic found, attempting service discovery...');
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
                                    setBluetoothCharacteristic(char);
                                    setBluetoothService(srv);
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
                        throw new Error('Tidak dapat menemukan karakteristik yang dapat ditulis pada printer.');
                    }
                } catch (error) {
                    console.log('Service discovery failed:', error);
                    throw new Error('Tidak dapat menemukan karakteristik yang dapat ditulis pada printer. Pastikan printer mendukung Bluetooth printing.');
                }
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

            // Keep connection alive - don't disconnect
            console.log('Keeping connection alive for next print');

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

            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    {isOffline && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Offline
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-6rem)]">
                {/* Produk Grid */}
                <div className="lg:col-span-2 bg-white shadow-sm rounded-lg border border-slate-200 p-4 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold text-slate-900">Pilih Produk</h2>
                        <button
                            onClick={() => {
                                setHistoryTab('UNPAID');
                                setIsHistoryModalOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition-all hover:bg-indigo-100 hover:border-indigo-300 hover:shadow-md active:scale-95"
                            title="Riwayat Pesanan"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Riwayat</span>
                        </button>
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
                        {filteredProducts.map(product => {
                            const maxPortions = getMaxPortions(product);
                            const isOutOfStock = maxPortions !== null && maxPortions <= 0;
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    disabled={isOutOfStock}
                                    className={`relative flex flex-col items-center p-2 sm:p-3 border rounded-lg transition-all text-left ${isOutOfStock ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-200 hover:border-indigo-500 hover:shadow-md active:scale-95 bg-slate-50'}`}
                                >
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className={`w-full h-20 sm:h-24 object-cover rounded mb-2 ${isOutOfStock ? 'grayscale' : 'bg-white'}`} />
                                    ) : (
                                        <div className="w-full h-20 sm:h-24 bg-slate-200 rounded mb-2 flex items-center justify-center text-slate-400 text-xs">Img</div>
                                    )}
                                    <span className="font-medium text-xs sm:text-sm text-slate-900 w-full truncate">{product.name}</span>
                                    <div className="flex justify-between items-center w-full mt-1">
                                        <span className="text-indigo-600 font-semibold text-xs sm:text-sm">{formatRupiah(product.price)}</span>
                                        {maxPortions !== null && (
                                            <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${
                                                maxPortions <= 0 ? 'bg-rose-100 text-rose-700' : 
                                                maxPortions <= 5 ? 'bg-amber-100 text-amber-700' : 
                                                'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {maxPortions <= 0 ? 'Habis' : `Sisa ${maxPortions}`}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
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

            {/* Printer Settings Modal */}
            {isPrinterSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">Pengaturan Printer</h2>
                            <button onClick={() => setIsPrinterSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Printer Pairing */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Printer Bluetooth</label>
                                {pairedPrinter ? (
                                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{pairedPrinter.name}</p>
                                            <p className="text-xs text-slate-500">Terpasang</p>
                                        </div>
                                        <button onClick={handleUnpairPrinter} className="text-rose-600 text-sm font-medium hover:text-rose-700">
                                            Lepas
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={handlePairPrinter} className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                                        Pasang Printer
                                    </button>
                                )}
                            </div>

                            {/* Custom Header */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Header Kustom</label>
                                <textarea
                                    value={printerSettings.customHeader}
                                    onChange={e => setPrinterSettings({ ...printerSettings, customHeader: e.target.value })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    rows="2"
                                    placeholder="Teks header kustom (opsional)"
                                />
                            </div>

                            {/* Custom Footer */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Footer Kustom</label>
                                <textarea
                                    value={printerSettings.customFooter}
                                    onChange={e => setPrinterSettings({ ...printerSettings, customFooter: e.target.value })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    rows="2"
                                    placeholder="Teks footer kustom (opsional)"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                            <button onClick={handleSavePrinterSettings} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {receiptTransaction && (
                <>
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] print:shadow-none">
                            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-slate-900">Struk Pembayaran</h2>
                                <button onClick={() => setReceiptTransaction(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                            </div>
                            <div className="p-6 overflow-y-auto text-slate-800" id="receipt-content">
                                {/* Receipt content */}
                                <div className="text-center mb-4">
                                    {openShift?.outlet?.logo && (
                                        <img src={`/storage/${openShift.outlet.logo}`} alt={openShift.outlet.name} className="h-20 w-auto mx-auto mb-2 object-contain" />
                                    )}
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
                                <button type="button" onClick={() => setReceiptTransaction(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                    Tutup
                                </button>
                                <button type="button" onClick={(e) => { e.preventDefault(); printToBluetooth(receiptTransaction); }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                    </svg>
                                    Cetak Struk
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
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Uang Diterima (Rp)</label>
                                                
                                                {/* Nominal Cepat */}
                                                <div className="grid grid-cols-3 gap-2 mb-3">
                                                    <button type="button" onClick={handleDebtSetExactAmount} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded font-medium text-sm transition-colors">Uang Pas</button>
                                                    <button type="button" onClick={() => handleDebtAddNominal(10000)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded font-medium text-sm transition-colors">+10k</button>
                                                    <button type="button" onClick={() => handleDebtAddNominal(20000)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded font-medium text-sm transition-colors">+20k</button>
                                                    <button type="button" onClick={() => handleDebtAddNominal(50000)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded font-medium text-sm transition-colors">+50k</button>
                                                    <button type="button" onClick={() => handleDebtAddNominal(100000)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded font-medium text-sm transition-colors">+100k</button>
                                                    <button type="button" onClick={() => setPayDebtCash('')} className="bg-rose-100 hover:bg-rose-200 text-rose-700 py-2 rounded font-medium text-sm transition-colors">Reset</button>
                                                </div>

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

            {/* Floating Cart Button for Mobile */}
            <button
                onClick={() => setIsCartVisible(true)}
                className="lg:hidden fixed bottom-4 right-4 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="bg-white text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
            </button>
        </ErpLayout>
    );
}
