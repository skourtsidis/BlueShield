import type { LucideIcon } from 'lucide-react';
import { Radio, Mail, Contact, Mic, Bug, KeyRound, Fingerprint, Cpu, Footprints, Zap } from 'lucide-react';
import type { Mode, ModuleId, Severity } from '../types';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  attack: string;
  short: string;
  icon: LucideIcon;
  severity: Severity;
  category: 'sniffing' | 'classic' | 'modern' | 'privacy' | 'dos';
  year: string;
  threat: string;
  analogy: string;
  does: string;
  modes: Record<Mode, string>;
  technical: string;
  tips: string[];
  weight: number;
  recommended: Mode;
}

export const MODULES: ModuleDef[] = [
  {
    id: 'sniffing',
    name: 'Anti-Sniffing (Packet Capture)',
    attack: 'Bluetooth Sniffing',
    short: 'Protects your wireless traffic from over-the-air eavesdropping',
    icon: Radio,
    severity: 'high',
    category: 'sniffing',
    year: 'Ongoing',
    threat:
      'An attacker with specialized radio hardware (such as Ubertooth One or a Software Defined Radio card) and analysis tools like Wireshark captures the radio packets exchanged between your phone and accessories. If a connection is unencrypted (common on budget BLE fitness bands) or if the attacker records the initial pairing moment, they can steal the encryption key and read everything: keystrokes, voice calls, and files.',
    analogy:
      'It is like talking on speakerphone inside a crowded bus: anyone sitting next to you can hear every word — unless you speak in a secret code that only your partner understands.',
    does:
      'Continuously checks whether your active links are encrypted, warns you about accessories that transmit in clear text, and blocks new pairing attempts in public places where key interception is easiest.',
    modes: {
      on: 'Blocks all new pairing outside trusted locations and disconnects any unencrypted device.',
      auto: 'Allows pairing only in trusted locations (e.g. Home) and warns you about unencrypted links.',
      off: 'No inspection — your Bluetooth links could be intercepted without warning.',
    },
    technical:
      'Bluetooth Classic hops frequencies 1,600 times per second across 79 channels (FHSS), which is why a regular laptop chip cannot easily sniff it. BLE uses 40 channels (37 data + 3 advertising). A passive sniffer CANNOT be detected because it only listens. Defense is therefore preventive: LE Secure Connections (ECDH P-256), AES-CCM encryption, and avoiding "Just Works" pairing in public.',
    tips: [
      'Pair new accessories at home — never in a café, airport, or subway.',
      'Choose accessories with Bluetooth 5.0+ and LE Secure Connections.',
      'Never use unencrypted BLE devices for sensitive input (such as keyboards).',
    ],
    weight: 1.2,
    recommended: 'auto',
  },
  {
    id: 'bluejacking',
    name: 'Bluejacking & Phishing Filter',
    attack: 'Bluejacking',
    short: 'Blocks unsolicited messages, vCards, and phishing lures',
    icon: Mail,
    severity: 'medium',
    category: 'classic',
    year: '2003',
    threat:
      'Strangers nearby push unsolicited messages — typically disguised as digital contact cards (vCards) — to phones left in "discoverable" mode. Originally an annoyance, it is now used for phishing (e.g. a message mimicking a system security alert with a malicious link). Modern variant: BLE connection-popup spam sent by pocket tools such as Flipper Zero.',
    analogy:
      'It is like someone slipping flyers into your bag while you walk down the street. Most are junk — a few are traps.',
    does:
      'Automatically rejects contact cards, files, and messages from unknown devices and scans incoming payloads for suspicious URLs or lure phrases ("You won", "Verify your account", etc.).',
    modes: {
      on: 'Rejects all files, vCards, and messages from unknown devices.',
      auto: 'Blocks suspicious items (links, phishing keywords) and asks you about everything else.',
      off: 'All incoming push requests reach your screen unfiltered.',
    },
    technical:
      'Classic Bluejacking abuses OBEX Object Push Profile (OPP) over RFCOMM. Modern BLE spam floods advertisements spoofing Apple Continuity / Google Fast Pair / Samsung Swift Pair frames to trigger endless popups. The filter inspects vCard FN/NOTE/URL fields for URLs and phishing patterns.',
    tips: [
      'Keep your phone non-discoverable whenever you are not actively pairing.',
      'Never tap links received inside Bluetooth messages or contact cards.',
      'If connection popups suddenly flood your screen, turn Bluetooth off for a few minutes.',
    ],
    weight: 0.8,
    recommended: 'on',
  },
  {
    id: 'bluesnarfing',
    name: 'Bluesnarfing Shield',
    attack: 'Bluesnarfing',
    short: 'Stops silent theft of contacts, messages, and photos',
    icon: Contact,
    severity: 'high',
    category: 'classic',
    year: '2003',
    threat:
      'Far more serious than Bluejacking. The attacker exploits protocol or implementation flaws to connect to your phone without your approval and silently extract contacts, SMS messages, photos, and calendar entries.',
    analogy:
      'It is like a pickpocket unzipping your backpack on the subway, photographing your address book, and zipping it back up without you ever noticing.',
    does:
      'Monitors every access request to your contacts, messages, and files and enforces per-device permissions so only explicitly approved paired devices can read specific data categories.',
    modes: {
      on: 'Blocks all contact, message, and file access from unapproved devices.',
      auto: 'Blocks suspicious requests and prompts you whenever a device asks for new permissions.',
      off: 'A device exploiting a vulnerability could read your personal data.',
    },
    technical:
      'Targets OBEX profiles: PBAP (Phone Book Access Profile), MAP (Message Access Profile), and OBEX FTP. Protection enforces a strict bonded-device allowlist with per-profile authorization — e.g. your own car can read contacts, but not files.',
    tips: [
      'Grant contact sharing only to your personal car — never to a rental car.',
      'Decline contact and SMS sync prompts when connecting to unfamiliar stereos.',
      'Review per-device permissions regularly in the "Devices" tab.',
    ],
    weight: 1.2,
    recommended: 'on',
  },
  {
    id: 'bluebugging',
    name: 'Bluebugging Guard',
    attack: 'Bluebugging',
    short: 'Prevents covert control of calls, SMS, and your microphone',
    icon: Mic,
    severity: 'critical',
    category: 'classic',
    year: '2004',
    threat:
      'The most dangerous of the classic Bluetooth attacks: it hands the attacker full control of the phone. They can place calls, send SMS messages, read texts, and silently activate the microphone to eavesdrop on your surroundings — with nothing shown on your screen.',
    analogy:
      'It is like someone having a spare key to your house and coming and going at will, using your phone as if it were theirs.',
    does:
      'Monitors low-level modem control commands (AT commands) over Bluetooth and immediately blocks any attempt to dial numbers, send SMS, or open an audio/microphone channel from an unverified device.',
    modes: {
      on: 'Blocks all call, SMS, and microphone control commands from unverified devices.',
      auto: 'Allows call controls only from verified audio devices (e.g. your earbuds) and blocks critical threats.',
      off: 'No command monitoring — critical security risk.',
    },
    technical:
      'Exploits unauthenticated RFCOMM channels to issue AT commands (e.g. ATD to place calls, AT+CMGS to send SMS, AT+CPBR to dump the phonebook). The guard restricts HFP/HSP profiles strictly to bonded audio peripherals using Secure Connections.',
    tips: [
      'If you spot calls or texts you never made, turn Bluetooth off immediately.',
      'Remove old headsets and car kits you no longer use.',
      'Keep your phone OS up to date at all times.',
    ],
    weight: 1.5,
    recommended: 'on',
  },
  {
    id: 'blueborne',
    name: 'BlueBorne Shield',
    attack: 'BlueBorne',
    short: 'Defends against zero-click attacks that need no pairing',
    icon: Bug,
    severity: 'critical',
    category: 'modern',
    year: '2017',
    threat:
      'One of the most severe Bluetooth vulnerabilities ever discovered. It allowed attackers to take over a phone without pairing and without the phone even being in "discoverable" mode — Bluetooth simply had to be switched on. Worse, it could spread worm-like from one phone to another.',
    analogy:
      'It is like an airborne virus: nobody has to touch your phone — merely standing in the same room with an unpatched open radio is enough.',
    does:
      'Checks whether your operating system includes the required security patches and detects malformed stack packets characteristic of BlueBorne exploits, dropping them before they reach the system.',
    modes: {
      on: 'Drops malformed packets and alerts you if OS security patches are overdue.',
      auto: 'Drops exploit packets; in public places recommends turning Bluetooth off when idle.',
      off: 'No shield — your safety depends solely on your OS patch level.',
    },
    technical:
      'CVE-2017-0781 / CVE-2017-0782 (Android BNEP heap overflow & RCE), CVE-2017-0785 (SDP information leak), CVE-2017-1000251 (Linux L2CAP stack overflow). Patched in the September 2017 Android Security Bulletin and iOS 10.',
    tips: [
      'Install every system security update promptly.',
      'If your phone no longer receives OS updates, keep Bluetooth turned off whenever possible.',
      'Disabling "discoverable" mode does NOT stop BlueBorne.',
    ],
    weight: 1.5,
    recommended: 'on',
  },
  {
    id: 'knob',
    name: 'KNOB Key Protection',
    attack: 'KNOB Attack',
    short: 'Enforces strong encryption keys on every Bluetooth link',
    icon: KeyRound,
    severity: 'high',
    category: 'modern',
    year: '2019',
    threat:
      'During connection setup, an attacker interferes with key negotiation and tricks two devices into agreeing on a tiny 1-byte encryption key (only 256 possible values). Using packet sniffing, they brute-force the key and decrypt all traffic within seconds.',
    analogy:
      'It is like someone convincing you to lock a bank vault with a 3-digit luggage padlock instead of a 39-digit combination. One opens in minutes; the other takes billions of years.',
    does:
      'Enforces a minimum encryption key length (16 bytes = 128-bit recommended) and aborts any connection that attempts to downgrade the key size below your threshold.',
    modes: {
      on: 'Rejects every connection negotiating a key shorter than your minimum threshold.',
      auto: 'Blocks dangerously weak keys (< 7 bytes) and warns you about keys below your preferred minimum.',
      off: 'Devices may negotiate any key size — even 1 byte.',
    },
    technical:
      'CVE-2019-9506 (Key Negotiation of Bluetooth). Entropy negotiation (LMP_encryption_key_size_req) in Bluetooth BR/EDR was neither authenticated nor encrypted, allowing a MITM attacker to force 1 byte of entropy. Bluetooth SIG Erratum 11838 mandates a 7-byte floor; BLE has an analogous variant (KNOB-LE).',
    tips: [
      'OS security updates enforce minimum key lengths at the stack level.',
      'Avoid legacy accessories whose firmware can no longer be updated.',
      'Never pair devices in crowded public areas.',
    ],
    weight: 1.2,
    recommended: 'on',
  },
  {
    id: 'bias',
    name: 'Anti-Spoofing (BIAS)',
    attack: 'BIAS',
    short: 'Uncovers attackers impersonating your trusted accessories',
    icon: Fingerprint,
    severity: 'high',
    category: 'modern',
    year: '2020',
    threat:
      'Bluetooth Impersonation AttackS allow an attacker to spoof the MAC address of a device your phone already trusts — such as your earbuds — and complete a connection without knowing the stored link key.',
    analogy:
      'It is like a stranger wearing a realistic mask of your best friend so you open the front door without asking any questions.',
    does:
      'Stores a hardware/protocol fingerprint for each trusted device (Bluetooth version, pairing mode, signal profile, capabilities) and blocks any device claiming a trusted address whose fingerprint does not match.',
    modes: {
      on: 'Blocks any connection from a "trusted" device whose fingerprint deviates from baseline.',
      auto: 'Blocks strong mismatches and warns you on minor changes (e.g. after a headphone firmware update).',
      off: 'Your phone trusts any device presenting a saved MAC address.',
    },
    technical:
      'CVE-2020-10135. Exploits unilateral authentication in Legacy Secure Connections and role-switch tricks during LMP authentication. Mitigations: Secure Connections Only mode, mutual authentication checks, device fingerprinting, and pruning unused bonds.',
    tips: [
      'Delete old headphones and rental cars from your saved Bluetooth list.',
      'Be suspicious if your earbuds "connect" while sitting powered off in their case.',
      'Prefer accessories that support Secure Connections.',
    ],
    weight: 1.1,
    recommended: 'on',
  },
  {
    id: 'braktooth',
    name: 'BrakTooth Firmware Guard',
    attack: 'BrakTooth',
    short: 'Detects low-level exploits targeting Bluetooth chips',
    icon: Cpu,
    severity: 'high',
    category: 'modern',
    year: '2021',
    threat:
      'A family of vulnerabilities inside commercial Bluetooth controller chips across phones, laptops, and audio gear. Malformed packets can freeze your device (Denial of Service) or, on certain chips, execute arbitrary malicious code.',
    analogy:
      'It is like a factory defect inside the lock cylinder itself: no matter how carefully you lock up, the mechanism needs a manufacturer repair.',
    does:
      'Detects anomalous Link Manager Protocol packet sequences, safely resets Bluetooth if the controller hangs, and reminds you to update firmware on both your phone and accessories.',
    modes: {
      on: 'Drops anomalous low-level packets and resets the radio if a controller freeze is detected.',
      auto: 'Blocks known BrakTooth exploit patterns and alerts you to unusual controller behavior.',
      off: 'No protection — a crafted packet burst can freeze Bluetooth.',
    },
    technical:
      'A suite of 16+ flaws (e.g. CVE-2021-28139 arbitrary code execution on ESP32, CVE-2021-34147, etc.) in the Bluetooth Classic LMP/Baseband stacks of SoCs from Espressif, Intel, Qualcomm, Texas Instruments, Infineon (Cypress), Bluetrum, Zhuhai Jieli, and others.',
    tips: [
      'Update headphone, speaker, and smartwatch firmware using the vendor companion app.',
      'If Bluetooth repeatedly freezes in a public venue, switch it off.',
      'No-name accessories that never receive firmware updates carry the highest risk.',
    ],
    weight: 1,
    recommended: 'auto',
  },
  {
    id: 'tracking',
    name: 'Anti-Tracking & Beacons',
    attack: 'Tracking & Beacons',
    short: 'Spots retail beacons and hidden trackers following you',
    icon: Footprints,
    severity: 'medium',
    category: 'privacy',
    year: 'Today',
    threat:
      'Even without hacking your phone, leaving Bluetooth on puts your privacy at risk. Shopping malls and ad networks deploy Bluetooth Beacons to map your movements indoors, while someone could slip a Bluetooth tracker (e.g. AirTag, SmartTag, Tile) into your bag or car. Modern OSes rotate MAC addresses (MAC Randomization), yet researchers have shown tracking remains possible by fingerprinting battery levels, device names, or radio traits.',
    analogy:
      'It is like walking through town wearing a glowing neon hat: even if you change jackets, anyone who knows what to look for can still follow your trail.',
    does:
      'Detects nearby retail beacons and item trackers, alerts you when the same unknown tracker travels with you over time, and checks that your phone is not leaking identifying traits.',
    modes: {
      on: 'Continuous tracker & beacon scanning with instant alerts.',
      auto: 'Battery-friendly periodic scanning; alerts only on meaningful risks (such as a tracker following you).',
      off: 'No tracking detection — hidden trackers and beacons go unnoticed.',
    },
    technical:
      'iOS and Android rotate Resolvable Private Addresses (RPA) roughly every 15 minutes, but static fields like TX power, manufacturer data, battery service, or local name enable cross-rotation fingerprinting. BlueShield recognizes Apple Find My (Company ID 0x004C, type 0x12), Samsung SmartTag (0xFD5A), Tile (0xFEED), Google Find My Device (0xFEAA), iBeacon, and Eddystone.',
    tips: [
      'If an unknown tracker is following you, open the Radar and use "Locate" to pinpoint it.',
      'Turn Bluetooth off inside shopping malls when you do not need it.',
      'Check bags, coat pockets, and your vehicle if you receive a following alert.',
    ],
    weight: 0.9,
    recommended: 'auto',
  },
  {
    id: 'dos',
    name: 'Anti-DoS & Battery Guard',
    attack: 'Bluesmack / DoS',
    short: 'Stops packet floods that freeze your phone or drain battery',
    icon: Zap,
    severity: 'medium',
    category: 'dos',
    year: '2005',
    threat:
      'Denial-of-Service attacks such as Bluesmack bombard your phone with oversized Bluetooth packets at high speed, causing system lag, crashes, or rapid battery depletion.',
    analogy:
      'It is like someone leaning on your doorbell non-stop: they never get inside, but you cannot get anything done either.',
    does:
      'Measures incoming packets per second in real time, temporarily throttles or blocks any source exceeding your rate limit, and watches your battery discharge curve for abnormal drain.',
    modes: {
      on: 'Immediately blocks any source exceeding your packet-per-second limit.',
      auto: 'Blocks heavy floods (> 1.5× your limit) and warns you on moderate spikes.',
      off: 'No packet-flood rate limiting.',
    },
    technical:
      'Bluesmack floods L2CAP Echo Requests (e.g. via l2ping) with oversized ~600-byte payloads. Protection applies per-source token-bucket rate limiting and temporary blacklisting.',
    tips: [
      'If your phone suddenly heats up and loses battery fast in public, turn Bluetooth off.',
      'Lower threshold = stricter protection, though chatty audio devices need ~50–100 pkt/s.',
      'Watch the live traffic chart to see your real-time packet rate against your limit.',
    ],
    weight: 0.9,
    recommended: 'auto',
  },
];

export const MODULE_MAP = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleDef>;

export const CATEGORY_LABEL: Record<ModuleDef['category'], string> = {
  sniffing: 'Sniffing',
  classic: 'Classic',
  modern: 'Modern CVEs',
  privacy: 'Privacy',
  dos: 'DoS',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Info',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const SEVERITY_RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export const MODE_LABEL: Record<Mode, string> = { on: 'ON', off: 'OFF', auto: 'AUTO' };

export const DEFAULT_MODULES: Record<ModuleId, Mode> = {
  sniffing: 'auto',
  bluejacking: 'on',
  bluesnarfing: 'auto',
  bluebugging: 'on',
  blueborne: 'auto',
  knob: 'off',
  bias: 'off',
  braktooth: 'auto',
  tracking: 'auto',
  dos: 'auto',
};

export const RECOMMENDED_MODULES = Object.fromEntries(MODULES.map((m) => [m.id, m.recommended])) as Record<ModuleId, Mode>;

export const MODULE_COLOR: Record<ModuleId, string> = {
  sniffing: '#38bdf8',
  bluejacking: '#a78bfa',
  bluesnarfing: '#f472b6',
  bluebugging: '#fb7185',
  blueborne: '#f97316',
  knob: '#fbbf24',
  bias: '#2dd4bf',
  braktooth: '#c084fc',
  tracking: '#34d399',
  dos: '#60a5fa',
};
