import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icon.svg', 'maskable-icon.svg'],
            manifest: {
                name: 'Mortgage Payment Planner',
                short_name: 'Mortgage PWA',
                description: 'Offline-friendly mortgage repayment planner that extracts principal values from a PDF and helps simulate payments on mobile.',
                theme_color: '#164e63',
                background_color: '#f4efe6',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                lang: 'ro-RO',
                icons: [
                    {
                        src: '/icon.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    },
                    {
                        src: '/maskable-icon.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,json,ico,png,txt,woff2}'],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true
            },
            devOptions: {
                enabled: true
            }
        })
    ]
});
