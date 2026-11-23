import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version?: string;
};

export default defineConfig(() => {
  return {
    define: {
      __MORPH_VERSION__: JSON.stringify(pkg.version || '1.1.41'),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'morph-mark.png',
          'morph-wordmark.png',
          'morph-wordmark-light.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Morph',
          short_name: 'Morph',
          description: 'Cihaz içi görsel, PDF, video, ses ve arşiv uygulaması.',
          theme_color: '#101722',
          background_color: '#101722',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,mjs}'],
          globIgnores: ['ffmpeg/**', 'android-icons/**', 'ic_launcher*.png'],
          navigateFallbackDenylist: [/^\/api\//, /^\/ffmpeg\//],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /\/ffmpeg\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ffmpeg-core-cache',
                expiration: {
                  maxEntries: 6,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
          const ffmpegCoreDir = path.resolve(__dirname, 'node_modules/@ffmpeg/core/dist/esm');
          const distFfmpegDir = path.resolve(distDir, 'ffmpeg');
          if (fs.existsSync(distDir) && fs.existsSync(ffmpegCoreDir)) {
            fs.mkdirSync(distFfmpegDir, {recursive: true});
            for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
              const src = path.join(ffmpegCoreDir, f);
              if (fs.existsSync(src)) {
                fs.copyFileSync(src, path.join(distFfmpegDir, f));
              }
            }
          }
          // Strip android-icons helper folder from dist so APK assets stay lean
          const distAndroidIcons = path.resolve(distDir, 'android-icons');
          if (fs.existsSync(distAndroidIcons)) {
            fs.rmSync(distAndroidIcons, {recursive: true, force: true});
          }
          if (fs.existsSync(distDir)) {
            for (const entry of fs.readdirSync(distDir)) {
              if (/^ic_launcher.*\.png$/i.test(entry)) {
                fs.rmSync(path.join(distDir, entry), {force: true});
              }
            }
          }
        },
      },
    ],
    worker: {
      format: 'es' as const,
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@ffmpeg/')) return 'vendor-ffmpeg';
            if (id.includes('node_modules/pdf-lib')) return 'vendor-pdf-lib';
            if (id.includes('node_modules/pdfjs-dist')) return 'vendor-pdfjs';
            if (id.includes('node_modules/jszip')) return 'vendor-jszip';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true' ? false : false,
      watch: null,
    },
  };
});
