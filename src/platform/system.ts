import { Capacitor } from '@capacitor/core';
import type { Capabilities, SystemInfo } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const nav = (): any => (typeof navigator !== 'undefined' ? navigator : {});

export function detectCapabilities(): Capabilities {
  const n = nav();
  let native = false;
  let platform: Capabilities['platform'] = 'web';
  try {
    native = Capacitor.isNativePlatform();
    const p = Capacitor.getPlatform();
    platform = p === 'android' ? 'android' : p === 'ios' ? 'ios' : 'web';
  } catch {
    native = false;
  }
  const hasWindow = typeof window !== 'undefined';
  return {
    native,
    platform,
    webBluetooth: !native && !!n.bluetooth,
    leScan: !native && !!n.bluetooth && typeof n.bluetooth.requestLEScan === 'function',
    battery: typeof n.getBattery === 'function',
    geolocation: !!n.geolocation,
    notifications: hasWindow && 'Notification' in window && !native,
    vibrate: typeof n.vibrate === 'function',
    standalone:
      (hasWindow && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || n.standalone === true,
  };
}

function detectBrowser(ua: string) {
  const tests: [RegExp, string][] = [
    [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
    [/EdgA?\/(\d+)/, 'Edge'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ];
  for (const [re, name] of tests) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return 'Άγνωστος browser';
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const n = nav();
  const ua: string = n.userAgent || '';
  let os: SystemInfo['os'] = 'other';
  let osName = 'Άγνωστο';
  let version: string | null = null;
  let model: string | null = null;
  let live = false;
  const browser = Capacitor.isNativePlatform() ? 'Εφαρμογή Android (WebView)' : detectBrowser(ua);

  try {
    if (n.userAgentData?.getHighEntropyValues) {
      const v = await n.userAgentData.getHighEntropyValues(['platform', 'platformVersion', 'model']);
      const platform = String(v.platform || '').toLowerCase();
      if (platform === 'android') {
        os = 'android';
        osName = 'Android';
        version = v.platformVersion || null;
        model = v.model || null;
        live = true;
      } else if (platform) {
        os = 'desktop';
        osName = v.platform;
        live = true;
      }
    }
  } catch {
    /* ignore */
  }

  if (os === 'other') {
    const a = ua.match(/Android\s([\d.]+)/);
    const i = ua.match(/(?:iPhone|iPad|iPod).*?OS\s([\d_]+)/);
    if (a) {
      os = 'android';
      osName = 'Android';
      version = a[1];
      const mm = ua.match(/Android [\d.]+; ([^;)]+)/);
      model = mm?.[1]?.trim() || null;
      // Chrome "UA reduction": "Android 10; K" δεν είναι η πραγματική έκδοση
      if (version === '10' && model === 'K') {
        version = null;
        model = null;
      }
      live = !!version;
    } else if (i) {
      os = 'ios';
      osName = 'iOS';
      version = i[1].replace(/_/g, '.');
      model = /iPad/.test(ua) ? 'iPad' : 'iPhone';
      live = true;
    } else {
      os = 'desktop';
      osName = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Υπολογιστής';
      live = true;
    }
  }

  const major = version ? parseInt(version, 10) || null : null;
  let support: SystemInfo['support'] = 'unknown';
  let supportText = 'Δεν ήταν δυνατό να προσδιοριστεί η έκδοση του λειτουργικού. Ελέγξτε χειροκίνητα για ενημερώσεις.';
  if (os === 'android' && major) {
    if (major >= 13) {
      support = 'ok';
      supportText = `Το Android ${major} λαμβάνει ακόμη ενημερώσεις ασφαλείας (εφόσον τις διανέμει ο κατασκευαστής σας).`;
    } else if (major === 12) {
      support = 'warn';
      supportText = 'Το Android 12 έχει φτάσει στο τέλος της υποστήριξης. Ελέγξτε αν ο κατασκευαστής στέλνει ακόμη ενημερώσεις.';
    } else {
      support = 'fail';
      supportText = `Το Android ${major} δεν λαμβάνει πλέον ενημερώσεις ασφαλείας. Κρατάτε το Bluetooth κλειστό όσο γίνεται.`;
    }
  } else if (os === 'ios' && major) {
    if (major >= 18) {
      support = 'ok';
      supportText = `Το iOS ${major} λαμβάνει ενημερώσεις ασφαλείας.`;
    } else if (major >= 16) {
      support = 'warn';
      supportText = `Το iOS ${major} λαμβάνει περιορισμένες ενημερώσεις. Αναβαθμίστε αν γίνεται.`;
    } else {
      support = 'fail';
      supportText = `Το iOS ${major} δεν λαμβάνει πλέον ενημερώσεις ασφαλείας.`;
    }
  } else if (os === 'desktop') {
    supportText = 'Η εφαρμογή απευθύνεται σε κινητά Android. Σε υπολογιστή, τα δεδομένα συσκευών και επιθέσεων είναι προσομοίωση.';
  }

  return { os, osName, version, major, model, browser, support, supportText, live };
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

let lastNotify = 0;
export async function showNotification(title: string, body: string, force = false) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();
    if (!force && now - lastNotify < 30000) return;
    lastNotify = now;
    const opts: any = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'blueshield', vibrate: [120, 60, 120] };
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(title, opts);
      return;
    }
    new Notification(title, opts);
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    nav().vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export async function startBattery(cb: (level: number, charging: boolean) => void): Promise<(() => void) | null> {
  const n = nav();
  if (typeof n.getBattery !== 'function') return null;
  try {
    const b = await n.getBattery();
    const emit = () => cb(Math.round(b.level * 1000) / 10, !!b.charging);
    emit();
    b.addEventListener('levelchange', emit);
    b.addEventListener('chargingchange', emit);
    return () => {
      b.removeEventListener('levelchange', emit);
      b.removeEventListener('chargingchange', emit);
    };
  } catch {
    return null;
  }
}

export function getPosition(): Promise<{ lat: number; lon: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!nav().geolocation) return reject(new Error('Η γεωθεσία δεν υποστηρίζεται σε αυτή τη συσκευή.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? 'Δεν δόθηκε άδεια τοποθεσίας.' : 'Δεν ήταν δυνατός ο εντοπισμός θέσης.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
