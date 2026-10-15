/* Registers the service worker ONLY in production builds.
   In dev (npm run dev) it stays dormant — hot-reload workflow untouched,
   and installability comes from the manifest alone. */

export function registerPwa() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) =>
      console.log('SW registration skipped:', err),
    );
  }
}