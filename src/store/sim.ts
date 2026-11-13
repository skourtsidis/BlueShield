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
  label: 'Ανώνυμο κινητό',
  reason: 'Κινητό με τυχαία διεύθυνση (RPA). Φυσιολογική συμπεριφορά — η ιδιωτικότητά του προστατεύεται.',
});

const OWN: Tpl[] = [
  { name: 'Galaxy Buds2 Pro', type: 'headphones', protocol: 'ble', manufacturer: 'Samsung', macType: 'public', rssi: -44, risk: 'safe', reason: 'Δική σας έμπιστη συσκευή (συζευγμένη, Secure Connections).', encrypted: true, services: ['Audio Sink (A2DP)', 'Hands-Free (HFP)'], tags: ['trusted'] },
  { name: 'Mi Smart Band 7', type: 'fitness', protocol: 'ble', manufacturer: 'Xiaomi', macType: 'public', rssi: -52, risk: 'medium', reason: 'Δική σας συσκευή, αλλά στέλνει δεδομένα χωρίς κρυπτογράφηση — ευάλωτη σε sniffing.', encrypted: false, services: ['Heart Rate', 'Battery Service', 'Xiaomi Mi (FE95)'], tags: ['unencrypted'] },
];

const POOLS: Record<LocationCtx, Tpl[]> = {
  home: [
    ...OWN,
    { name: '[TV] Samsung 7 Series', type: 'tv', protocol: 'ble', manufacturer: 'Samsung', macType: 'public', rssi: -74, risk: 'low', reason: 'Τηλεόραση γείτονα. Εκπέμπει δημόσια όνομα και μοντέλο.', services: ['Generic Access'] },
    { name: 'LE-Bose QC45', type: 'headphones', protocol: 'ble', manufacturer: 'Bose', macType: 'public', rssi: -86, risk: 'safe', reason: 'Ακουστικά γείτονα σε λειτουργία αναζήτησης.' },
    PHONE('Apple', -82),
  ],
  work: [
    ...OWN,
    { name: 'Logitech MX Keys', type: 'keyboard', protocol: 'ble', manufacturer: 'Logitech', macType: 'random', rssi: -55, risk: 'safe', reason: 'Πληκτρολόγιο γραφείου με κρυπτογράφηση.', services: ['HID'] },
    { name: 'DESKTOP-7Q2LK', type: 'laptop', protocol: 'classic', manufacturer: 'Intel', macType: 'public', rssi: -66, risk: 'low', reason: 'Υπολογιστής συναδέλφου· το όνομα αποκαλύπτει πληροφορίες για το δίκτυο της εταιρείας.' },
    { name: 'Jabra Evolve2 65', type: 'headphones', protocol: 'ble', manufacturer: 'Jabra', macType: 'public', rssi: -71, risk: 'safe', reason: 'Ακουστικά γραφείου.' },
    { name: 'HC-05', type: 'tool', protocol: 'classic', manufacturer: 'Άγνωστος', macType: 'public', rssi: -80, risk: 'medium', reason: 'Γενικό module Bluetooth (DIY) με προεπιλεγμένο PIN 1234 — εμφανίζεται συχνά σε πειράματα και εργαλεία επιθέσεων.', tags: ['suspicious'], encrypted: false },
    PHONE('Google', -69),
    PHONE('Samsung', -77),
  ],
  public: [
    ...OWN,
    { name: 'Beacon_Mall_17', type: 'beacon', protocol: 'ble', manufacturer: 'Kontakt.io', macType: 'public', rssi: -70, risk: 'low', reason: 'Διαφημιστικό beacon καταστήματος (iBeacon) — εφαρμογές καταγράφουν την παρουσία σας.', tags: ['beacon'], services: ['iBeacon'] },
    { name: null, type: 'beacon', protocol: 'ble', manufacturer: 'Google', macType: 'random', rssi: -78, risk: 'low', label: 'Eddystone beacon', reason: 'Beacon Eddystone για εντοπισμό θέσης σε εσωτερικούς χώρους.', tags: ['beacon'], services: ['Eddystone (FEAA)'] },
    { name: 'Flipper Zx7r', type: 'tool', protocol: 'ble', manufacturer: 'Flipper Devices', macType: 'random', rssi: -67, risk: 'high', reason: 'Εργαλείο hacking (Flipper Zero). Μπορεί να στέλνει μαζικά ψεύτικα αιτήματα σύνδεσης (BLE spam).', tags: ['hacktool', 'suspicious'] },
    { name: 'Free_Music_Share', type: 'phone', protocol: 'classic', manufacturer: 'MediaTek', macType: 'public', rssi: -64, risk: 'high', reason: 'Ύποπτο «δελεαστικό» όνομα — τυπικό για Bluejacking/phishing.', tags: ['suspicious'] },
    { name: 'JBL Flip 5', type: 'speaker', protocol: 'classic', manufacturer: 'Harman', macType: 'public', rssi: -81, risk: 'safe', reason: 'Φορητό ηχείο κάποιου κοντά σας.' },
    { name: 'Galaxy Watch5', type: 'watch', protocol: 'ble', manufacturer: 'Samsung', macType: 'rpa', rssi: -75, risk: 'safe', reason: 'Smartwatch με τυχαία διεύθυνση.' },
    { name: 'Tile', type: 'tracker', protocol: 'ble', manufacturer: 'Tile', macType: 'random', rssi: -84, risk: 'low', reason: 'Tracker Tile (0xFEED). Πιθανότατα ανήκει σε κάποιον κοντά σας· παρακολουθήστε αν σας ακολουθεί.', tags: ['tracker'], services: ['Tile (FEED)'] },
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
  { name: 'ESP32_HID', type: 'tool', protocol: 'ble', manufacturer: 'Espressif', macType: 'public', rssi: -73, risk: 'high', reason: 'Πλακέτα ESP32 που παριστάνει πληκτρολόγιο (HID) — συχνή σε επιθέσεις έγχυσης πλήκτρων. Ευάλωτη και σε BrakTooth.', tags: ['suspicious'] },
  { name: 'AirPods Pro', type: 'headphones', protocol: 'ble', manufacturer: 'Apple', macType: 'rpa', rssi: -77, risk: 'safe', reason: 'Ακουστικά κάποιου κοντά σας.' },
  { name: 'Android_7F2C', type: 'phone', protocol: 'classic', manufacturer: 'Άγνωστος', macType: 'public', rssi: -70, risk: 'medium', reason: 'Κινητό σε μόνιμη ορατότητα με σταθερή (δημόσια) διεύθυνση — μπορεί να είναι παλιό ή παραμετροποιημένο για επιθέσεις.', tags: ['suspicious'] },
];

export const FOLLOW_TRACKER: Tpl = {
  name: null,
  type: 'tracker',
  protocol: 'ble',
  manufacturer: 'Apple',
  macType: 'random',
  rssi: -56,
  risk: 'high',
  label: 'Άγνωστο AirTag (Find My)',
  reason: 'Tracker Find My μακριά από τον κάτοχό του, που σας ακολουθεί εδώ και αρκετή ώρα σε διαφορετικά σημεία. Μπορεί να έχει τοποθετηθεί στα πράγματά σας!',
  tags: ['tracker', 'suspicious'],
  services: ['Find My (0x004C · τύπος 0x12)'],
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
    { id: 'p1', name: 'Galaxy Buds2 Pro', type: 'headphones', mac: 'A4:C6:9A:3B:1F:72', pairedAt: now - 210 * D, lastUsed: now, connected: true, secure: 'sc', encrypted: true, keyBytes: 16, trusted: true, note: 'Τα ακουστικά σας', permissions: { contacts: false, messages: false, calls: true, files: false } },
    { id: 'p2', name: 'Mi Smart Band 7', type: 'fitness', mac: 'D8:3A:DD:51:0C:9E', pairedAt: now - 120 * D, lastUsed: now - 3600e3, connected: true, secure: 'legacy', encrypted: false, keyBytes: 7, trusted: true, note: 'Φθηνή συσκευή BLE χωρίς κρυπτογράφηση', permissions: { contacts: false, messages: true, calls: false, files: false } },
    { id: 'p3', name: 'Toyota Touch 2', type: 'car', mac: '00:1E:C0:7A:44:B1', pairedAt: now - 400 * D, lastUsed: now - 3 * D, connected: false, secure: 'sc', encrypted: true, keyBytes: 16, trusted: true, note: 'Το αυτοκίνητό σας', permissions: { contacts: true, messages: true, calls: true, files: false } },
    { id: 'p4', name: 'VW Polo (Hertz)', type: 'car', mac: '9C:8C:6E:12:F0:3A', pairedAt: now - 214 * D, lastUsed: now - 214 * D, connected: false, secure: 'legacy', encrypted: true, keyBytes: 7, trusted: true, note: 'Ενοικιαζόμενο αυτοκίνητο', permissions: { contacts: true, messages: true, calls: true, files: false } },
    { id: 'p5', name: 'JBL Flip 4', type: 'speaker', mac: 'B8:F6:53:8E:21:C4', pairedAt: now - 700 * D, lastUsed: now - 128 * D, connected: false, secure: 'legacy', encrypted: true, keyBytes: 10, trusted: true, permissions: { contacts: false, messages: false, calls: false, files: false } },
    { id: 'p6', name: 'BT-200 Headset', type: 'headphones', mac: '00:0D:44:9B:7E:02', pairedAt: now - 1100 * D, lastUsed: now - 402 * D, connected: false, secure: 'legacy', encrypted: true, keyBytes: 7, trusted: true, note: 'Παλιό ακουστικό', permissions: { contacts: true, messages: false, calls: true, files: false } },
    { id: 'p7', name: 'Λάπτοπ εργασίας', type: 'laptop', mac: '3C:22:FB:90:6D:15', pairedAt: now - 300 * D, lastUsed: now - 12 * D, connected: false, secure: 'sc', encrypted: true, keyBytes: 16, trusted: true, permissions: { contacts: false, messages: false, calls: false, files: true } },
  ];
}

/* ------------------------------ Επιθέσεις ------------------------------ */

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
  'Συγχαρητήρια! Κερδίσατε ένα smartphone',
  'Ειδοποίηση συστήματος: απαιτείται ενημέρωση ασφαλείας',
  'Το δέμα σας περιμένει — επιβεβαιώστε τη διεύθυνση',
  'Δωρεάν Wi-Fi: συνδεθείτε εδώ',
];
const LINKS = ['win-smartphone.gr', 'android-security-update.info', 'track-my-parcel.help', 'free-wifi-login.net'];

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
          title: 'Μη κρυπτογραφημένη σύνδεση BLE',
          description: `Η συσκευή «${unenc.name}» ανταλλάσσει δεδομένα (παλμούς, βήματα, ειδοποιήσεις) χωρίς κρυπτογράφηση. Οποιοσδήποτε με sniffer (π.χ. Ubertooth One) κοντά σας μπορεί να τα διαβάσει.`,
          advice: 'Αποφύγετε να χρησιμοποιείτε αυτή τη συσκευή σε δημόσιους χώρους ή αντικαταστήστε την με μοντέλο που υποστηρίζει LE Secure Connections.',
        };
      return {
        moduleId: id, severity: 'high', device: a.name, mac: a.mac,
        title: 'Αίτημα pairing «Just Works» χωρίς επαλήθευση',
        description: `Η συσκευή «${a.name}» προσπάθησε να ξεκινήσει pairing χωρίς κωδικό επαλήθευσης («Just Works»). Αυτή η μέθοδος είναι ευάλωτη σε υποκλοπή του κλειδιού μέσω sniffing.`,
        advice: 'Κάνετε pairing μόνο με συσκευές που επιλέξατε εσείς, και μόνο σε έμπιστο χώρο (π.χ. σπίτι).',
        request: { kind: 'pair', detail: 'Ζητά σύζευξη χωρίς κωδικό επαλήθευσης', explanation: 'Δεν ξεκινήσατε εσείς αυτή τη σύζευξη. Αν την αποδεχτείτε, ο επιτιθέμενος μπορεί να υποκλέψει το κλειδί κρυπτογράφησης.' },
      };
    }
    case 'bluejacking': {
      if (!ctx.discoverable || chance(0.35)) {
        const n = randInt(40, 220);
        return {
          moduleId: id, severity: 'medium', device: `Flipper ${randHex(4)}`, mac: randomMac('random'),
          title: 'Μαζικά ψεύτικα αιτήματα σύνδεσης (BLE spam)',
          description: `Ανιχνεύθηκαν ${n} ψεύτικες διαφημίσεις BLE σε 10 δευτερόλεπτα, που μιμούνται AirPods, ρολόγια και τηλεοράσεις για να εμφανίσουν αναδυόμενα παράθυρα σύνδεσης στην οθόνη σας.`,
          advice: 'Μην πατάτε «Σύνδεση» σε παράθυρα που εμφανίζονται ξαφνικά. Αν συνεχιστεί, κλείστε το Bluetooth για λίγα λεπτά.',
        };
      }
      const lure = pick(LURES);
      const link = pick(LINKS);
      return {
        moduleId: id, severity: 'medium', device: a.name, mac: a.mac,
        title: 'Ανεπιθύμητη κάρτα επαφής (vCard) με σύνδεσμο',
        description: `Η συσκευή «${a.name}» σας έστειλε κάρτα επαφής με το μήνυμα «${lure}» και τον σύνδεσμο ${link}. Η επίθεση ήταν δυνατή επειδή το κινητό σας είναι ορατό (discoverable).`,
        advice: 'Μην ανοίγετε ποτέ συνδέσμους από μηνύματα Bluetooth και κρατάτε το κινητό μη ορατό.',
        request: { kind: 'vcard', detail: `Αρχείο contact_${randInt(100, 999)}.vcf · «${lure}»`, explanation: 'Η κάρτα περιέχει σύνδεσμο phishing που μιμείται ειδοποίηση. Δεν τη ζητήσατε εσείς — απορρίψτε την.' },
      };
    }
    case 'bluesnarfing': {
      const v = pick([
        { t: 'Απόπειρα πρόσβασης στις επαφές (PBAP)', d: 'τον τηλεφωνικό σας κατάλογο και το ιστορικό κλήσεων', r: 'Επαφές, Ιστορικό κλήσεων' },
        { t: 'Απόπειρα ανάγνωσης μηνυμάτων (MAP)', d: 'τα μηνύματά σας (SMS)', r: 'Μηνύματα SMS' },
        { t: 'Αίτημα πρόσβασης σε αρχεία (OBEX FTP)', d: 'τις φωτογραφίες και τα αρχεία σας', r: 'Φωτογραφίες, Λήψεις, Έγγραφα' },
      ]);
      return {
        moduleId: id, severity: 'high', device: a.name, mac: a.mac,
        title: v.t,
        description: `Η άγνωστη συσκευή «${a.name}» (${maskMac(a.mac)}) ζήτησε πρόσβαση σε ${v.d}, χωρίς να είναι συζευγμένη με το κινητό σας.`,
        advice: 'Μη δίνετε ποτέ πρόσβαση σε επαφές/μηνύματα/αρχεία σε άγνωστες συσκευές. Ελέγξτε τα δικαιώματα στην καρτέλα «Συσκευές».',
        request: { kind: 'access', detail: `Ζητά πρόσβαση σε: ${v.r}`, explanation: 'Πρόκειται για απόπειρα Bluesnarfing: κλοπή προσωπικών δεδομένων. Μια άγνωστη συσκευή δεν έχει κανέναν λόγο να ζητά τα δεδομένα σας.' },
      };
    }
    case 'bluebugging': {
      const v = pick([
        { t: 'Κρυφή εντολή κλήσης (AT command)', d: `έστειλε μέσω RFCOMM την εντολή «ATD+30690${randInt(1000000, 9999999)};» για να πραγματοποιήσει κλήση από το κινητό σας χωρίς να το δείτε.` },
        { t: 'Απόπειρα αποστολής SMS (AT+CMGS)', d: 'προσπάθησε να στείλει SMS σε αριθμό υπερχρέωσης μέσω της εντολής AT+CMGS.' },
        { t: 'Απόπειρα κρυφής ενεργοποίησης μικροφώνου', d: 'ζήτησε σύνδεση ήχου (HFP) χωρίς ειδοποίηση, που θα της επέτρεπε να κρυφακούει τον χώρο σας μέσω του μικροφώνου.' },
      ]);
      return {
        moduleId: id, severity: 'critical', device: a.name, mac: a.mac,
        title: v.t,
        description: `Η μη επαληθευμένη συσκευή «${a.name}» ${v.d}`,
        advice: 'Αν παρατηρήσετε κλήσεις ή SMS που δεν κάνατε, κλείστε αμέσως το Bluetooth και ελέγξτε τη λίστα συσκευών σας.',
      };
    }
    case 'blueborne':
      return chance(0.6)
        ? {
            moduleId: id, severity: 'critical', device: a.name, mac: a.mac,
            title: 'Κακόβουλο πακέτο BNEP (μοτίβο BlueBorne)',
            description: `Λήφθηκε πακέτο υπερχείλισης στο πρωτόκολλο BNEP από «${a.name}». Ταιριάζει με την ευπάθεια CVE-2017-0781 — δεν απαιτείται ούτε pairing ούτε ορατότητα, αρκεί το Bluetooth να είναι ανοιχτό.`,
            advice: 'Βεβαιωθείτε ότι έχετε τις τελευταίες ενημερώσεις ασφαλείας. Σε δημόσιους χώρους κρατάτε το Bluetooth κλειστό.',
          }
        : {
            moduleId: id, severity: 'high', device: a.name, mac: a.mac,
            title: 'Απόπειρα διαρροής μνήμης μέσω SDP',
            description: `Η συσκευή «${a.name}» έστειλε σειρά από κακοσχηματισμένα αιτήματα SDP (μοτίβο CVE-2017-0785) για να «διαβάσει» τη μνήμη του κινητού και να προετοιμάσει επίθεση.`,
            advice: 'Οι ενημερώσεις λογισμικού κλείνουν αυτό το κενό. Αν το κινητό σας δεν ενημερώνεται πια, κρατάτε το Bluetooth κλειστό.',
          };
    case 'knob': {
      if (chance(0.65)) {
        const p = ctx.paired.length ? pick(ctx.paired) : null;
        const dev = p?.name || a.name;
        return {
          moduleId: id, severity: 'high', device: dev, mac: p?.mac || a.mac, keyBytes: 1,
          title: 'Απόπειρα υποβάθμισης κλειδιού σε 1 byte (KNOB)',
          description: `Κατά τη σύνδεση με «${dev}» κάποιος παρενέβη στη διαπραγμάτευση και ζήτησε κλειδί κρυπτογράφησης μόλις 1 byte (256 συνδυασμοί) αντί για 16 bytes. Τυπικό μοτίβο επίθεσης KNOB (CVE-2019-9506).`,
          advice: 'Ενεργοποιήστε την Προστασία KNOB σε ON με ελάχιστο κλειδί 16 bytes και κρατήστε το λογισμικό ενημερωμένο.',
        };
      }
      const legacy = ctx.paired.find((p) => p.keyBytes < 16) || null;
      const dev = legacy?.name || a.name;
      return {
        moduleId: id, severity: 'low', device: dev, mac: legacy?.mac || a.mac, keyBytes: 7,
        title: 'Σύνδεση με αδύναμο κλειδί (7 bytes)',
        description: `Η συσκευή «${dev}» διαπραγματεύτηκε κλειδί μόλις 7 bytes (56 bit). Είναι το ελάχιστο που επιτρέπει η προδιαγραφή, αλλά απέχει πολύ από το ασφαλές (16 bytes).`,
        advice: 'Αν η συσκευή είναι παλιά, σκεφτείτε να την αντικαταστήσετε ή να ενημερώσετε το firmware της.',
      };
    }
    case 'bias': {
      const p = ctx.paired.length ? pick(ctx.paired) : null;
      const name = p?.name || 'AirPods Pro';
      return {
        moduleId: id, severity: 'high', device: name, mac: p?.mac || randomMac('public'),
        title: `Πλαστοπροσωπία: «${name}»`,
        description: `Μια συσκευή με το όνομα και τη διεύθυνση (${maskMac(p?.mac || randomMac('public'))}) της «${name}» προσπάθησε να συνδεθεί, αλλά το ψηφιακό της αποτύπωμα δεν ταιριάζει: διαφορετική έκδοση LMP και αλλαγή ρόλου κατά την πιστοποίηση (μοτίβο BIAS, CVE-2020-10135).`,
        advice: 'Αν η πραγματική συσκευή είναι κλειστή ή μακριά, πρόκειται σίγουρα για επίθεση. Διαγράψτε από τη λίστα όσες συσκευές δεν χρησιμοποιείτε.',
      };
    }
    case 'braktooth':
      return chance(0.6)
        ? {
            moduleId: id, severity: 'high', device: a.name, mac: a.mac,
            title: 'Μη έγκυρο πακέτο LMP (μοτίβο BrakTooth)',
            description: `Λήφθηκε υπερμεγέθες/κακοσχηματισμένο πακέτο LMP από «${a.name}», που μπορεί να «παγώσει» το τσιπ Bluetooth ή ακόμη και να εκτελέσει κώδικα (π.χ. CVE-2021-28139).`,
            advice: 'Ελέγξτε για ενημερώσεις λογισμικού και firmware. Αν το Bluetooth «κολλήσει», κλείστε το και ανοίξτε το ξανά.',
          }
        : {
            moduleId: id, severity: 'medium', device: a.name, mac: a.mac,
            title: 'Απόπειρα «παγώματος» του τσιπ Bluetooth',
            description: `Η συσκευή «${a.name}» έστειλε διαδοχικά αιτήματα δυνατοτήτων (Feature Response Flooding) που προκαλούν σφάλμα στο firmware ευάλωτων τσιπ.`,
            advice: 'Αν το Bluetooth σταματά συχνά να λειτουργεί σε δημόσιους χώρους, κλείστε το και ελέγξτε για ενημερώσεις.',
          };
    case 'tracking': {
      if (ctx.location === 'public' && chance(0.45))
        return {
          moduleId: id, severity: 'low', device: 'Beacon_Mall_17', mac: randomMac('public'),
          title: 'Διαφημιστικό beacon καταγράφει την παρουσία σας',
          description: `Ένα beacon (iBeacon) σε ${pick(['κατάστημα ρούχων', 'σούπερ μάρκετ', 'εμπορικό κέντρο', 'καφετέρια'])} εκπέμπει κοντά σας. Εφαρμογές καταστημάτων μπορούν να καταγράφουν πότε και πού βρίσκεστε.`,
          advice: 'Κλείνετε το Bluetooth σε εμπορικά κέντρα αν δεν το χρειάζεστε και ελέγξτε ποιες εφαρμογές έχουν άδεια «Συσκευές κοντά σας».',
        };
      if (chance(0.55))
        return {
          moduleId: id, severity: 'high', device: 'Άγνωστο AirTag', mac: randomMac('random'), trackerFollow: true,
          title: 'Tracker σας ακολουθεί!',
          description: `Ένας ${pick(['tracker Apple Find My (π.χ. AirTag)', 'Samsung SmartTag', 'tracker Tile'])} εμφανίζεται κοντά σας εδώ και ${randInt(11, 35)} λεπτά, σε διαφορετικά σημεία της διαδρομής σας. Μπορεί να έχει τοποθετηθεί στα πράγματά σας.`,
          advice: 'Ανοίξτε το Ραντάρ και χρησιμοποιήστε τη λειτουργία «Εντοπισμός» για να τον βρείτε. Ελέγξτε τσάντα, τσέπες και αυτοκίνητο.',
        };
      return {
        moduleId: id, severity: 'medium', device: 'Σαρωτής BLE', mac: randomMac('public'),
        title: 'Απόπειρα fingerprinting του κινητού σας',
        description: 'Ένας σαρωτής κοντά σας συσχετίζει τις τυχαίες διευθύνσεις MAC σας με άλλα στοιχεία (TX power, επίπεδο μπαταρίας, όνομα) για να σας αναγνωρίζει παρά την τυχαιοποίηση.',
        advice: 'Αλλάξτε το όνομα της συσκευής σε κάτι ουδέτερο και κλείνετε το Bluetooth όταν δεν το χρειάζεστε.',
      };
    }
    case 'dos': {
      const thr = ctx.dosThreshold;
      const pps = Math.round(rand(thr * 0.8, thr * 3));
      return {
        moduleId: id, severity: pps > 2 * thr ? 'high' : 'medium', device: a.name, mac: a.mac,
        flood: { pps, seconds: randInt(8, 15) },
        title: 'Επίθεση Bluesmack (πλημμύρα πακέτων)',
        description: `Η συσκευή «${a.name}» στέλνει ~${pps} πακέτα L2CAP Echo το δευτερόλεπτο (600 bytes το καθένα). Το όριό σας είναι ${thr} πακέτα/δευτ.`,
        advice: 'Αν το κινητό ζεσταίνεται ή κολλάει, κλείστε το Bluetooth. Η Προστασία DoS σε ON μπλοκάρει αμέσως την πηγή.',
      };
    }
  }
}
