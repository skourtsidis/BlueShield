export type Mode = 'on' | 'off' | 'auto';
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type LocationCtx = 'home' | 'work' | 'public';
export type Screen = 'home' | 'radar' | 'protection' | 'devices' | 'learn' | 'settings' | 'events';

export type ModuleId =
  | 'sniffing'
  | 'bluejacking'
  | 'bluesnarfing'
  | 'bluebugging'
  | 'blueborne'
  | 'knob'
  | 'bias'
  | 'braktooth'
  | 'tracking'
  | 'dos';

export type DeviceType =
  | 'headphones'
  | 'speaker'
  | 'watch'
  | 'fitness'
  | 'car'
  | 'laptop'
  | 'phone'
  | 'tv'
  | 'beacon'
  | 'tracker'
  | 'keyboard'
  | 'tool'
  | 'unknown';

export type DeviceTag =
  | 'tracker'
  | 'beacon'
  | 'suspicious'
  | 'trusted'
  | 'unencrypted'
  | 'hacktool'
  | 'paired'
  | 'blocked';

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high';

export type EventAction = 'blocked' | 'allowed' | 'warned' | 'info' | 'user-blocked' | 'user-allowed';

export interface Permissions {
  contacts: boolean;
  messages: boolean;
  calls: boolean;
  files: boolean;
}

export interface PairedDevice {
  id: string;
  name: string;
  type: DeviceType;
  mac: string;
  pairedAt: number;
  lastUsed: number;
  connected: boolean;
  secure: 'sc' | 'legacy';
  encrypted: boolean;
  keyBytes: number;
  trusted: boolean;
  note?: string;
  permissions: Permissions;
}

export interface NearbyDevice {
  id: string;
  name: string | null;
  type: DeviceType;
  mac: string;
  macType: 'public' | 'random' | 'rpa';
  protocol: 'classic' | 'ble';
  manufacturer: string;
  rssi: number;
  rssiBase: number;
  rssiHistory: number[];
  txPower?: number;
  firstSeen: number;
  lastSeen: number;
  risk: RiskLevel;
  reason: string;
  tags: DeviceTag[];
  encrypted: boolean | null;
  source: 'sim' | 'live';
  services: string[];
  angle: number;
  follow?: boolean;
  label?: string;
}

export interface SecurityEvent {
  id: string;
  time: number;
  moduleId: ModuleId | null;
  severity: Severity;
  title: string;
  description: string;
  advice: string;
  device?: string;
  action: EventAction;
  simulated: boolean;
}

export interface TimelinePoint {
  t: number;
  packets: number;
  blocked: number;
  threats: number;
}

export interface IncomingRequest {
  id: string;
  kind: 'pair' | 'file' | 'vcard' | 'access';
  deviceName: string;
  mac: string;
  detail: string;
  pin?: string;
  moduleId: ModuleId;
  severity: Severity;
  explanation: string;
  createdAt: number;
  title: string;
  description: string;
  advice: string;
}

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

export interface TrustedPlace {
  id: string;
  name: string;
  kind: 'home' | 'work';
  lat?: number;
  lon?: number;
  radius: number;
}

export interface Settings {
  beginnerMode: boolean;
  autoOffMinutes: number;
  nightEnabled: boolean;
  nightFrom: string;
  nightTo: string;
  offWhenLeaving: boolean;
  discoverableTimeout: number;
  pairingOnlyTrusted: boolean;
  autoRejectUnknown: boolean;
  sensitivity: 1 | 2 | 3;
  notifications: boolean;
  vibration: boolean;
  simulation: boolean;
  intensity: 1 | 2 | 3;
  dosThreshold: number;
  minKeyBytes: 7 | 10 | 16;
  staleDays: number;
  useGps: boolean;
}

export interface BatterySample {
  t: number;
  level: number;
}

export interface BatteryState {
  source: 'live' | 'sim';
  level: number;
  charging: boolean;
  history: BatterySample[];
}

export interface SystemInfo {
  os: 'android' | 'ios' | 'desktop' | 'other';
  osName: string;
  version: string | null;
  major: number | null;
  model: string | null;
  browser: string;
  support: 'ok' | 'warn' | 'fail' | 'unknown';
  supportText: string;
  live: boolean;
}

export interface Capabilities {
  native: boolean;
  platform: 'android' | 'ios' | 'web';
  webBluetooth: boolean;
  leScan: boolean;
  battery: boolean;
  geolocation: boolean;
  notifications: boolean;
  vibrate: boolean;
  standalone: boolean;
}

export interface HelpContent {
  title: string;
  body: string;
  more?: string;
  tips?: string[];
}

export interface LiveState {
  btEnabled: boolean | null;
  scanning: boolean;
  error: string | null;
  bonded: { id: string; name: string }[];
}
