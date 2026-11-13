import { Capacitor } from '@capacitor/core';
import { BleClient, ScanMode, type ScanResult } from '@capacitor-community/bluetooth-le';
import type { DeviceTag, DeviceType, RiskLevel } from '../types';
import { analyzeName } from '../lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Κανονικοποιημένη διαφήμιση BLE (από native plugin ή Web Bluetooth). */
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
  '1812': 'HID (πληκτρολόγιο/ποντίκι)',
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

/** Αναγνώριση τύπου συσκευής/trackers από τα δεδομένα διαφήμισης (πραγματικά πρότυπα). */
export function classifyAdvert(a: LiveAdvert): Classification {
  const services = Array.from(new Set([...Object.keys(a.svc), ...a.uuids])).map(serviceName);
  const companyIds = Object.keys(a.mfr).map(Number);
  const manufacturer = companyIds.length
    ? COMPANY[companyIds[0]] || `Κατασκευαστής 0x${companyIds[0].toString(16).padStart(4, '0').toUpperCase()}`
    : 'Άγνωστος';
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
      return res('tracker', 'Apple Find My (π.χ. AirTag)', 'medium', 'Αξεσουάρ Find My μακριά από τον κάτοχό του (π.χ. AirTag). Αν εμφανίζεται συνεχώς κοντά σας, μπορεί να σας παρακολουθεί.', ['tracker']);
    if (t === 0x02 && apple[1] === 0x15)
      return res('beacon', 'iBeacon', 'low', 'Beacon εντοπισμού θέσης (iBeacon). Εφαρμογές καταστημάτων μπορούν να καταγράφουν την παρουσία σας.', ['beacon']);
    if (t === 0x07) return res('headphones', 'AirPods / Beats', 'safe', 'Ακουστικά Apple σε λειτουργία σύζευξης/εγγύτητας.');
    if (t === 0x10) return res('phone', 'Συσκευή Apple', 'safe', 'iPhone/iPad/Mac με τυχαία διεύθυνση — φυσιολογικό.');
  }
  const svcKeys = new Set([...Object.keys(a.svc), ...a.uuids]);
  if (svcKeys.has('fd5a')) return res('tracker', 'Samsung SmartTag', 'medium', 'Tracker Samsung SmartTag. Παρακολουθήστε αν σας ακολουθεί.', ['tracker']);
  if (svcKeys.has('feed') || svcKeys.has('feec')) return res('tracker', 'Tile tracker', 'medium', 'Tracker Tile. Παρακολουθήστε αν σας ακολουθεί σε διαφορετικά μέρη.', ['tracker']);
  if (svcKeys.has('feaa')) {
    const frame = a.svc['feaa']?.[0];
    if (frame === 0x40 || frame === 0x41)
      return res('tracker', 'Google Find My Device tracker', 'medium', 'Tracker του δικτύου Find My Device της Google.', ['tracker']);
    return res('beacon', 'Eddystone beacon', 'low', 'Beacon Eddystone για εντοπισμό θέσης σε εσωτερικούς χώρους.', ['beacon']);
  }
  if (/flipper/i.test(name))
    return res('tool', 'Flipper Zero', 'high', 'Εργαλείο hacking (Flipper Zero). Μπορεί να στέλνει μαζικά ψεύτικα αιτήματα σύνδεσης (BLE spam).', ['hacktool', 'suspicious']);
  if (/^HC-0[56]/i.test(name) || a.mfr[0x02e5] || /esp32|esp_/i.test(name))
    return res('tool', 'Πλακέτα ανάπτυξης', 'medium', 'Γενικό module/πλακέτα (ESP32/HC-05). Συχνό σε πειράματα — αλλά και σε εργαλεία επιθέσεων.', ['suspicious']);
  if (/(free|gift|prize|win|promo|δώρο|κέρδ|δωρεάν)/i.test(name))
    return res('unknown', 'Ύποπτο όνομα', 'high', 'Το «δελεαστικό» όνομα είναι τυπικό για bluejacking/phishing.', ['suspicious']);
  if (svcKeys.has('180d')) return res('fitness', 'Αισθητήρας παλμών', 'low', 'Συσκευή fitness που εκπέμπει υπηρεσία καρδιακών παλμών — συχνά χωρίς κρυπτογράφηση.');
  if (svcKeys.has('1812')) return res('keyboard', 'Συσκευή HID', 'low', 'Πληκτρολόγιο/ποντίκι (HID). Βεβαιωθείτε ότι είναι δικό σας.');
  if (svcKeys.has('fe2c')) return res('headphones', 'Google Fast Pair', 'safe', 'Αξεσουάρ που υποστηρίζει Google Fast Pair.');

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

  if (!name) return res(type, 'Ανώνυμη συσκευή BLE', 'safe', 'Ανώνυμη συσκευή με τυχαία διεύθυνση — πιθανότατα κινητό. Φυσιολογικό.');
  const leak = analyzeName(name).level !== 'safe';
  return res(
    type,
    name,
    leak ? 'low' : 'safe',
    leak ? 'Το όνομα που εκπέμπει αποκαλύπτει προσωπικά στοιχεία ή μοντέλο.' : 'Συνηθισμένη συσκευή χωρίς ενδείξεις κινδύνου.',
  );
}

/* ----------------------------- Buffer σάρωσης ----------------------------- */
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
    return list.map((d) => ({ id: d.deviceId, name: d.name || 'Χωρίς όνομα' }));
  } catch {
    return [];
  }
}

/* ----------------------------- Web Bluetooth ----------------------------- */
let webScanHandle: any = null;
let webHandler: ((ev: any) => void) | null = null;

export async function webStartScan() {
  const bt = (navigator as any).bluetooth;
  if (!bt?.requestLEScan) throw new Error('Η σάρωση BLE δεν υποστηρίζεται. Ενεργοποιήστε το chrome://flags/#enable-experimental-web-platform-features');
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

/** Πραγματικός έλεγχος διαρροής πληροφοριών μιας συσκευής BLE (Web Bluetooth). */
export async function inspectWebDevice(): Promise<InspectResult> {
  const bt = (navigator as any).bluetooth;
  if (!bt?.requestDevice) throw new Error('Το Web Bluetooth δεν υποστηρίζεται σε αυτόν τον browser.');
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['battery_service', 'device_information', 'heart_rate', 'generic_access', 'environmental_sensing', 'current_time'],
  });
  const res: InspectResult = { name: device.name || 'Χωρίς όνομα', id: device.id, items: [], services: [] };
  const nameLeak = device.name ? analyzeName(device.name) : null;
  res.items.push({
    label: 'Όνομα που εκπέμπει',
    value: device.name || '— (δεν εκπέμπει όνομα)',
    status: nameLeak && nameLeak.level !== 'safe' ? 'leak' : 'info',
    note: nameLeak && nameLeak.level !== 'safe' ? nameLeak.issues[0] : 'Το όνομα δεν αποκαλύπτει ευαίσθητα στοιχεία.',
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
        res.items.push({ label, value: '—', status: 'absent', note: 'Η συσκευή δεν διαθέτει αυτή την υπηρεσία.' });
        return;
      }
      try {
        const c = await service.getCharacteristic(ch);
        const v: DataView = await c.readValue();
        res.items.push({ label, value: fmt(v), status: 'leak', note: leakNote });
      } catch (e) {
        res.items.push({
          label,
          value: isProtected(e) ? 'Κλειδωμένο' : '—',
          status: isProtected(e) ? 'protected' : 'absent',
          note: isProtected(e) ? 'Απαιτεί κρυπτογράφηση/σύζευξη για ανάγνωση — σωστή πρακτική ✓' : 'Μη διαθέσιμο χαρακτηριστικό.',
        });
      }
    };
    const text = (dv: DataView) => new TextDecoder().decode(dv).replace(/\0/g, '').trim() || '—';

    await tryRead('battery_service', 'battery_level', 'Επίπεδο μπαταρίας', (dv) => `${dv.getUint8(0)}%`,
      'Διαβάζεται χωρίς σύζευξη — μπορεί να χρησιμοποιηθεί για fingerprinting και παρακολούθηση.');
    await tryRead('device_information', 'manufacturer_name_string', 'Κατασκευαστής', text, 'Αποκαλύπτει τον κατασκευαστή σε όποιον βρίσκεται κοντά.');
    await tryRead('device_information', 'model_number_string', 'Μοντέλο', text, 'Αποκαλύπτει το ακριβές μοντέλο — άρα και πιθανές ευπάθειες.');
    await tryRead('device_information', 'firmware_revision_string', 'Έκδοση firmware', text,
      'Ένας επιτιθέμενος μαθαίνει αν το firmware είναι παλιό και ευάλωτο (π.χ. BrakTooth).');
    await tryRead('device_information', 'software_revision_string', 'Έκδοση λογισμικού', text, 'Αποκαλύπτει την έκδοση λογισμικού.');
    try {
      device.gatt.disconnect();
    } catch {
      /* ignore */
    }
  } catch (e: any) {
    res.error = `Δεν ήταν δυνατή η σύνδεση GATT (${e?.message || 'άγνωστο σφάλμα'}). Ορισμένες συσκευές δεν δέχονται συνδέσεις.`;
  }
  return res;
}
