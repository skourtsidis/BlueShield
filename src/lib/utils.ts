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

/** Δημιουργεί διεύθυνση MAC. Οι τυχαίες (RPA) έχουν τα 2 ανώτερα bit = 01. */
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
  if (s < 5) return 'μόλις τώρα';
  if (s < 60) return `πριν ${s} δευτ.`;
  const m = Math.round(s / 60);
  if (m < 60) return `πριν ${m} λεπτ${m === 1 ? 'ό' : 'ά'}`;
  const h = Math.round(m / 60);
  if (h < 24) return `πριν ${h} ώρ${h === 1 ? 'α' : 'ες'}`;
  const d = Math.round(h / 24);
  if (d < 60) return `πριν ${d} ημέρ${d === 1 ? 'α' : 'ες'}`;
  const mo = Math.round(d / 30);
  if (mo < 24) return `πριν ${mo} μήν${mo === 1 ? 'α' : 'ες'}`;
  return `πριν ${Math.round(d / 365)} χρόνια`;
}

export const daysSince = (ts: number, now = Date.now()) => Math.floor((now - ts) / 86400000);

export function fmtClock(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Εκτίμηση απόστασης από RSSI (μοντέλο απώλειας διαδρομής). */
export function rssiToMeters(rssi: number, txPower = -59) {
  const n = 2.2;
  return Math.pow(10, (txPower - rssi) / (10 * n));
}

export function distanceLabel(rssi: number) {
  const m = rssiToMeters(rssi);
  if (m < 1) return 'Πολύ κοντά (<1 μ.)';
  if (m < 4) return `Κοντά (~${m.toFixed(1)} μ.)`;
  if (m < 12) return `Μέτρια απόσταση (~${Math.round(m)} μ.)`;
  return `Μακριά (~${Math.round(m)} μ.)`;
}

export function signalBars(rssi: number) {
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -78) return 2;
  if (rssi >= -88) return 1;
  return 0;
}

/** Είναι η ώρα μέσα σε ένα χρονικό παράθυρο "ΩΩ:ΛΛ"–"ΩΩ:ΛΛ" (υποστηρίζει μετά τα μεσάνυχτα). */
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
  'γιώργ', 'γιωργ', 'μαρία', 'μαρια', 'νίκ', 'νικ', 'κώστ', 'κωστ', 'ελέν', 'ελεν', 'δημήτρ', 'δημητρ', 'γιάνν', 'γιανν',
  'κατερίν', 'κατεριν', 'σοφία', 'σοφια', 'παναγ', 'βασιλ', 'αννα', 'άννα', 'χρήστ', 'χρηστ', 'αλέξ', 'αλεξ', 'θανάσ',
  'θανασ', 'ειρήν', 'ειρην', 'μιχάλ', 'μιχαλ', 'σπύρ', 'σπυρ', 'στέλ', 'στελ', 'ευα', 'εύα', 'george', 'maria', 'nick',
  'john', 'kostas', 'eleni', 'dimitris', 'giannis', 'anna', 'alex', 'sofia', 'chris', 'mike', 'katerina', 'nikos',
];
const POSSESSIVE = [' του ', ' της ', "'s ", '’s ', ' tou ', ' tis '];
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
    issues.push('Περιέχει προσωπικό όνομα — αποκαλύπτει την ταυτότητά σας σε όποιον βρίσκεται κοντά.');
  if (MODELS.some((m) => n.includes(m)))
    issues.push('Αποκαλύπτει μάρκα/μοντέλο — ο επιτιθέμενος μαθαίνει ποιες ευπάθειες να δοκιμάσει.');
  if (/\d{10}|@/.test(n)) issues.push('Περιέχει τηλέφωνο ή email — σοβαρή διαρροή προσωπικών στοιχείων.');
  if (name.trim().length < 3) issues.push('Πολύ σύντομο όνομα.');
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
