import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {isNativeApp} from './engine/nativeBridge';
import './index.css';

if (isNativeApp()) {
  // Never trap bundled Capacitor Android WebView assets behind a Web Service Worker cache.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
  }
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('workbox-')).map((k) => caches.delete(k)))
      )
      .catch(() => {});
  }
} else {
  const UPDATE_THROTTLE_MS = 5 * 60 * 1000;
  const PERIODIC_UPDATE_MS = 60 * 60 * 1000;
  let lastUpdateCheck = 0;

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checkUpdate = () => {
        const now = Date.now();
        if (now - lastUpdateCheck < UPDATE_THROTTLE_MS) return;
        lastUpdateCheck = now;
        registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkUpdate();
      });
      window.setInterval(() => {
        registration.update().catch(() => {});
      }, PERIODIC_UPDATE_MS);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
