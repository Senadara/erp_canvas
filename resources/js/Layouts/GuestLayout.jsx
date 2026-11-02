import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8">
            <div className="mb-4 flex flex-col items-center">
                <Link href="/login" className="transition-transform duration-200 hover:scale-105">
                    <ApplicationLogo className="h-16 w-16 drop-shadow-sm" />
                </Link>
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl sm:max-w-md sm:p-8">
                {children}
            </div>
        </div>
    );
}
