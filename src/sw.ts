import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig } from '../lib/firebase_constants';

declare let self: ServiceWorkerGlobalScope;

try {
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    onBackgroundMessage(messaging, (payload) => {
        console.log('[sw.ts] Received background message ', payload);

        // Se o payload já tiver um objeto 'notification', o Firebase Web SDK
        // no Android/Chrome já exibe a notificação automaticamente.
        // Chamar showNotification() aqui causaria uma notificação duplicada.
        if (payload.notification) {
            return;
        }

        // Para mensagens apenas de dados (Data-only), exibimos manualmente.
        // Usamos um 'tag' para garantir que mensagens repetidas não dupliquem.
        const notificationTitle = payload.data?.title || 'Conecta IEEE';
        const notificationOptions = {
            body: payload.data?.body || 'Você tem uma nova mensagem.',
            icon: '/assets/android-launchericon-192-192.png',
            badge: '/assets/android-launchericon-192-192.png',
            data: payload.data,
            tag: 'conecta-ieee-notif',
            renotify: true
        };

        return (self as any).registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (error) {
    console.warn('[sw.ts] Firebase Messaging indisponível no service worker:', error);
}

// Listener para abrir o app ao clicar na notificação
(self as any).addEventListener('notificationclick', (event: any) => {
    event.notification.close();

    event.waitUntil(
        (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any) => {
            // Se o app já estiver aberto, foca nele
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            // Se não, abre uma nova janela
            return (self as any).clients.openWindow('/');
        })
    );
});

cleanupOutdatedCaches();
(self as any).skipWaiting();
clientsClaim();

(self as any).addEventListener('activate', (event: ExtendableEvent) => {
    event.waitUntil(caches.delete('supabase-api'));
});

// Precache resources registered by VitePWA
precacheAndRoute(self.__WB_MANIFEST);

// Cache Images
registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'images',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
            }),
        ]
    })
);

// Cache Static Resources
registerRoute(
    ({ request }) =>
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'worker',
    new StaleWhileRevalidate({
        cacheName: 'static-resources'
    })
);

// Offline Page - Strategy: NetworkOnly (default), catch -> return offline page if nav
// Note: workbox-routing catch handler
// Simple implementation:
const OFFLINE_PAGE = '/offline.html';

// For navigation requests, try network, fall back to offline page
registerRoute(
    ({ request }) => request.mode === 'navigate',
    async ({ event }) => {
        try {
            return await fetch(event.request);
        } catch (error) {
            return caches.match(OFFLINE_PAGE) || new Response("Offline", { status: 200, headers: { 'Content-Type': 'text/html' } });
        }
    }
);
