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
  return 'Unknown browser';
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const n = nav();
  const ua: string = n.userAgent || '';
  let os: SystemInfo['os'] = 'other';
  let osName = 'Unknown';
  let version: string | null = null;
  let model: string | null = null;
  let live = false;
  const browser = Capacitor.isNativePlatform() ? 'Android App (WebView)' : detectBrowser(ua);

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
      // Chrome UA reduction: "Android 10; K" is not the real OS version
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
      osName = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Desktop';
      live = true;
    }
  }

  const major = version ? parseInt(version, 10) || null : null;
  let support: SystemInfo['support'] = 'unknown';
  let supportText = 'Could not determine exact OS version. Please check for software updates manually.';
  if (os === 'android' && major) {
    if (major >= 13) {
      support = 'ok';
      supportText = `Android ${major} still receives security updates (provided your device manufacturer delivers them).`;
    } else if (major === 12) {
      support = 'warn';
      supportText = 'Android 12 has reached end-of-support. Check whether your manufacturer still ships security patches.';
    } else {
      support = 'fail';
      supportText = `Android ${major} no longer receives security updates. Keep Bluetooth turned off whenever possible.`;
    }
  } else if (os === 'ios' && major) {
    if (major >= 18) {
      support = 'ok';
      supportText = `iOS ${major} receives active security updates.`;
    } else if (major >= 16) {
      support = 'warn';
      supportText = `iOS ${major} receives limited updates. Upgrade if your device supports it.`;
    } else {
      support = 'fail';
      supportText = `iOS ${major} no longer receives security updates.`;
    }
  } else if (os === 'desktop') {
    supportText = 'BlueShield is designed for Android phones. On desktop, nearby devices and attacks run in simulation mode.';
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
    if (!nav().geolocation) return reject(new Error('Geolocation is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied.' : 'Could not determine your location.')),
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
