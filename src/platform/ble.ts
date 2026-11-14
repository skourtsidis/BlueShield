import { Capacitor } from '@capacitor/core';
import { BleClient, ScanMode, type ScanResult } from '@capacitor-community/bluetooth-le';
import type { DeviceTag, DeviceType, RiskLevel } from '../types';
import { analyzeName } from '../lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Normalized BLE advertisement (from native Capacitor plugin or Web Bluetooth). */
export interface LiveAdvert {
  id: string;
  name: string | null;
  rssi: number;
  txPower?: number;
  mfr: Record<number, Uint8Array>;
  svc: Record<string, Uint8Array>;
  uuids: string[];
  t: number;
}

export interface Classification {
  type: DeviceType;
  label: string;
  manufacturer: string;
  risk: RiskLevel;
  reason: string;
  tags: DeviceTag[];
  services: string[];
}

const COMPANY: Record<number, string> = {
  0x004c: 'Apple',
  0x0075: 'Samsung',
  0x00e0: 'Google',
  0x0006: 'Microsoft',
  0x0087: 'Garmin',
  0x0157: 'Huami (Amazfit)',
  0x038f: 'Xiaomi',
  0x027d: 'Huawei',
  0x0059: 'Nordic Semiconductor',
  0x02e5: 'Espressif',
  0x000d: 'Texas Instruments',
  0x0499: 'Ruuvi',
  0x0171: 'Amazon',
  0x009e: 'Bose',
  0x0057: 'Harman (JBL)',
  0x012d: 'Sony',
  0x0002: 'Intel',
  0x000a: 'Qualcomm',
  0x0131: 'Cypress',
};

export const normUuid = (u: string) => {
  const s = String(u).toLowerCase();
  const m = s.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
  return m ? m[1] : s;
};

const SERVICE_NAMES: Record<string, string> = {
  '1800': 'Generic Access',
  '1801': 'Generic Attribute',
  '180a': 'Device Information',
  '180f': 'Battery Service',
  '180d': 'Heart Rate',
  '1812': 'HID (keyboard/mouse)',
  '181a': 'Environmental Sensing',
  '1805': 'Current Time',
  fe2c: 'Google Fast Pair',
  feaa: 'Eddystone / Find My Device',
  fd5a: 'Samsung SmartTag',
  feed: 'Tile',
  feec: 'Tile',
  fe95: 'Xiaomi Mi',
  fe9f: 'Google',
  fd6f: 'Exposure Notification',
};
export const serviceName = (u: string) => SERVICE_NAMES[normUuid(u)] || normUuid(u).toUpperCase();

/** Classifies a BLE advertisement (including real-world tracker/beacon frames). */
export function classifyAdvert(a: LiveAdvert): Classification {
  const services = Array.from(new Set([...Object.keys(a.svc), ...a.uuids])).map(serviceName);
  const companyIds = Object.keys(a.mfr).map(Number);
  const manufacturer = companyIds.length
    ? COMPANY[companyIds[0]] || `Vendor 0x${companyIds[0].toString(16).padStart(4, '0').toUpperCase()}`
    : 'Unknown';
  const name = a.name || '';
  const res = (type: DeviceType, label: string, risk: RiskLevel, reason: string, tags: DeviceTag[] = []): Classification => ({
    type,
    label,
    manufacturer,
    risk,
    reason,
    tags,
    services,
  });

  const apple = a.mfr[0x004c];
  if (apple && apple.length > 0) {
    const t = apple[0];
    if (t === 0x12)
      return res('tracker', 'Apple Find My (e.g. AirTag)', 'medium', 'Separated Find My accessory (e.g. AirTag). If it keeps appearing near you over time, it may be tracking you.', ['tracker']);
    if (t === 0x02 && apple[1] === 0x15)
      return res('beacon', 'iBeacon', 'low', 'Indoor positioning beacon (iBeacon). Retail apps can log your presence here.', ['beacon']);
    if (t === 0x07) return res('headphones', 'AirPods / Beats', 'safe', 'Apple audio accessory in proximity/pairing broadcast.');
    if (t === 0x10) return res('phone', 'Apple device', 'safe', 'iPhone/iPad/Mac using a randomized address — normal behavior.');
  }
  const svcKeys = new Set([...Object.keys(a.svc), ...a.uuids]);
  if (svcKeys.has('fd5a')) return res('tracker', 'Samsung SmartTag', 'medium', 'Samsung SmartTag tracker. Watch whether it follows you across locations.', ['tracker']);
  if (svcKeys.has('feed') || svcKeys.has('feec')) return res('tracker', 'Tile tracker', 'medium', 'Tile tracker. Watch whether it follows you across locations.', ['tracker']);
  if (svcKeys.has('feaa')) {
    const frame = a.svc['feaa']?.[0];
    if (frame === 0x40 || frame === 0x41)
      return res('tracker', 'Google Find My Device tracker', 'medium', 'Tracker on Google’s Find My Device network.', ['tracker']);
    return res('beacon', 'Eddystone beacon', 'low', 'Eddystone indoor location beacon.', ['beacon']);
  }
  if (/flipper/i.test(name))
    return res('tool', 'Flipper Zero', 'high', 'Wireless hacking multi-tool (Flipper Zero). Can broadcast BLE connection-popup spam floods.', ['hacktool', 'suspicious']);
  if (/^HC-0[56]/i.test(name) || a.mfr[0x02e5] || /esp32|esp_/i.test(name))
    return res('tool', 'Development board', 'medium', 'Generic microcontroller/Bluetooth module (ESP32/HC-05). Common in DIY projects — and custom attack tools.', ['suspicious']);
  if (/(free|gift|prize|win|promo|bonus|winner)/i.test(name))
    return res('unknown', 'Suspicious lure name', 'high', 'Bait-style broadcast name typical of Bluejacking / phishing lures.', ['suspicious']);
  if (svcKeys.has('180d')) return res('fitness', 'Heart-rate sensor', 'low', 'Fitness peripheral advertising Heart Rate Service — often unencrypted.');
  if (svcKeys.has('1812')) return res('keyboard', 'HID input device', 'low', 'Wireless keyboard/mouse (HID). Make sure it belongs to you.');
  if (svcKeys.has('fe2c')) return res('headphones', 'Google Fast Pair', 'safe', 'Accessory supporting Google Fast Pair.');

  const lower = name.toLowerCase();
  let type: DeviceType = 'unknown';
  if (/(buds|airpods|wh-|wf-|headset|qc\d|jabra|beats|earbuds|bose)/.test(lower)) type = 'headphones';
  else if (/(jbl|speaker|soundlink|flip|charge|boom)/.test(lower)) type = 'speaker';
  else if (/(watch|band|amazfit|garmin|fitbit|mi smart)/.test(lower)) type = 'watch';
  else if (/(\[tv\]|bravia|tv|chromecast|roku)/.test(lower)) type = 'tv';
  else if (/(car|toyota|vw|bmw|audi|ford|mercedes|kia|hyundai|opel|peugeot|renault|skoda|nissan|mazda)/.test(lower)) type = 'car';
  else if (/(keyboard|keys|mouse|k380|mx )/.test(lower)) type = 'keyboard';
  else if (/(macbook|laptop|desktop|pc|thinkpad)/.test(lower)) type = 'laptop';
  else if (/(iphone|galaxy|pixel|redmi|xiaomi|oneplus|phone|android)/.test(lower)) type = 'phone';

  if (!name) return res(type, 'Anonymous BLE device', 'safe', 'Unnamed BLE device with a randomized address — most likely a nearby phone. Normal.');
  const leak = analyzeName(name).level !== 'safe';
  return res(
    type,
    name,
    leak ? 'low' : 'safe',
    leak ? 'Broadcast name reveals personal details or exact device model.' : 'Ordinary Bluetooth device with no risk indicators.',
  );
}

/* ----------------------------- Scan buffer ----------------------------- */
const buffer = new Map<string, LiveAdvert>();
export function drainLiveBuffer(): LiveAdvert[] {
  const arr = Array.from(buffer.values());
  buffer.clear();
  return arr;
}
const pushAdvert = (a: LiveAdvert) => buffer.set(a.id, a);

const dvToU8 = (dv: DataView) => new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);

/* ----------------------------- Native (APK) ----------------------------- */
export const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

function fromScanResult(r: ScanResult): LiveAdvert {
  const mfr: Record<number, Uint8Array> = {};
  for (const [k, v] of Object.entries(r.manufacturerData || {})) {
    const id = k.startsWith('0x') ? parseInt(k, 16) : parseInt(k, 10);
    if (!Number.isNaN(id)) mfr[id] = dvToU8(v);
  }
  const svc: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(r.serviceData || {})) svc[normUuid(k)] = dvToU8(v);
  return {
    id: r.device.deviceId,
    name: r.localName || r.device.name || null,
    rssi: typeof r.rssi === 'number' ? r.rssi : -100,
    txPower: r.txPower,
    mfr,
    svc,
    uuids: (r.uuids || []).map(normUuid),
    t: Date.now(),
  };
}

export async function nativeInit(onEnabled: (enabled: boolean) => void): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await BleClient.initialize();
    onEnabled(await BleClient.isEnabled());
    await BleClient.startEnabledNotifications((v) => onEnabled(v));
    return true;
  } catch {
    return false;
  }
}

export async function nativeStartScan() {
  await BleClient.requestLEScan({ allowDuplicates: true, scanMode: ScanMode.SCAN_MODE_LOW_LATENCY }, (r) => pushAdvert(fromScanResult(r)));
}
export async function nativeStopScan() {
  try {
    await BleClient.stopLEScan();
  } catch {
    /* ignore */
  }
}
export async function nativeRequestEnable() {
  try {
    await BleClient.requestEnable();
  } catch {
    /* ignore */
  }
}
export async function nativeOpenSettings() {
  try {
    await BleClient.openBluetoothSettings();
  } catch {
    /* ignore */
  }
}
export async function nativeBonded(): Promise<{ id: string; name: string }[]> {
  try {
    const list = await BleClient.getBondedDevices();
    return list.map((d) => ({ id: d.deviceId, name: d.name || 'Unnamed device' }));
  } catch {
    return [];
  }
}

/* ----------------------------- Web Bluetooth ----------------------------- */
let webScanHandle: any = null;
let webHandler: ((ev: any) => void) | null = null;

export async function webStartScan() {
  const bt = (navigator as any).bluetooth;
  if (!bt?.requestLEScan) throw new Error('BLE scanning is not supported here. Enable chrome://flags/#enable-experimental-web-platform-features');
  webHandler = (ev: any) => {
    const mfr: Record<number, Uint8Array> = {};
    ev.manufacturerData?.forEach((dv: DataView, key: number) => (mfr[key] = dvToU8(dv)));
    const svc: Record<string, Uint8Array> = {};
    ev.serviceData?.forEach((dv: DataView, key: string) => (svc[normUuid(key)] = dvToU8(dv)));
    pushAdvert({
      id: ev.device?.id || String(Math.random()),
      name: ev.name || ev.device?.name || null,
      rssi: typeof ev.rssi === 'number' ? ev.rssi : -100,
      txPower: typeof ev.txPower === 'number' ? ev.txPower : undefined,
      mfr,
      svc,
      uuids: (ev.uuids || []).map(normUuid),
      t: Date.now(),
    });
  };
  bt.addEventListener('advertisementreceived', webHandler);
  webScanHandle = await bt.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: true });
}

export function webStopScan() {
  const bt = (navigator as any).bluetooth;
  try {
    webScanHandle?.stop?.();
  } catch {
    /* ignore */
  }
  if (bt && webHandler) bt.removeEventListener('advertisementreceived', webHandler);
  webScanHandle = null;
  webHandler = null;
}

export interface InspectItem {
  label: string;
  value: string;
  status: 'leak' | 'protected' | 'info' | 'absent';
  note: string;
}
export interface InspectResult {
  name: string;
  id: string;
  items: InspectItem[];
  services: string[];
  error?: string;
}

/** Real BLE GATT information-leak inspection via Web Bluetooth. */
export async function inspectWebDevice(): Promise<InspectResult> {
  const bt = (navigator as any).bluetooth;
  if (!bt?.requestDevice) throw new Error('Web Bluetooth is not supported in this browser.');
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['battery_service', 'device_information', 'heart_rate', 'generic_access', 'environmental_sensing', 'current_time'],
  });
  const res: InspectResult = { name: device.name || 'Unnamed device', id: device.id, items: [], services: [] };
  const nameLeak = device.name ? analyzeName(device.name) : null;
  res.items.push({
    label: 'Broadcast name',
    value: device.name || '— (no name advertised)',
    status: nameLeak && nameLeak.level !== 'safe' ? 'leak' : 'info',
    note: nameLeak && nameLeak.level !== 'safe' ? nameLeak.issues[0] : 'Broadcast name does not expose sensitive personal info.',
  });

  const isProtected = (e: any) => /security|auth|encrypt|insufficient|notallowed|not permitted|gatt operation failed/i.test(String(e?.name) + ' ' + String(e?.message));
  try {
    const server = await device.gatt.connect();
    const services: any[] = await server.getPrimaryServices().catch(() => []);
    res.services = services.map((s) => serviceName(s.uuid));

    const tryRead = async (svc: string, ch: string, label: string, fmt: (dv: DataView) => string, leakNote: string) => {
      let service: any;
      try {
        service = await server.getPrimaryService(svc);
      } catch {
        res.items.push({ label, value: '—', status: 'absent', note: 'Device does not expose this service.' });
        return;
      }
      try {
        const c = await service.getCharacteristic(ch);
        const v: DataView = await c.readValue();
        res.items.push({ label, value: fmt(v), status: 'leak', note: leakNote });
      } catch (e) {
        res.items.push({
          label,
          value: isProtected(e) ? 'Locked' : '—',
          status: isProtected(e) ? 'protected' : 'absent',
          note: isProtected(e) ? 'Requires encryption/pairing to read — good security practice ✓' : 'Characteristic unavailable.',
        });
      }
    };
    const text = (dv: DataView) => new TextDecoder().decode(dv).replace(/\0/g, '').trim() || '—';

    await tryRead('battery_service', 'battery_level', 'Battery level', (dv) => `${dv.getUint8(0)}%`,
      'Readable without pairing — can be used for device fingerprinting and tracking.');
    await tryRead('device_information', 'manufacturer_name_string', 'Manufacturer', text, 'Reveals the hardware vendor to anyone within radio range.');
    await tryRead('device_information', 'model_number_string', 'Model number', text, 'Reveals the exact model — helping an attacker look up known CVEs.');
    await tryRead('device_information', 'firmware_revision_string', 'Firmware version', text,
      'Tells an attacker whether the firmware is outdated and vulnerable (e.g. BrakTooth).');
    await tryRead('device_information', 'software_revision_string', 'Software version', text, 'Exposes the exact software revision.');
    try {
      device.gatt.disconnect();
    } catch {
      /* ignore */
    }
  } catch (e: any) {
    res.error = `Could not establish GATT connection (${e?.message || 'unknown error'}). Some devices refuse unauthenticated GATT connections.`;
  }
  return res;
}
