import ErpLayout from '@/Layouts/ErpLayout';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head } from '@inertiajs/react';

export default function Edit({ status }) {
    return (
        <ErpLayout title="Profil">
            <Head title="Profil" />
            <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <UpdateProfileInformationForm status={status} />
            </div>
        </ErpLayout>
    );
}
