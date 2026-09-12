// --- App Shell Cache Settings ---
const APP_SHELL_CACHE = 'html-viewer-shell-v1';
const USER_FILES_CACHE = 'html-blob-cache';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(APP_SHELL_CACHE)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== APP_SHELL_CACHE && cacheName !== USER_FILES_CACHE) {
                    return caches.delete(cacheName);
                }
                return undefined;
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }

    // Every Runtime URL is still an application navigation. Serve the
    // cached App Shell and let app.js read ?file=... and open the saved file.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match('./').then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
        );
        return;
    }

    // For normal assets, use an exact cache match. Do not ignore query
    // strings because Runtime URLs use query parameters as application state.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request);
        })
    );
});
