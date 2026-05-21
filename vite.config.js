import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icons/icon.svg'],
            manifest: {
                name: '简易 AI 工具箱',
                short_name: '简易 AI',
                description: '配置 API 地址和 Key 即可使用的极简 AI 工具',
                theme_color: '#0f172a',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                lang: 'zh-CN',
                icons: [
                    {
                        src: '/icons/icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-maskable.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                navigateFallback: '/index.html',
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === 'document' ||
                                request.destination === 'script' ||
                                request.destination === 'style' ||
                                request.destination === 'image' ||
                                request.destination === 'font';
                        },
                        handler: 'StaleWhileRevalidate'
                    }
                ]
            },
            devOptions: {
                enabled: false
            }
        })
    ],
    resolve: {
        alias: {
            '@': '/src'
        }
    },
    server: {
        port: 5173,
        host: true
    },
    build: {
        outDir: 'dist',
        sourcemap: false
    }
});
