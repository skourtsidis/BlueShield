import type { ModuleId } from '../types';

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Bluetooth', def: 'Short-range wireless technology (typically up to ~10 m / 33 ft) used to connect earbuds, watches, cars, and accessories.' },
  { term: 'BLE (Bluetooth Low Energy)', def: 'Low-power Bluetooth mode used by fitness trackers, smartwatches, tags, and beacons. Cheap BLE gadgets often skip encryption.' },
  { term: 'Pairing', def: 'The first-time handshake where two devices exchange encryption keys. It is the most vulnerable moment — best done at home.' },
  { term: 'Bonding', def: 'Storing the keys created during pairing so two devices can reconnect automatically later.' },
  { term: 'Discoverable', def: 'State in which your phone appears in nearby Bluetooth searches. Enable it only briefly while pairing a new accessory.' },
  { term: 'MAC Address', def: 'A 6-byte hardware identifier for a Bluetooth radio (e.g. 3C:5A:B4:12:9F:01).' },
  { term: 'MAC Randomization', def: 'Privacy feature where your phone periodically rotates the Bluetooth address it broadcasts so strangers cannot track you.' },
  { term: 'Sniffing (Packet Capture)', def: 'Capturing and analyzing wireless data packets traveling through the air between two Bluetooth devices.' },
  { term: 'Frequency Hopping (FHSS)', def: 'Bluetooth jumps across frequencies up to 1,600 times per second to avoid interference — which is why sniffing requires specialized radios.' },
  { term: 'Encryption', def: 'Scrambling data using a secret key so only authorized devices can read it.' },
  { term: 'Encryption Key', def: 'The secret number used to lock and unlock encrypted traffic. Longer keys are stronger (16 bytes = 128-bit).' },
  { term: 'Vulnerability', def: 'A weakness in software, firmware, or a protocol specification that an attacker can exploit.' },
  { term: 'CVE', def: 'Common Vulnerabilities and Exposures — the international catalog ID assigned to publicly known security flaws (e.g. CVE-2019-9506 for KNOB).' },
  { term: 'Security Patch / Update', def: 'An official software update from Google, Apple, Samsung, etc. that fixes discovered security vulnerabilities.' },
  { term: 'Firmware', def: 'Low-level software running directly inside hardware chips — such as your phone’s Bluetooth chip or inside your wireless earbuds.' },
  { term: 'DoS (Denial of Service)', def: 'An attack designed to freeze, crash, or rapidly drain the battery of a target device.' },
  { term: 'Beacon', def: 'A tiny BLE transmitter installed in stores or malls that broadcasts an ID used by apps for indoor positioning and ad targeting.' },
  { term: 'Tracker', def: 'A coin-sized BLE tag (AirTag, SmartTag, Tile) meant for finding keys or luggage — which can be abused to secretly track people.' },
  { term: 'Phishing', def: 'Tricking someone with fake alerts or links into handing over passwords or installing malware.' },
  { term: 'vCard', def: 'A digital contact card (.vcf file) that can be pushed over Bluetooth.' },
  { term: 'OBEX', def: 'Object Exchange protocol used to transfer files, contacts, and messages over Bluetooth (targeted by Bluejacking and Bluesnarfing).' },
  { term: 'RFCOMM', def: 'Bluetooth serial-port emulation layer through which modem AT commands are sent.' },
  { term: 'AT Commands', def: 'Modem control commands for placing calls, sending SMS, etc. Bluebugging sends them covertly.' },
  { term: 'L2CAP', def: 'Core Bluetooth packet multiplexing layer. Bluesmack overwhelms it with oversized echo packets.' },
  { term: 'RSSI', def: 'Received Signal Strength Indicator in dBm. Closer to 0 means stronger/closer (e.g. −40 dBm is right next to you, −90 dBm is far away).' },
  { term: 'SDR (Software Defined Radio)', def: 'Radio hardware tuned by software capable of capturing wide frequency bands.' },
  { term: 'Ubertooth One', def: 'Open-source 2.4 GHz wireless development hardware widely used for Bluetooth packet sniffing research.' },
  { term: 'Wireshark', def: 'Popular open-source packet analyzer capable of inspecting captured Bluetooth protocols.' },
  { term: 'MITM (Man-in-the-Middle)', def: 'Attack where an adversary secretly relays and alters communication between two devices (such as in KNOB).' },
  { term: 'LE Secure Connections', def: 'Modern BLE pairing method (Bluetooth 4.2+) using Elliptic Curve Diffie-Hellman (P-256) to defeat passive eavesdropping.' },
  { term: 'Flipper Zero', def: 'Pocket multi-tool for wireless protocols; custom firmware has been used to broadcast BLE popup-spam floods.' },
];

export interface QuizQ {
  q: string;
  options: string[];
  correct: number;
  explain: string;
}

export const QUIZ: QuizQ[] = [
  {
    q: 'What is the simplest, 100% effective defense whenever you are not using Bluetooth?',
    options: ['Rename your phone', 'Turn Bluetooth completely off', 'Restart your phone daily', 'Use a thick phone case'],
    correct: 1,
    explain: 'When the Bluetooth radio is powered off, no Bluetooth attack can reach your phone. Note: on iPhone, Control Center only disconnects accessories — turn it off inside Settings.',
  },
  {
    q: 'When is a Bluetooth connection most vulnerable to packet sniffing?',
    options: ['When battery is low', 'During first-time pairing', 'While listening to music', 'Late at night'],
    correct: 1,
    explain: 'Encryption keys are exchanged during initial pairing. Pair new accessories at home rather than in a crowded café or train.',
  },
  {
    q: 'Which classic attack gives a hacker full control (calls, SMS, covert microphone)?',
    options: ['Bluejacking', 'Bluesnarfing', 'Bluebugging', 'Beacon tracking'],
    correct: 2,
    explain: 'Bluebugging is the most dangerous classic attack, letting an attacker control calls, texts, and eavesdrop via the microphone unseen.',
  },
  {
    q: 'Did the BlueBorne vulnerability require your phone to be in "discoverable" mode?',
    options: ['Yes, always', 'No — Bluetooth simply had to be turned on', 'Only on iPhones', 'Only during pairing'],
    correct: 1,
    explain: 'That is why BlueBorne was critical: it needed neither pairing nor discoverability, and could spread from phone to phone. OS security updates are essential.',
  },
  {
    q: 'What does the KNOB attack do?',
    options: ['Steals your photo gallery', 'Forces devices to use a 1-byte encryption key', 'Drains your battery in 5 minutes', 'Pushes ad popups'],
    correct: 1,
    explain: 'A 1-byte key has only 256 possible values and can be cracked in seconds. Enforcing a 16-byte (128-bit) minimum stops KNOB.',
  },
  {
    q: 'Why should you delete a rental car from your saved Bluetooth devices list?',
    options: ['To free up storage space', 'To prevent BIAS impersonation/spoofing and contact leaks', 'To make your phone charge faster', 'There is no reason'],
    correct: 1,
    explain: 'Every saved ("bonded") device is a trusted identity an attacker could spoof in a BIAS attack.',
  },
  {
    q: 'Which Bluetooth device name is the safest?',
    options: ["George's iPhone", 'Samsung S23', 'Nova-7F3A', 'Maria Papadopoulou'],
    correct: 2,
    explain: 'A neutral name hides both your personal identity and your exact phone model (and its potential vulnerabilities).',
  },
  {
    q: 'An unexpected pairing or file-transfer prompt pops up from an unknown device. What should you do?',
    options: ['Accept it to see what it is', 'Tap Reject / Cancel immediately', 'Forward it to a friend', 'Ignore it until it connects'],
    correct: 1,
    explain: 'Always reject any connection or file transfer you did not initiate yourself.',
  },
  {
    q: 'How are protocol-level flaws like BlueBorne, KNOB, and BIAS truly fixed?',
    options: ['By installing an antivirus app', 'Only through official OS & firmware security updates', 'By turning off discoverable mode', 'By changing your wallpaper'],
    correct: 1,
    explain: 'Protocol and stack flaws live inside the OS and Bluetooth chip firmware — only updates from Apple, Google, and device makers patch them.',
  },
  {
    q: 'What are Bluetooth Beacons in shopping malls used for?',
    options: ['Wireless phone charging', 'Tracking visitor movement and indoor location', 'Boosting Wi-Fi speed', 'Fire alarms'],
    correct: 1,
    explain: 'Retail beacons broadcast BLE signals so store apps and ad networks can pinpoint where you walk and how long you linger.',
  },
];

export interface AttackInfo {
  id: string;
  name: string;
  year: number;
  likelihood: number;
  impact: number;
  module: ModuleId;
  summary: string;
}

export const ATTACKS: AttackInfo[] = [
  { id: 'bluejacking', name: 'Bluejacking', year: 2003, likelihood: 6.5, impact: 3, module: 'bluejacking', summary: 'Unsolicited messages/vCards — used today for phishing & BLE spam.' },
  { id: 'bluesnarfing', name: 'Bluesnarfing', year: 2003, likelihood: 2.2, impact: 6.5, module: 'bluesnarfing', summary: 'Unauthorized theft of contacts, SMS messages, and photos.' },
  { id: 'bluebugging', name: 'Bluebugging', year: 2004, likelihood: 2, impact: 10, module: 'bluebugging', summary: 'Full covert takeover: calls, SMS, and hidden microphone.' },
  { id: 'bluesmack', name: 'Bluesmack (DoS)', year: 2005, likelihood: 4, impact: 4, module: 'dos', summary: 'Oversized packet flood causing freezes and rapid battery drain.' },
  { id: 'sniffing', name: 'Sniffing', year: 2007, likelihood: 6.8, impact: 7, module: 'sniffing', summary: 'Wireless packet capture using Ubertooth/SDR and Wireshark.' },
  { id: 'blueborne', name: 'BlueBorne', year: 2017, likelihood: 4.6, impact: 9.5, module: 'blueborne', summary: 'Zero-click takeover without pairing — worm-like spread.' },
  { id: 'knob', name: 'KNOB', year: 2019, likelihood: 3, impact: 8.2, module: 'knob', summary: 'Forces a 1-byte encryption key and cracks traffic in seconds.' },
  { id: 'bias', name: 'BIAS', year: 2020, likelihood: 5.2, impact: 7.9, module: 'bias', summary: 'Impersonates a trusted paired device (e.g. your earbuds).' },
  { id: 'braktooth', name: 'BrakTooth', year: 2021, likelihood: 4.4, impact: 6.1, module: 'braktooth', summary: 'Bluetooth chip firmware flaws: freezes up to code execution.' },
  { id: 'tracking', name: 'Tracking / Beacons', year: 2023, likelihood: 8.5, impact: 5, module: 'tracking', summary: 'Location tracking via retail beacons and hidden BLE tags.' },
];

export type RuleId = 'radio' | 'updates' | 'pairing' | 'reject' | 'name' | 'stale';

export const RULES: { id: RuleId; title: string; text: string; note?: string }[] = [
  {
    id: 'radio',
    title: 'Turn Bluetooth off when you are not using it',
    text: 'The simplest and 100% effective defense. BlueShield’s AUTO mode handles this by switching Bluetooth off after a few minutes with no connected devices.',
    note: 'iPhone tip: toggling Bluetooth off in Control Center only disconnects accessories while leaving the radio active in the background. Turn it off inside Settings.',
  },
  {
    id: 'updates',
    title: 'Always install software & security updates',
    text: 'Severe flaws like BlueBorne, KNOB, and BIAS can only be fixed through OS security patches from Google, Apple, and your phone manufacturer.',
  },
  {
    id: 'pairing',
    title: 'Never pair devices in crowded public places',
    text: 'Security keys are exchanged during first-time pairing. In a café or subway you are exposed to Bluetooth sniffing — pair new gear at home.',
  },
  {
    id: 'reject',
    title: 'Reject unexpected connection or file requests',
    text: 'If a pairing prompt or incoming file appears on your screen that you did not initiate yourself, tap Cancel / Reject immediately.',
  },
  {
    id: 'name',
    title: 'Change your device name to something neutral',
    text: 'Names like "George’s iPhone" or "Samsung S23" reveal both your identity and your exact phone model — telling attackers which exploits to try.',
  },
  {
    id: 'stale',
    title: 'Delete old paired devices you no longer use',
    text: 'Remove old earbuds, speakers, or rental cars from your saved Bluetooth list to shrink your attack surface against BIAS/spoofing attacks.',
  },
];

export const TIPS: string[] = [
  'Modern Bluetooth (5.0+) is fairly secure — as long as you follow basic hygiene rules.',
  'Discoverable mode is only needed for a few seconds while pairing a new accessory.',
  'On iPhones, turn Bluetooth off from Settings — Control Center only disconnects accessories.',
  'If your phone no longer gets security updates, keep Bluetooth off whenever idle.',
  'A neutral device name (e.g. "Nova-7F3A") hides both your identity and your phone model.',
  'Budget BLE fitness bands often omit encryption — be mindful of what data they sync.',
  'Reject every pairing or file prompt you did not start yourself. No exceptions.',
  'In a rental car, decline contact sync and delete your phone from the car head unit before returning it.',
  'Audit your paired Bluetooth devices every few months and forget anything you no longer use.',
  'If alerted about an unknown tracker following you, check bags, coat pockets, and your car.',
];
