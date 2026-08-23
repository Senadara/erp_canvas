function sameOriginPath(url) {
    try {
        const parsed = new URL(url, window.location.href);
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return url;
    }
}

function browserPdfUrl(url) {
    const parsed = new URL(sameOriginPath(url), window.location.href);
    parsed.searchParams.set('browser_pdf', '1');
    return `${parsed.pathname}${parsed.search}`;
}

function base64ToPdfBlob(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: 'application/pdf' });
}

function writeLoadingPage(pdfWindow, message) {
    if (!pdfWindow) return;

    pdfWindow.opener = null;
    pdfWindow.document.write(`
        <!doctype html>
        <html>
            <head>
                <title>Membuka PDF</title>
                <style>
                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: grid;
                        place-items: center;
                        background: #f8fafc;
                        color: #0f172a;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    }
                    div {
                        max-width: 520px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        background: #fff;
                        padding: 20px 24px;
                        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
                        line-height: 1.6;
                    }
                    strong { display: block; margin-bottom: 6px; }
                </style>
            </head>
            <body><div>${message}</div></body>
        </html>
    `);
    pdfWindow.document.close();
}

export async function openPdfInBrowser(url) {
    const pdfWindow = window.open('', '_blank');
    writeLoadingPage(pdfWindow, 'Membuka PDF di browser...');

    try {
        const response = await fetch(browserPdfUrl(url), {
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (!response.ok) {
            throw new Error(`PDF request failed with status ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        let blob;

        if (contentType.includes('application/json')) {
            const payload = await response.json();
            if (!payload?.base64) {
                throw new Error('PDF JSON payload is missing base64 content');
            }
            blob = base64ToPdfBlob(payload.base64);
        } else if (contentType.includes('application/pdf')) {
            blob = await response.blob();
        } else {
            throw new Error(`Unexpected PDF response type: ${contentType || 'unknown'}`);
        }

        const objectUrl = URL.createObjectURL(blob);

        if (pdfWindow) {
            pdfWindow.location.href = objectUrl;
        } else {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
        console.error(error);
        writeLoadingPage(
            pdfWindow,
            '<strong>PDF gagal dibuka.</strong> Pastikan sesi login masih aktif, lalu refresh halaman aplikasi dan coba lagi. Jika masih gagal, kirim pesan error di Console browser agar bisa dilacak.',
        );
        window.alert('PDF gagal dibuka dari browser. Refresh halaman aplikasi lalu ulangi.');
    }
}
