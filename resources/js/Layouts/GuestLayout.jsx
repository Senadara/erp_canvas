import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 px-4 py-10 selection:bg-emerald-500 selection:text-white">
            {/* Soft decorative background glow */}
            <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />

            <div className="relative w-full max-w-md">
                <div className="mb-6 flex flex-col items-center">
                    <Link href="/login" className="group flex flex-col items-center transition-transform duration-200 hover:scale-105">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-3 shadow-lg shadow-emerald-950/5 ring-1 ring-slate-200/80 transition-all group-hover:ring-emerald-400/60">
                            <ApplicationLogo className="h-full w-full object-contain" />
                        </div>
                    </Link>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
                    {children}
                </div>

                <p className="mt-6 text-center text-xs font-medium text-slate-500">
                    &copy; {new Date().getFullYear()} Karsa ERP &bull; Platform Manajemen Bisnis F&B
                </p>
            </div>
        </div>
    );
}
