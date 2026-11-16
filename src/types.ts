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

export type DeviceTag = 'tracker' | 'beacon' | 'suspicious' | 'trusted' | 'unencrypted' | 'hacktool' | 'paired' | 'blocked';

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high';

export type EventAction = 'blocked' | 'allowed' | 'warned' | 'info' | 'user-blocked' | 'user-allowed';

/** Pairing security class of a stored link key (root only: read from the Bluetooth config database). */
export type KeyClass = 'legacy' | 'ssp-unauth' | 'ssp-auth' | 'sc-unauth' | 'sc-auth' | 'unknown';

export interface PairingRecord {
  address: string;
  name: string;
  linkKeyType: number;
  le: boolean;
  keyClass: KeyClass;
}

/** A device that Android reports as paired (bonded). Only fields Android actually exposes. */
export interface PairedDevice {
  id: string;
  name: string;
  type: DeviceType;
  mac: string;
  transport: 'classic' | 'le' | 'dual' | 'unknown';
  majorClass: string;
  /** 0 = unknown. */
  pairedAt: number;
  /** Last time BlueShield observed this device connected. Set on first sight. */
  lastUsed: number;
  connected: boolean;
  secure: 'sc' | 'legacy' | 'unknown';
  keyClass: KeyClass;
  trusted: boolean;
  note?: string;
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
  source: 'live';
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
  /** Always false: BlueShield no longer generates simulated events. */
  simulated: boolean;
}

export interface TimelinePoint {
  t: number;
  /** Bluetooth advertisements received during this second (real BLE scan). */
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
  /** 'live' = navigator.getBattery(); 'none' = not available on this device. */
  source: 'live' | 'none';
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

/** Hardware and software identity read from the Android OS (APK only). */
export interface DeviceDetails {
  manufacturer: string;
  brand: string;
  model: string;
  androidVersion: string;
  sdkInt: number;
  /** Android security patch level, format YYYY-MM-DD ('' when unknown). */
  securityPatch: string;
}

/** Root detection result. granted = a su binary answered with uid=0. */
export interface RootInfo {
  checked: boolean;
  granted: boolean;
  suBinary: boolean;
  testKeys: boolean;
  message: string;
  checkedAt: number | null;
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
