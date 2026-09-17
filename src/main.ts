import { isNative } from './native';
import { App } from './ui/app';

void new App().boot();

// PWA: cache the game for instant, offline play (production builds only —
// a service worker would fight the dev server's module reloading). The
// native app ships its own copy of the files, so it needs no cache.
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
