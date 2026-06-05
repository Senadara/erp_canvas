import ErpLayout from '@/Layouts/ErpLayout';
import { Head } from '@inertiajs/react';

export default function Placeholder({ title, module }) {
    return (
        <ErpLayout title={title}>
            <Head title={title} />

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <p className="font-medium">Modul &quot;{title}&quot; — Fase implementasi</p>
                <p className="mt-2 text-sm">
                    Halaman ini menggantikan rute Next.js <code className="rounded bg-amber-100 px-1">/{module}</code>.
                    Logika bisnis akan di-port ke Laravel (<code>app/Services</code>) sesuai blueprint.
                </p>
            </div>
        </ErpLayout>
    );
}
