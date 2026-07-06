import '../css/app.css';
import './bootstrap';
import { registerServiceWorker } from './pwa/register';

registerServiceWorker();

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
const staleChunkReloadKey = 'erp-karsa-stale-chunk-reloaded';

window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();

    if (sessionStorage.getItem(staleChunkReloadKey) === '1') {
        return;
    }

    sessionStorage.setItem(staleChunkReloadKey, '1');
    window.location.reload();
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        sessionStorage.removeItem(staleChunkReloadKey);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
