import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BatteryState, Capabilities, DeviceDetails, DeviceType, EventAction, HelpContent, IncomingRequest, KeyClass, LiveState,
  LocationCtx, Mode, ModuleId, NearbyDevice, PairedDevice, PairingRecord, RootInfo, Screen, SecurityEvent, Settings,
  SystemInfo, TimelinePoint, Toast, TrustedPlace,
} from '../types';
import { DEFAULT_MODULES, MODULE_MAP, RECOMMENDED_MODULES, SEVERITY_RANK } from '../data/modules';
import { daysSince, hashAngle, inTimeWindow, uid } from '../lib/utils';
import { effectiveMode, LOCATION_LABEL } from '../lib/mode';
import { moduleStatus, type CheckInput } from '../lib/checks';
import { detectCapabilities, showNotification, vibrate } from '../platform/system';
import {
  classifyAdvert, drainAdvertCount, drainLiveBuffer, nativeStartScan, nativeStopScan, webStartScan, webStopScan, type LiveAdvert,
} from '../platform/ble';
import { isNativeApp, keyClassOf, native, type PermissionState } from '../platform/native';

export interface Flood {
  until: number;
  pps: number;
  source: string;
  blocked: boolean;
}
export type EventInput = Omit<SecurityEvent, 'id' | 'time' | 'simulated'> & { simulated?: boolean };
export type SheetName = 'score' | 'location' | 'audit' | 'pair' | 'rename' | null;

export const DEFAULT_SETTINGS: Settings = {
  beginnerMode: true,
  autoOffMinutes: 10,
  nightEnabled: false,
  nightFrom: '23:30',
  nightTo: '07:00',
  offWhenLeaving: true,
  discoverableTimeout: 60,
  pairingOnlyTrusted: false,
  autoRejectUnknown: false,
  sensitivity: 2,
  notifications: false,
  vibration: true,
  dosThreshold: 300,
  minKeyBytes: 16,
  staleDays: 90,
  useGps: false,
};

export interface State {
  screen: Screen;
  onboarded: boolean;
  master: Mode;
  radioMode: Mode;
  /** true only when Android reports the Bluetooth adapter as ON. */
  radioOn: boolean;
  /** Time of the last radio on/off attempt (rate limit for automatic actions). */
  radioAttemptAt: number;
  /** Discoverable state reported by Android (scan mode). */
  discoverable: boolean;
  discoverableUntil: number | null;
  /** Bluetooth name reported by Android. Empty until read. */
  deviceName: string;
  modules: Record<ModuleId, Mode>;
  settings: Settings;
  paired: PairedDevice[];
  connectedIds: string[];
  blocked: { mac: string; name: string; at: number }[];
  trustedMacs: string[];
  events: SecurityEvent[];
  stats: { blocked: number; allowed: number; warned: number; correct: number; wrong: number; since: number };
  updatesCheckedAt: number | null;
  location: LocationCtx;
  trustedPlaces: TrustedPlace[];
  radarMode: Mode;
  quizBest: number | null;
  pairings: PairingRecord[] | null;
  pairingsError: string | null;
  readEventsAt: number;

  nearby: NearbyDevice[];
  timeline: TimelinePoint[];
  lastActivity: number;
  pendingRequest: IncomingRequest | null;
  toasts: Toast[];
  help: HelpContent | null;
  sheet: SheetName;
  selectedDevice: string | null;
  live: LiveState;
  battery: BatteryState;
  sysInfo: SystemInfo | null;
  device: DeviceDetails | null;
  permissions: PermissionState | null;
  root: RootInfo;
  caps: Capabilities;
  flood: Flood | null;
  lastEventAt: number;
  tickCount: number;

  go: (s: Screen) => void;
  completeOnboarding: (beginner: boolean) => void;
  setMaster: (m: Mode) => void;
  setRadioMode: (m: Mode) => void;
  wakeRadio: () => void;
  setRadioPower: (on: boolean, reason: string) => Promise<void>;
  setModule: (id: ModuleId, m: Mode) => void;
  setAllModules: (m: Mode | 'recommended') => void;
  setDiscoverable: (on: boolean) => void;
  setDeviceName: (n: string) => void;
  updateSettings: (p: Partial<Settings>) => void;
  setLocation: (l: LocationCtx, reason?: string) => void;
  addTrustedPlace: (p: TrustedPlace) => void;
  removeTrustedPlace: (id: string) => void;
  togglePairedConnection: (id: string) => void;
  removePaired: (id: string) => void;
  removeStale: () => Promise<number>;
  pairNew: (nearbyId: string) => boolean;
  blockDevice: (mac: string, name: string) => void;
  unblockDevice: (mac: string) => void;
  trustDevice: (mac: string) => void;
  addEvent: (e: EventInput) => void;
  resolveRequest: (accept: boolean, timedOut?: boolean) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  openHelp: (h: HelpContent) => void;
  closeHelp: () => void;
  openSheet: (s: SheetName) => void;
  selectDevice: (id: string | null) => void;
  markUpdatesChecked: () => void;
  setQuizBest: (n: number) => void;
  markEventsRead: () => void;
  clearEvents: () => void;
  resetAll: () => void;
  runCheck: (id: ModuleId) => void;
  setRadarMode: (m: Mode) => void;
  startLive: () => Promise<void>;
  stopLive: () => Promise<void>;
  setLive: (p: Partial<LiveState>) => void;
  setBatteryLive: (level: number, charging: boolean) => void;
  setSysInfo: (i: SystemInfo) => void;
  checkRoot: () => Promise<void>;
  loadDeviceDetails: () => Promise<void>;
  requestPermissions: () => Promise<PermissionState | null>;
  refreshNative: () => Promise<void>;
  refreshConnected: () => Promise<void>;
  refreshBonded: () => Promise<void>;
  requestPairings: () => Promise<void>;
  tick: () => void;
}

const alertedTrackers = new Set<string>();
const alertedSpoof = new Set<string>();
/** Radar AUTO duty cycle state: true while the native scan is running. */
let dutyOn = true;

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

function secureOf(k: KeyClass): PairedDevice['secure'] {
  if (k.startsWith('sc')) return 'sc';
  if (k === 'unknown') return 'unknown';
  return 'legacy';
}

/** Best-effort device type from the Bluetooth major class (reported by Android) and the name. */
function typeFromClass(major: string, name: string): DeviceType {
  const n = name.toLowerCase();
  if (/car|bmw|audi|toyota|volkswagen|vw|skoda|ford|kia|hyundai|mercedes|renault|peugeot|opel|nissan/.test(n)) return 'car';
  switch (major) {
    case 'audio':
      if (/speaker|boom|flip|charge|soundbar|jbl|soundlink/.test(n)) return 'speaker';
      if (/tv|bravia|chromecast/.test(n)) return 'tv';
      return 'headphones';
    case 'phone':
      return 'phone';
    case 'computer':
      return 'laptop';
    case 'wearable':
      return 'watch';
    case 'peripheral':
      return 'keyboard';
    case 'health':
      return 'fitness';
    default:
      return 'unknown';
  }
}

function macTypeOf(id: string): NearbyDevice['macType'] {
  const m = id.match(/^([0-9A-Fa-f]{2}):/);
  if (!m) return 'random';
  const b = parseInt(m[1], 16);
  if ((b & 0xc0) === 0x40) return 'rpa';
  if ((b & 0xc0) === 0xc0) return 'random';
  return 'public';
}

/** Merges a real BLE scan snapshot into the nearby list. Entries are dropped after 30 s without a sighting. */
function ingestLive(nearby: NearbyDevice[], adverts: LiveAdvert[], now: number): NearbyDevice[] {
  const map = new Map(nearby.map((d) => [d.id, d] as const));
  for (const a of adverts) {
    const ex = map.get(a.id);
    if (ex) {
      map.set(a.id, { ...ex, name: a.name ?? ex.name, rssi: a.rssi, rssiHistory: [...ex.rssiHistory, a.rssi].slice(-40), lastSeen: now });
    } else {
      const c = classifyAdvert(a);
      const looksMac = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(a.id);
      map.set(a.id, {
        id: a.id,
        name: a.name,
        type: c.type,
        mac: looksMac ? a.id.toUpperCase() : '— (masked by Android)',
        macType: macTypeOf(a.id),
        protocol: 'ble',
        manufacturer: c.manufacturer,
        rssi: a.rssi,
        rssiBase: a.rssi,
        rssiHistory: [a.rssi],
        txPower: a.txPower,
        firstSeen: now,
        lastSeen: now,
        risk: c.risk,
        reason: c.reason,
        tags: c.tags,
        encrypted: null,
        source: 'live',
        services: c.services,
        angle: hashAngle(a.id),
        label: c.label,
      });
    }
  }
  return Array.from(map.values()).filter((d) => now - d.lastSeen < 30000);
}

function checkInput(s: State): CheckInput {
  return {
    radioKnown: s.caps.native,
    radioOn: s.live.btEnabled === true,
    discoverable: s.discoverable,
    root: s.root.granted,
    device: s.device,
    paired: s.paired,
    pairings: s.pairings,
    nearby: s.nearby,
    scanning: s.live.scanning,
    packetsPerSec: s.timeline.length ? s.timeline[s.timeline.length - 1].packets : 0,
    dosThreshold: s.settings.dosThreshold,
  };
}

function persistedDefaults(now: number) {
  return {
    onboarded: false,
    master: 'on' as Mode,
    radioMode: 'on' as Mode,
    deviceName: '',
    modules: { ...DEFAULT_MODULES },
    settings: { ...DEFAULT_SETTINGS },
    paired: [] as PairedDevice[],
    blocked: [] as { mac: string; name: string; at: number }[],
    trustedMacs: [] as string[],
    events: [] as SecurityEvent[],
    stats: { blocked: 0, allowed: 0, warned: 0, correct: 0, wrong: 0, since: now },
    updatesCheckedAt: null as number | null,
    location: 'home' as LocationCtx,
    trustedPlaces: [
      { id: 'tp-home', name: 'Home', kind: 'home', radius: 150 },
      { id: 'tp-work', name: 'Work', kind: 'work', radius: 200 },
    ] as TrustedPlace[],
    radarMode: 'on' as Mode,
    quizBest: null as number | null,
    readEventsAt: now,
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      screen: 'home',
      ...persistedDefaults(Date.now()),
      radioOn: false,
      radioAttemptAt: 0,
      discoverable: false,
      discoverableUntil: null,
      connectedIds: [],
      pairings: null,
      pairingsError: null,
      nearby: [],
      timeline: [],
      lastActivity: Date.now(),
      pendingRequest: null,
      toasts: [],
      help: null,
      sheet: null,
      selectedDevice: null,
      live: { btEnabled: null, scanning: false, error: null, bonded: [] },
      battery: { source: 'none', level: 0, charging: false, history: [] },
      sysInfo: null,
      device: null,
      permissions: null,
      root: { checked: false, granted: false, suBinary: false, testKeys: false, message: 'Root status not checked yet.', checkedAt: null },
      caps: detectCapabilities(),
      flood: null,
      lastEventAt: 0,
      tickCount: 0,

      go: (screen) => {
        if (screen === get().screen) return;
        try {
          window.history.pushState({ screen }, '');
        } catch {
          /* ignore */
        }
        set({ screen, lastActivity: Date.now(), ...(screen === 'events' ? { readEventsAt: Date.now() } : {}) });
      },

      completeOnboarding: (beginner) => set((s) => ({ onboarded: true, settings: { ...s.settings, beginnerMode: beginner } })),

      setMaster: (m) => {
        set({ master: m });
        const t = { on: 'Master protection is ACTIVE', off: 'Master protection is OFF: no module can alert or act', auto: 'Smart protection (AUTO) active' }[m];
        get().toast(t, m === 'off' ? 'warning' : 'success');
      },

      setRadioMode: (m) => {
        const s = get();
        if (!isNativeApp()) {
          get().toast('Bluetooth controls work only in the BlueShield Android app.', 'warning');
          return;
        }
        if (m !== 'on' && !s.root.granted) {
          get().toast('Turning Bluetooth off or using AUTO requires root access. These options are greyed out on your device.', 'warning');
          return;
        }
        set({ radioMode: m, lastActivity: Date.now() });
        get().toast(
          m === 'off'
            ? 'OFF: BlueShield keeps Bluetooth turned off'
            : m === 'on'
              ? 'ON: Bluetooth stays on'
              : `AUTO: Bluetooth turns off after ${s.settings.autoOffMinutes} minutes without a connected device`,
          m === 'on' ? 'info' : 'success',
        );
        if (m === 'on' && s.live.btEnabled === false) void get().wakeRadio();
        if (m === 'off' && s.live.btEnabled === true) void get().setRadioPower(false, 'OFF mode');
      },

      wakeRadio: () => {
        if (!isNativeApp()) {
          get().toast('Bluetooth controls work only in the BlueShield Android app.', 'warning');
          return;
        }
        set({ lastActivity: Date.now() });
        void get().setRadioPower(true, 'manual request');
      },

      setRadioPower: async (on, reason) => {
        const s = get();
        if (s.live.btEnabled !== null && on === s.live.btEnabled) return;
        set({ radioAttemptAt: Date.now() });
        if (!isNativeApp()) {
          get().toast('Bluetooth controls work only in the BlueShield Android app.', 'warning');
          return;
        }
        try {
          if (on) {
            if (s.root.granted) {
              const r = await native.setRadio({ enabled: true });
              if (!r.ok) get().toast(r.message, 'warning');
            } else {
              await native.requestEnable();
            }
          } else {
            const r = await native.setRadio({ enabled: false });
            get().addEvent({
              moduleId: null,
              severity: 'info',
              action: 'info',
              title: r.ok ? 'Bluetooth turned OFF' : 'Bluetooth could not be turned off',
              description: r.ok ? `Turned off with root access (${reason}).` : r.message,
              advice: 'Wake Bluetooth from the Home screen when you need it again.',
            });
            if (!r.ok) get().toast(r.message, 'danger');
          }
        } catch (e) {
          get().toast(errorText(e), 'danger');
        }
        await get().refreshNative();
      },

      setModule: (id, m) => set((s) => ({ modules: { ...s.modules, [id]: m } })),

      setAllModules: (m) => {
        const modules = m === 'recommended' ? { ...RECOMMENDED_MODULES } : (Object.fromEntries(Object.keys(DEFAULT_MODULES).map((k) => [k, m])) as Record<ModuleId, Mode>);
        set({ modules });
        get().toast(m === 'recommended' ? 'Applied the recommended protection preset' : `All modules set to ${m.toUpperCase()}`, m === 'off' ? 'warning' : 'success');
      },

      setDiscoverable: (on) => {
        const s = get();
        if (!isNativeApp()) {
          get().toast('Discoverable mode can be changed only in the BlueShield Android app.', 'warning');
          return;
        }
        if (on) {
          if (s.live.btEnabled !== true) {
            get().toast('Turn Bluetooth ON first.', 'warning');
            return;
          }
          native
            .requestDiscoverable({ seconds: s.settings.discoverableTimeout })
            .then(() => set({ discoverableUntil: Date.now() + s.settings.discoverableTimeout * 1000, lastActivity: Date.now() }))
            .catch((e: unknown) => get().toast(errorText(e), 'danger'));
          get().toast('Confirm the Android dialog to make your phone visible for a limited time.', 'info');
          return;
        }
        if (s.root.granted && s.discoverable) {
          get().toast('Root: restarting Bluetooth to end discoverable mode.', 'info');
          void (async () => {
            await native.setRadio({ enabled: false });
            await native.setRadio({ enabled: true });
            await get().refreshNative();
          })();
          return;
        }
        native.openBluetoothSettings().catch(() => undefined);
        get().toast('Android does not let apps hide your phone. Turn visibility off in the Bluetooth settings that just opened.', 'info');
      },

      setDeviceName: (n) => {
        const name = n.trim();
        if (!name) return;
        if (!isNativeApp()) {
          get().toast('Renaming the phone works only in the BlueShield Android app.', 'warning');
          return;
        }
        native
          .setDeviceName({ name })
          .then((r) => {
            if (r.ok) {
              set({ deviceName: r.name || name });
              get().toast('Bluetooth name updated', 'success');
            } else {
              get().toast('Android did not accept the new name', 'warning');
            }
          })
          .catch((e: unknown) => get().toast(errorText(e), 'danger'));
      },

      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      setLocation: (l, reason) => {
        const s = get();
        if (l === s.location) return;
        const leaving = s.location !== 'public' && l === 'public';
        set({ location: l, nearby: s.live.scanning ? s.nearby : [] });
        if (leaving && s.radioMode === 'auto' && s.settings.offWhenLeaving && s.root.granted && s.live.btEnabled === true) {
          void get().setRadioPower(false, 'left a trusted place');
        }
        get().toast(`Location: ${LOCATION_LABEL[l]}${reason ? ` (${reason})` : ''}`, l === 'public' ? 'warning' : 'info');
      },

      addTrustedPlace: (p) => set((s) => ({ trustedPlaces: [...s.trustedPlaces.filter((x) => x.id !== p.id), p] })),
      removeTrustedPlace: (id) => set((s) => ({ trustedPlaces: s.trustedPlaces.filter((x) => x.id !== id) })),

      togglePairedConnection: (id) => {
        const d = get().paired.find((p) => p.id === id);
        if (!d) return;
        get().toast(`Connect or disconnect "${d.name}" from the Android Bluetooth settings.`, 'info');
        if (isNativeApp()) native.openBluetoothSettings().catch(() => undefined);
      },

      removePaired: (id) => {
        const d = get().paired.find((p) => p.id === id);
        if (!d) return;
        if (!isNativeApp()) {
          get().toast('Forgetting a pairing works only in the BlueShield Android app.', 'warning');
          return;
        }
        native
          .removeBond({ address: id })
          .then(async (r) => {
            get().toast(r.ok ? `Forgot "${d.name}"` : `Android did not remove "${d.name}"`, r.ok ? 'success' : 'warning');
            await get().refreshBonded();
          })
          .catch((e: unknown) => get().toast(errorText(e), 'danger'));
      },

      removeStale: async () => {
        const s = get();
        const stale = s.paired.filter((p) => !p.connected && p.lastUsed > 0 && daysSince(p.lastUsed) > s.settings.staleDays);
        if (!stale.length) {
          get().toast('No stale devices found', 'info');
          return 0;
        }
        if (!isNativeApp()) {
          get().toast('Removing pairings works only in the BlueShield Android app.', 'warning');
          return 0;
        }
        let removed = 0;
        for (const p of stale) {
          try {
            const r = await native.removeBond({ address: p.id });
            if (r.ok) removed += 1;
          } catch {
            /* continue with the next device */
          }
        }
        await get().refreshBonded();
        get().addEvent({
          moduleId: 'bias',
          severity: 'info',
          action: 'info',
          title: `Removed ${removed} stale pairing${removed === 1 ? '' : 's'}`,
          description: `Forgotten: ${stale.map((p) => p.name).join(', ')}. Fewer saved identities lowers the risk of BIAS-style impersonation.`,
          advice: 'Repeat this cleanup every few months.',
        });
        get().toast(`Removed ${removed} stale device${removed === 1 ? '' : 's'}`, 'success');
        return removed;
      },

      pairNew: (nearbyId) => {
        const d = get().nearby.find((x) => x.id === nearbyId);
        if (!d) return false;
        if (!isNativeApp()) {
          get().toast('Pairing works only in the BlueShield Android app (through Android settings).', 'warning');
          return false;
        }
        native.openBluetoothSettings().catch(() => undefined);
        get().toast('Pairing happens in Android Bluetooth settings. Pair at home, not in public places.', 'info');
        return true;
      },

      blockDevice: (mac, name) => {
        set((s) => ({ blocked: [{ mac, name, at: Date.now() }, ...s.blocked.filter((b) => b.mac !== mac)], trustedMacs: s.trustedMacs.filter((m) => m !== mac) }));
        get().toast(`"${name}" added to your local block list (Android itself is not changed)`, 'info');
      },
      unblockDevice: (mac) => set((s) => ({ blocked: s.blocked.filter((b) => b.mac !== mac) })),
      trustDevice: (mac) => {
        set((s) => ({
          trustedMacs: s.trustedMacs.includes(mac) ? s.trustedMacs.filter((m) => m !== mac) : [...s.trustedMacs, mac],
          blocked: s.blocked.filter((b) => b.mac !== mac),
        }));
      },

      addEvent: (e) => {
        const now = Date.now();
        const ev: SecurityEvent = {
          id: uid(),
          time: now,
          simulated: false,
          moduleId: e.moduleId,
          severity: e.severity,
          title: e.title,
          description: e.description,
          advice: e.advice,
          device: e.device,
          action: e.action,
        };
        set((s) => ({
          events: [ev, ...s.events].slice(0, 300),
          lastEventAt: e.severity === 'info' ? s.lastEventAt : now,
          stats: {
            ...s.stats,
            blocked: s.stats.blocked + (e.action === 'blocked' || e.action === 'user-blocked' ? 1 : 0),
            allowed: s.stats.allowed + (e.action === 'allowed' || e.action === 'user-allowed' ? 1 : 0),
            warned: s.stats.warned + (e.action === 'warned' ? 1 : 0),
          },
        }));
        const s = get();
        const rank = SEVERITY_RANK[e.severity];
        if (s.settings.vibration && rank >= 3 && e.action !== 'info') vibrate(e.action === 'allowed' ? [200, 80, 200] : [90, 50, 90]);
        if (s.settings.notifications && rank >= 3 && e.action !== 'info') {
          void showNotification(`${e.action === 'blocked' ? 'Blocked: ' : 'Warning: '}${e.title}`, e.description.slice(0, 140));
        }
      },

      resolveRequest: (accept, timedOut) => {
        const r = get().pendingRequest;
        if (!r) return;
        set((s) => ({
          pendingRequest: null,
          stats: { ...s.stats, correct: s.stats.correct + (accept ? 0 : 1), wrong: s.stats.wrong + (accept ? 1 : 0) },
        }));
        get().addEvent({
          moduleId: r.moduleId,
          severity: r.severity,
          title: r.title,
          device: r.deviceName,
          advice: r.advice,
          description: r.description + (accept ? ' You accepted the request.' : timedOut ? ' The request timed out.' : ' You rejected the request.'),
          action: accept ? 'user-allowed' : 'user-blocked',
        });
      },

      toast: (text, tone = 'info') => {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
        setTimeout(() => get().dismissToast(id), tone === 'danger' ? 6000 : 3600);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      openHelp: (h) => set({ help: h }),
      closeHelp: () => set({ help: null }),
      openSheet: (sheet) => set({ sheet }),
      selectDevice: (id) => set({ selectedDevice: id }),

      markUpdatesChecked: () => {
        set({ updatesCheckedAt: Date.now() });
        get().toast('Recorded: you checked for software updates', 'success');
      },
      setQuizBest: (n) => set((s) => ({ quizBest: Math.max(n, s.quizBest ?? 0) })),
      markEventsRead: () => set({ readEventsAt: Date.now() }),
      clearEvents: () => {
        set({ events: [], stats: { blocked: 0, allowed: 0, warned: 0, correct: 0, wrong: 0, since: Date.now() } });
        get().toast('Event log cleared', 'info');
      },
      resetAll: () => {
        const now = Date.now();
        set({
          ...persistedDefaults(now),
          onboarded: true,
          nearby: [],
          timeline: [],
          pendingRequest: null,
          flood: null,
          screen: 'home',
          sheet: null,
          connectedIds: [],
          pairings: null,
          pairingsError: null,
        });
        get().toast('All BlueShield settings restored to defaults', 'info');
      },

      runCheck: (id) => {
        const s = get();
        const mod = MODULE_MAP[id];
        const status = moduleStatus(id, checkInput(s));
        const mode = effectiveMode(s.master, s.modules[id], s.location);
        const action: EventAction = status.exposed === true ? (mode === 'off' ? 'allowed' : 'warned') : 'info';
        get().addEvent({
          moduleId: id,
          severity: status.severity,
          action,
          title: `${mod.attack}: ${status.headline}`,
          description: status.detail,
          advice: mod.tips[0] ?? mod.threat,
        });
        get().toast(
          status.exposed === null
            ? `${mod.attack}: not enough data yet`
            : status.exposed
              ? `${mod.attack}: exposure found`
              : `${mod.attack}: no exposure found`,
          status.exposed === true ? 'warning' : status.exposed === false ? 'success' : 'info',
        );
      },

      setRadarMode: (m) => {
        set({ radarMode: m });
        get().toast(
          m === 'auto'
            ? 'Radar AUTO: scans in 12-second bursts every 30 seconds to save battery'
            : m === 'on'
              ? 'Radar ON: continuous scanning while a live scan is running'
              : 'Radar OFF: scanning paused',
          'info',
        );
      },

      startLive: async () => {
        const s = get();
        try {
          if (s.caps.native) {
            const perm = await native.requestPermissions();
            set({ permissions: perm });
            const granted = perm.needsLocation ? perm.location : perm.scan;
            if (!granted) {
              throw new Error(
                perm.needsLocation
                  ? 'Location permission is needed to scan on Android 11 and older.'
                  : 'The "Nearby devices" permission is needed to scan.',
              );
            }
            if (get().live.btEnabled !== true) throw new Error('Turn Bluetooth ON to scan nearby devices.');
            await nativeStartScan();
          } else if (s.caps.leScan) {
            await webStartScan();
          } else {
            throw new Error('Live BLE scanning works only in the BlueShield Android app.');
          }
          drainLiveBuffer();
          drainAdvertCount();
          dutyOn = true;
          set({ live: { ...get().live, scanning: true, error: null }, nearby: [] });
          get().toast('Live BLE scan started', 'success');
        } catch (e) {
          const msg = errorText(e);
          set({ live: { ...get().live, scanning: false, error: msg } });
          get().toast(msg, 'warning');
        }
      },

      stopLive: async () => {
        const s = get();
        if (s.caps.native) await nativeStopScan();
        else webStopScan();
        dutyOn = true;
        set({ live: { ...get().live, scanning: false }, nearby: [] });
      },

      setLive: (p) => set((s) => ({ live: { ...s.live, ...p } })),

      setBatteryLive: (level, charging) =>
        set((s) => ({
          battery: {
            source: 'live',
            level,
            charging,
            history: [...(s.battery.source === 'live' ? s.battery.history : []), { t: Date.now(), level }].slice(-240),
          },
        })),

      setSysInfo: (i) => set({ sysInfo: i }),

      checkRoot: async () => {
        if (!isNativeApp()) {
          set({
            root: { checked: true, granted: false, suBinary: false, testKeys: false, message: 'Root detection runs only inside the BlueShield Android app.', checkedAt: Date.now() },
          });
          return;
        }
        try {
          const r = await native.getRootStatus();
          set((s) => ({
            root: { checked: true, granted: r.granted, suBinary: r.suBinary, testKeys: r.testKeys, message: r.message, checkedAt: Date.now() },
            // Without root, OFF and AUTO are unavailable: fall back to ON so the UI never shows a locked mode as active.
            radioMode: r.granted || s.radioMode === 'on' ? s.radioMode : 'on',
          }));
        } catch (e) {
          set({ root: { checked: true, granted: false, suBinary: false, testKeys: false, message: errorText(e), checkedAt: Date.now() } });
        }
      },

      loadDeviceDetails: async () => {
        if (!isNativeApp()) return;
        try {
          const d = await native.getDeviceInfo();
          set({
            device: {
              manufacturer: d.manufacturer,
              brand: d.brand,
              model: d.model,
              androidVersion: d.androidVersion,
              sdkInt: d.sdkInt,
              securityPatch: d.securityPatch,
            },
          });
        } catch {
          /* leave unknown */
        }
      },

      requestPermissions: async () => {
        if (!isNativeApp()) return null;
        try {
          const p = await native.requestPermissions();
          set({ permissions: p });
          return p;
        } catch (e) {
          get().toast(errorText(e), 'warning');
          return null;
        }
      },

      refreshNative: async () => {
        if (!isNativeApp()) return;
        try {
          const bt = await native.getBluetoothState();
          set((s) => ({
            radioOn: bt.enabled,
            discoverable: bt.discoverable,
            deviceName: bt.name || s.deviceName,
            live: { ...s.live, btEnabled: bt.enabled, error: bt.hasBluetooth ? null : 'This device has no Bluetooth adapter.' },
          }));
        } catch (e) {
          set((s) => ({ live: { ...s.live, error: errorText(e) } }));
        }
      },

      refreshConnected: async () => {
        if (!isNativeApp() || !get().radioOn) {
          if (get().connectedIds.length) set({ connectedIds: [] });
          return;
        }
        try {
          const r = await native.getConnectedDevices();
          set({ connectedIds: r.addresses });
        } catch {
          /* keep the previous snapshot */
        }
      },

      refreshBonded: async () => {
        if (!isNativeApp() || !get().radioOn) return;
        try {
          const r = await native.getBondedDevices();
          const now = Date.now();
          const prev = get().paired;
          const records = get().pairings ?? [];
          const paired: PairedDevice[] = r.devices.map((d) => {
            const old = prev.find((p) => p.id === d.address);
            const keyClass = records.find((x) => x.address === d.address)?.keyClass ?? old?.keyClass ?? 'unknown';
            return {
              id: d.address,
              name: d.name || 'Unnamed device',
              type: typeFromClass(d.majorClass, d.name),
              mac: d.address,
              transport: d.transport,
              majorClass: d.majorClass,
              pairedAt: old?.pairedAt ?? 0,
              lastUsed: old?.lastUsed || now,
              connected: old?.connected ?? false,
              secure: secureOf(keyClass),
              keyClass,
              trusted: old?.trusted ?? true,
              note: old?.note,
            };
          });
          set({ paired, live: { ...get().live, bonded: paired.map((p) => ({ id: p.id, name: p.name })) } });
        } catch (e) {
          set((s) => ({ live: { ...s.live, error: errorText(e) } }));
        }
      },

      requestPairings: async () => {
        if (!isNativeApp()) {
          get().toast('Pairing analysis works only in the BlueShield Android app.', 'warning');
          return;
        }
        if (!get().root.granted) {
          get().toast('Root access is required to read pairing keys. This option is greyed out on your device.', 'warning');
          return;
        }
        try {
          const r = await native.analyzePairings();
          if (!r.available) {
            set({ pairings: null, pairingsError: r.reason ?? 'Pairing data is unavailable.' });
            get().toast(r.reason ?? 'Pairing data is unavailable.', 'warning');
            return;
          }
          const records: PairingRecord[] = r.devices.map((d) => ({
            address: d.address,
            name: d.name,
            linkKeyType: d.linkKeyType,
            le: d.le,
            keyClass: keyClassOf(d.linkKeyType),
          }));
          set((s) => ({
            pairings: records,
            pairingsError: null,
            paired: s.paired.map((p) => {
              const rec = records.find((x) => x.address === p.id);
              return rec ? { ...p, keyClass: rec.keyClass, secure: secureOf(rec.keyClass) } : p;
            }),
          }));
          get().toast(`Analyzed ${records.length} stored pairing${records.length === 1 ? '' : 's'}`, 'success');
        } catch (e) {
          set({ pairingsError: errorText(e) });
          get().toast(errorText(e), 'danger');
        }
      },

      /** Runs once per second: real BLE traffic, real alerts, and root-only automatic actions. */
      tick: () => {
        const s = get();
        const now = Date.now();
        const tickCount = s.tickCount + 1;
        const events: EventInput[] = [];
        const btOn = s.live.btEnabled === true;
        const root = s.root.granted;
        const packets = drainAdvertCount();
        const drained = drainLiveBuffer();
        const nearby = s.live.scanning ? ingestLive(s.nearby, drained, now) : s.nearby.length ? [] : s.nearby;

        const anyConnected = s.connectedIds.length > 0;
        const lastActivity = anyConnected ? now : s.lastActivity;
        const paired = s.paired.map((p) => {
          const conn = s.connectedIds.includes(p.id);
          if (conn) return p.connected && now - p.lastUsed < 60000 ? p : { ...p, connected: true, lastUsed: now };
          return p.connected ? { ...p, connected: false } : p;
        });

        // Root-only radio automation (OFF enforcement, AUTO idle timeout, night schedule)
        let radioAction: { enable: boolean; reason: string } | null = null;
        if (btOn && root && now - s.radioAttemptAt > 15000) {
          if (s.radioMode === 'off') {
            radioAction = { enable: false, reason: 'OFF mode' };
          } else if (s.radioMode === 'auto') {
            if (s.settings.nightEnabled && inTimeWindow(s.settings.nightFrom, s.settings.nightTo)) {
              radioAction = { enable: false, reason: 'night schedule' };
            } else if (!anyConnected && !s.discoverable && now - lastActivity > s.settings.autoOffMinutes * 60000) {
              radioAction = { enable: false, reason: `idle for ${s.settings.autoOffMinutes} minutes` };
            }
          }
        }

        // DoS: real advertisement rate from the BLE scan
        let flood = s.flood && now < s.flood.until ? s.flood : null;
        if (s.live.scanning && packets > s.settings.dosThreshold && !flood) {
          const eff = effectiveMode(s.master, s.modules.dos, s.location);
          const block = eff === 'on' && root && btOn;
          flood = { until: now + 20000, pps: packets, source: 'nearby advertisements', blocked: block };
          if (block && !radioAction) radioAction = { enable: false, reason: 'advertisement flood' };
          events.push({
            moduleId: 'dos',
            severity: 'high',
            action: eff === 'off' ? 'allowed' : block ? 'blocked' : 'warned',
            title: 'Bluetooth advertisement flood',
            description: `${packets} Bluetooth advertisements arrived in one second (your threshold: ${s.settings.dosThreshold}). Traffic like this is typical of denial-of-service and battery-drain attacks.`,
            advice: 'Turn Bluetooth off until the traffic drops. With root access, DoS protection set to ON turns it off automatically.',
          });
        }

        // BIAS-style impersonation: a nearby device copies the name of a paired device that is out of range
        if (s.live.scanning && tickCount % 5 === 0) {
          const eff = effectiveMode(s.master, s.modules.bias, s.location);
          for (const d of nearby) {
            const dn = d.name;
            if (!dn || alertedSpoof.has(d.id)) continue;
            const match = paired.find(
              (p) => p.id !== d.id && p.name !== 'Unnamed device' && p.name.toLowerCase() === dn.toLowerCase() && !nearby.some((x) => x.id === p.id),
            );
            if (!match) continue;
            alertedSpoof.add(d.id);
            events.push({
              moduleId: 'bias',
              severity: 'high',
              action: eff === 'off' ? 'allowed' : 'warned',
              device: dn,
              title: 'Possible impersonation of a paired device',
              description: `A nearby device "${dn}" (${d.id}) uses the name of your paired device "${match.name}" (${match.id}), which is out of range. BIAS-style attacks copy names and addresses.`,
              advice: 'Do not accept requests from this device. Forget duplicates you do not recognize in Devices.',
            });
            if (eff === 'on' && root && btOn && !radioAction) radioAction = { enable: false, reason: 'possible impersonation' };
          }
        }

        // Trackers that stay near you
        if (s.live.scanning) {
          for (const d of nearby) {
            if (d.tags.includes('tracker') && now - d.firstSeen > 10 * 60000 && !alertedTrackers.has(d.id)) {
              alertedTrackers.add(d.id);
              const eff = effectiveMode(s.master, s.modules.tracking, s.location);
              const label = d.label || d.name || 'Tracker';
              events.push({
                moduleId: 'tracking',
                severity: 'high',
                action: eff === 'off' ? 'allowed' : 'warned',
                device: label,
                title: 'Tracker near you for over 10 minutes',
                description: `"${label}" has been detected near you for ${Math.round((now - d.firstSeen) / 60000)} minutes.`,
                advice: 'Use Radar → Locate. If it does not belong to you or someone travelling with you, check your belongings.',
              });
            }
          }
        }

        // Radar AUTO duty cycle: 12 s of scanning every 30 s
        if (s.live.scanning && s.caps.native) {
          const wantScan = s.radarMode !== 'auto' || Math.floor(now / 1000) % 30 < 12;
          if (wantScan !== dutyOn) {
            dutyOn = wantScan;
            void (wantScan ? nativeStartScan() : nativeStopScan());
          }
        }

        const timeline = [
          ...s.timeline,
          { t: now, packets, blocked: flood?.blocked ? packets : 0, threats: events.filter((e) => e.severity !== 'info').length },
        ].slice(-90);

        set({ tickCount, nearby, paired, flood, timeline, lastActivity });
        for (const e of events) get().addEvent(e);
        if (radioAction) void get().setRadioPower(radioAction.enable, radioAction.reason);
      },
    }),
    {
      name: 'blueshield-en-v2',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        master: s.master,
        radioMode: s.radioMode,
        deviceName: s.deviceName,
        modules: s.modules,
        settings: s.settings,
        paired: s.paired,
        blocked: s.blocked,
        trustedMacs: s.trustedMacs,
        events: s.events.slice(0, 150),
        stats: s.stats,
        updatesCheckedAt: s.updatesCheckedAt,
        location: s.location,
        trustedPlaces: s.trustedPlaces,
        radarMode: s.radarMode,
        quizBest: s.quizBest,
        readEventsAt: s.readEventsAt,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<State>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings || {}) },
          modules: { ...current.modules, ...(p.modules || {}) },
        };
      },
    },
  ),
);
