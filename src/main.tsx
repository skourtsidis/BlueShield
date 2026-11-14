import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App';
import { initPwa } from './platform/pwa';

initPwa();

// Service worker: offline caching & system notifications (browser PWA only, skipped inside native APK)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !Capacitor.isNativePlatform() && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
