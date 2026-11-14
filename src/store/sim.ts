import type { DeviceTag, DeviceType, IncomingRequest, LocationCtx, ModuleId, NearbyDevice, PairedDevice, RiskLevel, Severity } from '../types';
import { chance, hashAngle, maskMac, pick, rand, randHex, randInt, randomMac, uid } from '../lib/utils';

interface Tpl {
  name: string | null;
  type: DeviceType;
  protocol: 'classic' | 'ble';
  manufacturer: string;
  macType: 'public' | 'random' | 'rpa';
  rssi: number;
  risk: RiskLevel;
  reason: string;
  tags?: DeviceTag[];
  encrypted?: boolean | null;
  services?: string[];
  follow?: boolean;
  label?: string;
}

const PHONE = (manufacturer: string, rssi: number): Tpl => ({
  name: null,
  type: 'phone',
  protocol: 'ble',
  manufacturer,
  macType: 'rpa',
  rssi,
  risk: 'safe',
  label: 'Anonymous phone',
  reason: 'Smartphone using a Resolvable Private Address (RPA). Normal behavior — its owner’s privacy is protected.',
});

const OWN: Tpl[] = [
  { name: 'Galaxy Buds2 Pro', type: 'headphones', protocol: 'ble', manufacturer: 'Samsung', macType: 'public', rssi: -44, risk: 'safe', reason: 'Your own trusted accessory (paired, Secure Connections).', encrypted: true, services: ['Audio Sink (A2DP)', 'Hands-Free (HFP)'], tags: ['trusted'] },
  { name: 'Mi Smart Band 7', type: 'fitness', protocol: 'ble', manufacturer: 'Xiaomi', macType: 'public', rssi: -52, risk: 'medium', reason: 'Your fitness band, but it transmits data without encryption — vulnerable to Bluetooth sniffing.', encrypted: false, services: ['Heart Rate', 'Battery Service', 'Xiaomi Mi (FE95)'], tags: ['unencrypted'] },
];

const POOLS: Record<LocationCtx, Tpl[]> = {
  home: [
    ...OWN,
    { name: '[TV] Samsung 7 Series', type: 'tv', protocol: 'ble', manufacturer: 'Samsung', macType: 'public', rssi: -74, risk: 'low', reason: 'Neighbor’s smart TV. Broadcasts its public name and exact model.', services: ['Generic Access'] },
    { name: 'LE-Bose QC45', type: 'headphones', protocol: 'ble', manufacturer: 'Bose', macType: 'public', rssi: -86, risk: 'safe', reason: 'Neighbor’s headphones in standby/discovery broadcast.' },
    PHONE('Apple', -82),
  ],
  work: [
    ...OWN,
    { name: 'Logitech MX Keys', type: 'keyboard', protocol: 'ble', manufacturer: 'Logitech', macType: 'random', rssi: -55, risk: 'safe', reason: 'Encrypted office wireless keyboard.', services: ['HID'] },
    { name: 'DESKTOP-7Q2LK', type: 'laptop', protocol: 'classic', manufacturer: 'Intel', macType: 'public', rssi: -66, risk: 'low', reason: 'Coworker’s workstation; hostname exposes internal IT naming.' },
    { name: 'Jabra Evolve2 65', type: 'headphones', protocol: 'ble', manufacturer: 'Jabra', macType: 'public', rssi: -71, risk: 'safe', reason: 'Office headset.' },
    { name: 'HC-05', type: 'tool', protocol: 'classic', manufacturer: 'Unknown', macType: 'public', rssi: -80, risk: 'medium', reason: 'Generic serial Bluetooth module (DIY) with default PIN 1234 — seen in hobby projects and custom attack rigs.', tags: ['suspicious'], encrypted: false },
    PHONE('Google', -69),
    PHONE('Samsung', -77),
  ],
  public: [
    ...OWN,
    { name: 'Beacon_Mall_17', type: 'beacon', protocol: 'ble', manufacturer: 'Kontakt.io', macType: 'public', rssi: -70, risk: 'low', reason: 'Retail advertising beacon (iBeacon) — store apps can log your indoor location.', tags: ['beacon'], services: ['iBeacon'] },
    { name: null, type: 'beacon', protocol: 'ble', manufacturer: 'Google', macType: 'random', rssi: -78, risk: 'low', label: 'Eddystone beacon', reason: 'Eddystone beacon used for indoor positioning.', tags: ['beacon'], services: ['Eddystone (FEAA)'] },
    { name: 'Flipper Zx7r', type: 'tool', protocol: 'ble', manufacturer: 'Flipper Devices', macType: 'random', rssi: -67, risk: 'high', reason: 'Wireless hacking multi-tool (Flipper Zero). Capable of broadcasting mass fake BLE pairing popups (BLE spam).', tags: ['hacktool', 'suspicious'] },
    { name: 'Free_Music_Share', type: 'phone', protocol: 'classic', manufacturer: 'MediaTek', macType: 'public', rssi: -64, risk: 'high', reason: 'Suspicious lure name — classic Bluejacking / phishing bait.', tags: ['suspicious'] },
    { name: 'JBL Flip 5', type: 'speaker', protocol: 'classic', manufacturer: 'Harman', macType: 'public', rssi: -81, risk: 'safe', reason: 'Someone’s portable speaker nearby.' },
    { name: 'Galaxy Watch5', type: 'watch', protocol: 'ble', manufacturer: 'Samsung', macType: 'rpa', rssi: -75, risk: 'safe', reason: 'Smartwatch using a randomized address.' },
    { name: 'Tile', type: 'tracker', protocol: 'ble', manufacturer: 'Tile', macType: 'random', rssi: -84, risk: 'low', reason: 'Tile tracker (0xFEED). Likely belongs to someone nearby; monitor whether it follows you.', tags: ['tracker'], services: ['Tile (FEED)'] },
    PHONE('Apple', -62),
    PHONE('Apple', -79),
    PHONE('Samsung', -71),
    PHONE('Xiaomi', -88),
    PHONE('Google', -84),
  ],
};

const EXTRA_PUBLIC: Tpl[] = [
  PHONE('Apple', -80),
  PHONE('Samsung', -85),
  PHONE('OnePlus', -76),
  { name: 'ESP32_HID', type: 'tool', protocol: 'ble', manufacturer: 'Espressif', macType: 'public', rssi: -73, risk: 'high', reason: 'ESP32 dev board impersonating a keyboard (HID) — often used for keystroke-injection attacks. Also affected by BrakTooth.', tags: ['suspicious'] },
  { name: 'AirPods Pro', type: 'headphones', protocol: 'ble', manufacturer: 'Apple', macType: 'rpa', rssi: -77, risk: 'safe', reason: 'Someone’s earbuds nearby.' },
  { name: 'Android_7F2C', type: 'phone', protocol: 'classic', manufacturer: 'Unknown', macType: 'public', rssi: -70, risk: 'medium', reason: 'Phone stuck in permanent discoverable mode with a static public MAC — could be outdated or configured for probing.', tags: ['suspicious'] },
];

export const FOLLOW_TRACKER: Tpl = {
  name: null,
  type: 'tracker',
  protocol: 'ble',
  manufacturer: 'Apple',
  macType: 'random',
  rssi: -56,
  risk: 'high',
  label: 'Unknown AirTag (Find My)',
  reason: 'Separated Find My tracker that has been traveling with you across multiple spots. It may have been slipped into your belongings!',
  tags: ['tracker', 'suspicious'],
  services: ['Find My (0x004C · type 0x12)'],
  follow: true,
};

export function spawnDevice(t: Tpl, now: number): NearbyDevice {
  const id = uid();
  const rssi = t.rssi + rand(-3, 3);
  return {
    id,
    name: t.name,
    type: t.type,
    mac: randomMac(t.macType),
    macType: t.macType,
    protocol: t.protocol,
    manufacturer: t.manufacturer,
    rssi,
    rssiBase: t.rssi,
    rssiHistory: [Math.round(rssi)],
    firstSeen: now - (t.follow ? randInt(11, 16) * 60000 : randInt(0, 240) * 1000),
    lastSeen: now,
    risk: t.risk,
    reason: t.reason,
    tags: t.tags || [],
    encrypted: t.encrypted ?? null,
    source: 'sim',
    services: t.services || [],
    angle: hashAngle(id),
    follow: t.follow,
    label: t.label,
  };
}

export function initialNearby(loc: LocationCtx, now: number) {
  return POOLS[loc].map((t) => spawnDevice(t, now));
}

export function randomExtra(loc: LocationCtx, now: number) {
  const pool = loc === 'public' ? [...EXTRA_PUBLIC, ...POOLS.public.slice(2)] : [PHONE('Apple', -84), PHONE('Samsung', -88)];
  return spawnDevice(pick(pool), now);
}

const D = 86400000;
export function initialPaired(now: number): PairedDevice[] {
  return [
    { id: 'p1', name: 'Galaxy Buds2 Pro', type: 'headphones', mac: 'A4:C6:9A:3B:1F:72', pairedAt: now - 210 * D, lastUsed: now, connected: true, secure: 'sc', encrypted: true, keyBytes: 16, trusted: true, note: 'Your earbuds', permissions: { contacts: false, messages: false, calls: true, files: false } },
    { id: 'p2', name: 'Mi Smart Band 7', type: 'fitness', mac: 'D8:3A:DD:51:0C:9E', pairedAt: now - 120 * D, lastUsed: now - 3600e3, connected: true, secure: 'legacy', encrypted: false, keyBytes: 7, trusted: true, note: 'Budget BLE band without encryption', permissions: { contacts: false, messages: true, calls: false, files: false } },
    { id: 'p3', name: 'Toyota Touch 2', type: 'car', mac: '00:1E:C0:7A:44:B1', pairedAt: now - 400 * D, lastUsed: now - 3 * D, connected: false, secure: 'sc', encrypted: true, keyBytes: 16, trusted: true, note: 'Your car', permissions: { contacts: true, messages: true, calls: true, files: false } },
    { id: 'p4', name: 'VW Polo (Hertz)', type: 'car', mac: '9C:8C:6E:12:F0:3A', pairedAt: now - 214 * D, lastUsed: now - 214 * D, connected: false, secure: 'legacy', encrypted: true, keyBytes: 7, trusted: true, note: 'Rental car', permissions: { contacts: true, messages: true, calls: true, files: false } },
    { id: 'p5', name: 'JBL Flip 4', type: 'speaker', mac: 'B8:F6:53:8E:21:C4', pairedAt: now - 700 * D, lastUsed: now - 128 * D, connected: false, secure: 'legacy', encrypted: true, keyBytes: 10, trusted: true, permissions: { contacts: false, messages: false, calls: false, files: false } },
    { id: 'p6', name: 'BT-200 Headset', type: 'headphones', mac: '00:0D:44:9B:7E:02', pairedAt: now - 1100 * D, lastUsed: now - 402 * D, connected: false, secure: 'legacy', encrypted: true, keyBytes: 7, trusted: true, note: 'Old headset', permissions: { contacts: true, messages: false, calls: true, files: false } },
    { id: 'p7', name: 'Work Laptop', type: 'laptop', mac: '3C:22:FB:90:6D:15', pairedAt: now - 300 * D, lastUsed: now - 12 * D, connected: false, secure: 'sc', encrypted: true, keyBytes: 16, trusted: true, permissions: { contacts: false, messages: false, calls: false, files: true } },
  ];
}

/* ------------------------------ Attacks ------------------------------ */

export interface AttackSpec {
  moduleId: ModuleId;
  severity: Severity;
  title: string;
  description: string;
  advice: string;
  device: string;
  mac: string;
  request?: { kind: IncomingRequest['kind']; detail: string; pin?: string; explanation: string };
  flood?: { pps: number; seconds: number };
  keyBytes?: number;
  trackerFollow?: boolean;
}

const ATTACKERS = ['BT_Device_3F', 'Galaxy_A52', 'ESP32_Test', 'Android_7F2C', 'JBL_Speaker_X', 'LE_Audio_Promo', 'DESKTOP-UB7X', 'iPhone', 'HC-05', 'Unknown'];
const LURES = [
  'Congratulations! You won a brand-new smartphone',
  'System Notice: Urgent Bluetooth security patch required',
  'Your package delivery is waiting — confirm your address',
  'Free Airport Wi-Fi: tap here to sign in',
];
const LINKS = ['win-smartphone.example', 'android-security-update.info', 'track-my-parcel.help', 'free-wifi-login.net'];

export interface AttackCtx {
  paired: PairedDevice[];
  nearby: NearbyDevice[];
  discoverable: boolean;
  dosThreshold: number;
  location: LocationCtx;
}

const pickAttacker = (ctx: AttackCtx) => {
  const sus = ctx.nearby.filter((d) => d.tags.includes('suspicious') && d.name);
  if (sus.length && chance(0.6)) {
    const d = pick(sus);
    return { name: d.name as string, mac: d.mac };
  }
  return { name: pick(ATTACKERS), mac: randomMac('public') };
};

export function generateAttack(id: ModuleId, ctx: AttackCtx): AttackSpec {
  const a = pickAttacker(ctx);
  switch (id) {
    case 'sniffing': {
      const unenc = ctx.paired.find((p) => !p.encrypted && p.connected) || ctx.paired.find((p) => !p.encrypted);
      if (unenc && chance(0.6))
        return {
          moduleId: id, severity: 'medium', device: unenc.name, mac: unenc.mac,
          title: 'Unencrypted BLE connection',
          description: `"${unenc.name}" is exchanging data (heart rate, steps, notifications) without encryption. Anyone nearby with a sniffer (e.g. Ubertooth One) can capture and read it.`,
          advice: 'Avoid using this accessory in public spaces or upgrade to a model that supports LE Secure Connections.',
        };
      return {
        moduleId: id, severity: 'high', device: a.name, mac: a.mac,
        title: '"Just Works" pairing request without PIN',
        description: `"${a.name}" attempted unauthenticated "Just Works" pairing. This method offers no MITM protection and makes key sniffing trivial.`,
        advice: 'Pair only with accessories you personally put into pairing mode, and only in a trusted location such as Home.',
        request: { kind: 'pair', detail: 'Requests pairing without passkey verification', explanation: 'You did not initiate this pairing. Accepting it allows a nearby attacker to intercept the link encryption key.' },
      };
    }
    case 'bluejacking': {
      if (!ctx.discoverable || chance(0.35)) {
        const n = randInt(40, 220);
        return {
          moduleId: id, severity: 'medium', device: `Flipper ${randHex(4)}`, mac: randomMac('random'),
          title: 'Fake BLE pairing-popup flood (BLE spam)',
          description: `Detected ${n} spoofed BLE advertisements in 10 seconds mimicking AirPods, watches, and TVs to spam connection popups onto nearby screens.`,
          advice: 'Never tap "Connect" on surprise popups. If they persist, turn Bluetooth off for a few minutes.',
        };
      }
      const lure = pick(LURES);
      const link = pick(LINKS);
      return {
        moduleId: id, severity: 'medium', device: a.name, mac: a.mac,
        title: 'Unsolicited contact card (vCard) with phishing link',
        description: `"${a.name}" pushed a contact card reading "${lure}" pointing to ${link}. This reached your phone because discoverable mode was enabled.`,
        advice: 'Never open links inside Bluetooth messages or vCards, and keep your phone non-discoverable.',
        request: { kind: 'vcard', detail: `File contact_${randInt(100, 999)}.vcf · "${lure}"`, explanation: 'This vCard embeds a phishing URL disguised as a system notice. You did not request it — reject it.' },
      };
    }
    case 'bluesnarfing': {
      const v = pick([
        { t: 'Contact phonebook access attempt (PBAP)', d: 'your contact list and call history', r: 'Contacts, Call history' },
        { t: 'SMS message access attempt (MAP)', d: 'your SMS text messages', r: 'SMS Messages' },
        { t: 'File-system browse attempt (OBEX FTP)', d: 'your photos and downloaded files', r: 'Photos, Downloads, Documents' },
      ]);
      return {
        moduleId: id, severity: 'high', device: a.name, mac: a.mac,
        title: v.t,
        description: `Unknown device "${a.name}" (${maskMac(a.mac)}) requested access to ${v.d} without being an authorized paired device.`,
        advice: 'Never grant contact, message, or file permissions to unknown devices. Review device permissions in the "Devices" tab.',
        request: { kind: 'access', detail: `Requests access to: ${v.r}`, explanation: 'This matches a Bluesnarfing attempt to steal personal data. An unknown device has no legitimate reason to read your contacts or messages.' },
      };
    }
    case 'bluebugging': {
      const v = pick([
        { t: 'Covert dial command (AT command)', d: `sent RFCOMM command "ATD+1900${randInt(1000000, 9999999)};" attempting to silently place an outbound call from your phone.` },
        { t: 'Covert SMS command (AT+CMGS)', d: 'attempted to silently send an SMS to a premium-rate number via AT+CMGS.' },
        { t: 'Silent microphone activation attempt', d: 'requested an unprompted Hands-Free (HFP) audio link that could eavesdrop on your room via the microphone.' },
      ]);
      return {
        moduleId: id, severity: 'critical', device: a.name, mac: a.mac,
        title: v.t,
        description: `Unverified device "${a.name}" ${v.d}`,
        advice: 'If you ever notice calls or texts you did not make, turn Bluetooth off immediately and audit your paired devices.',
      };
    }
    case 'blueborne':
      return chance(0.6)
        ? {
            moduleId: id, severity: 'critical', device: a.name, mac: a.mac,
            title: 'Malformed BNEP packet (BlueBorne pattern)',
            description: `Received an oversized BNEP control frame from "${a.name}" matching CVE-2017-0781 — requires neither pairing nor discoverable mode, only an active Bluetooth radio.`,
            advice: 'Make sure your Android security patches are current. Keep Bluetooth off when idle in public.',
          }
        : {
            moduleId: id, severity: 'high', device: a.name, mac: a.mac,
            title: 'SDP memory-disclosure probe (BlueBorne)',
            description: `"${a.name}" sent crafted SDP continuation requests (CVE-2017-0785 pattern) attempting to leak stack memory addresses ahead of exploitation.`,
            advice: 'OS security updates patch this flaw. If your phone is end-of-life, keep Bluetooth turned off.',
          };
    case 'knob': {
      if (chance(0.65)) {
        const p = ctx.paired.length ? pick(ctx.paired) : null;
        const dev = p?.name || a.name;
        return {
          moduleId: id, severity: 'high', device: dev, mac: p?.mac || a.mac, keyBytes: 1,
          title: 'Key-length downgrade to 1 byte (KNOB)',
          description: `While connecting with "${dev}", an attacker interfered with key negotiation and requested a 1-byte encryption key (256 values) instead of 16 bytes — classic KNOB attack (CVE-2019-9506).`,
          advice: 'Set KNOB Key Protection to ON with a 16-byte minimum and keep your OS updated.',
        };
      }
      const legacy = ctx.paired.find((p) => p.keyBytes < 16) || null;
      const dev = legacy?.name || a.name;
      return {
        moduleId: id, severity: 'low', device: dev, mac: legacy?.mac || a.mac, keyBytes: 7,
        title: 'Connection using a weak 7-byte key',
        description: `"${dev}" negotiated only a 7-byte (56-bit) encryption key. While compliant with the legacy minimum, it is far weaker than 16 bytes (128-bit).`,
        advice: 'Consider updating the accessory firmware or replacing older legacy Bluetooth gear.',
      };
    }
    case 'bias': {
      const p = ctx.paired.length ? pick(ctx.paired) : null;
      const name = p?.name || 'AirPods Pro';
      return {
        moduleId: id, severity: 'high', device: name, mac: p?.mac || randomMac('public'),
        title: `Device impersonation: "${name}"`,
        description: `A device broadcasting the name and MAC (${maskMac(p?.mac || randomMac('public'))}) of "${name}" tried to connect, but its radio fingerprint did not match: different LMP version and unilateral role switch (BIAS pattern, CVE-2020-10135).`,
        advice: 'If your real accessory is powered off or at home, this is an impersonation attack. Remove unused devices from your saved list.',
      };
    }
    case 'braktooth':
      return chance(0.6)
        ? {
            moduleId: id, severity: 'high', device: a.name, mac: a.mac,
            title: 'Invalid LMP packet sequence (BrakTooth)',
            description: `Received a malformed/oversized LMP payload from "${a.name}" capable of crashing Bluetooth firmware or triggering code execution on unpatched chips (e.g. CVE-2021-28139).`,
            advice: 'Check for phone OS and accessory firmware updates. Toggle Bluetooth off and back on if it hangs.',
          }
        : {
            moduleId: id, severity: 'medium', device: a.name, mac: a.mac,
            title: 'Bluetooth controller deadlock probe',
            description: `"${a.name}" sent rapid Feature Response floods known to deadlock vulnerable Bluetooth SoC firmware.`,
            advice: 'If Bluetooth repeatedly stalls in crowded venues, turn it off and install available updates.',
          };
    case 'tracking': {
      if (ctx.location === 'public' && chance(0.45))
        return {
          moduleId: id, severity: 'low', device: 'Beacon_Mall_17', mac: randomMac('public'),
          title: 'Retail beacon logging indoor presence',
          description: `An iBeacon inside a ${pick(['clothing store', 'supermarket', 'shopping mall', 'coffee shop'])} is broadcasting nearby. Retail apps with Bluetooth permission can record when and where you visit.`,
          advice: 'Turn Bluetooth off in shopping malls when unused and review which apps hold "Nearby devices" permission.',
        };
      if (chance(0.55))
        return {
          moduleId: id, severity: 'high', device: 'Unknown AirTag', mac: randomMac('random'), trackerFollow: true,
          title: 'Unknown tracker is following you!',
          description: `An unknown ${pick(['Apple Find My tag (e.g. AirTag)', 'Samsung SmartTag', 'Tile tracker'])} has stayed close to you for ${randInt(11, 35)} minutes across multiple spots. Someone may have placed it in your belongings.`,
          advice: 'Open the Radar and tap "Locate" to find it using signal strength. Check your bag, pockets, and vehicle.',
        };
      return {
        moduleId: id, severity: 'medium', device: 'BLE Scanner', mac: randomMac('public'),
        title: 'BLE radio fingerprinting attempt',
        description: 'A nearby scanner is correlating your rotating MAC addresses using side-channel fields (TX power, battery level, broadcast name) to track you across address rotations.',
        advice: 'Use a neutral device name and turn Bluetooth off when you do not need it.',
      };
    }
    case 'dos': {
      const thr = ctx.dosThreshold;
      const pps = Math.round(rand(thr * 0.8, thr * 3));
      return {
        moduleId: id, severity: pps > 2 * thr ? 'high' : 'medium', device: a.name, mac: a.mac,
        flood: { pps, seconds: randInt(8, 15) },
        title: 'Bluesmack packet-flood attack (DoS)',
        description: `"${a.name}" is blasting ~${pps} L2CAP Echo packets/sec (600 bytes each). Your configured DoS threshold is ${thr} pkt/s.`,
        advice: 'If your phone lags or warms up, turn Bluetooth off. Setting Anti-DoS to ON blocks offending sources immediately.',
      };
    }
  }
}
