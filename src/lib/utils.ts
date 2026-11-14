export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const rand = (min: number, max: number) => Math.random() * (max - min) + min;
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const chance = (p: number) => Math.random() < p;

export function weightedPick<T extends string>(weights: Record<T, number>): T | null {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((a, [, w]) => a + Math.max(0, w), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

const hex = '0123456789ABCDEF';
export const randHex = (n: number) => Array.from({ length: n }, () => hex[randInt(0, 15)]).join('');

/** Generates a MAC address. Resolvable Private Addresses (RPA) set the top two bits to 01. */
export function randomMac(kind: 'public' | 'random' | 'rpa' = 'public') {
  const bytes = Array.from({ length: 6 }, () => randInt(0, 255));
  if (kind === 'rpa') bytes[0] = (bytes[0] & 0x3f) | 0x40;
  if (kind === 'random') bytes[0] = bytes[0] | 0xc0;
  if (kind === 'public') bytes[0] = bytes[0] & 0x3c;
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
}

export function maskMac(mac: string) {
  const p = mac.split(':');
  if (p.length !== 6) return mac;
  return `${p[0]}:${p[1]}:${p[2]}:••:••:${p[5]}`;
}

export function hashAngle(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 3600;
  return (h / 10) % 360;
}

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 24) return `${mo}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

export const daysSince = (ts: number, now = Date.now()) => Math.floor((now - ts) / 86400000);

export function fmtClock(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Estimates distance from RSSI using a log-distance path-loss model. */
export function rssiToMeters(rssi: number, txPower = -59) {
  const n = 2.2;
  return Math.pow(10, (txPower - rssi) / (10 * n));
}

export function distanceLabel(rssi: number) {
  const m = rssiToMeters(rssi);
  if (m < 1) return 'Very close (<1 m)';
  if (m < 4) return `Close (~${m.toFixed(1)} m)`;
  if (m < 12) return `Medium (~${Math.round(m)} m)`;
  return `Far (~${Math.round(m)} m)`;
}

export function signalBars(rssi: number) {
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -78) return 2;
  if (rssi >= -88) return 1;
  return 0;
}

/** Checks if current time falls within an "HH:MM"–"HH:MM" window (supports overnight ranges). */
export function inTimeWindow(from: string, to: string, d = new Date()) {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const cur = d.getHours() * 60 + d.getMinutes();
  const f = toMin(from);
  const t = toMin(to);
  if (f === t) return false;
  return f < t ? cur >= f && cur < t : cur >= f || cur < t;
}

const PERSONAL = [
  'george', 'maria', 'nick', 'john', 'james', 'robert', 'michael', 'david', 'daniel', 'sarah', 'emily', 'jessica',
  'anna', 'alex', 'sophia', 'sofia', 'chris', 'mike', 'kate', 'katerina', 'nikos', 'kostas', 'eleni', 'dimitris',
  'giannis', 'emma', 'olivia', 'liam', 'noah', 'lucas', 'peter', 'paul', 'andrew', 'laura', 'rachel', 'sam', 'tom',
];
const POSSESSIVE = ["'s ", '’s ', ' of ', ' my '];
const MODELS = [
  'iphone', 'ipad', 'galaxy', 'samsung', 'pixel', 'xiaomi', 'redmi', 'poco', 'oneplus', 'huawei', 'honor', 'motorola',
  'moto ', 'nokia', 'xperia', 'sony', 'oppo', 'realme', 'vivo', 'nothing phone', 'sm-', ' s2', ' s1', ' a5', ' a3',
  ' note', ' pro', ' max', ' ultra', 'plus',
];

export interface NameAnalysis {
  level: 'safe' | 'medium' | 'danger';
  issues: string[];
}

export function analyzeName(name: string): NameAnalysis {
  const n = ` ${name.toLowerCase()} `;
  const issues: string[] = [];
  if (PERSONAL.some((p) => n.includes(p)) || POSSESSIVE.some((p) => n.includes(p)))
    issues.push('Contains a personal name — reveals your identity to anyone nearby.');
  if (MODELS.some((m) => n.includes(m)))
    issues.push('Reveals your phone brand/model — helps an attacker pick model-specific exploits.');
  if (/\d{10}|@/.test(n)) issues.push('Contains a phone number or email — serious personal data leak.');
  if (name.trim().length < 3) issues.push('Name is too short.');
  return { level: issues.length === 0 ? 'safe' : issues.length === 1 ? 'medium' : 'danger', issues };
}

const NAME_WORDS = ['Nova', 'Orion', 'Atlas', 'Pulse', 'Echo', 'Delta', 'Vega', 'Kappa', 'Lyra', 'Zeta', 'Sigma', 'Astra', 'Polaris', 'Nimbus'];
export function suggestName() {
  return `${pick(NAME_WORDS)}-${randHex(4)}`;
}

export function downloadFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
