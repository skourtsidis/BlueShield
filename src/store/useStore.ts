import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BatteryState, Capabilities, EventAction, HelpContent, IncomingRequest, LiveState, LocationCtx, Mode, ModuleId,
  NearbyDevice, PairedDevice, Permissions, Screen, SecurityEvent, Settings, SystemInfo, TimelinePoint, Toast, TrustedPlace,
} from '../types';
import { DEFAULT_MODULES, MODULE_MAP, RECOMMENDED_MODULES, SEVERITY_RANK } from '../data/modules';
import { chance, clamp, daysSince, hashAngle, inTimeWindow, rand, randInt, randomMac, uid, weightedPick } from '../lib/utils';
import { effectiveMode, LOCATION_LABEL } from '../lib/mode';
import { FOLLOW_TRACKER, generateAttack, initialNearby, initialPaired, randomExtra, spawnDevice, type AttackSpec } from './sim';
import { detectCapabilities, showNotification, vibrate } from '../platform/system';
import {
  classifyAdvert, drainLiveBuffer, nativeOpenSettings, nativeRequestEnable, nativeStartScan, nativeStopScan, webStartScan, webStopScan,
  type LiveAdvert,
} from '../platform/ble';

export interface KeyRecord {
  t: number;
  bytes: number;
  device: string;
  accepted: boolean;
}
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
  simulation: true,
  intensity: 2,
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
  radioOn: boolean;
  discoverable: boolean;
  discoverableUntil: number | null;
  deviceName: string;
  modules: Record<ModuleId, Mode>;
  settings: Settings;
  paired: PairedDevice[];
  blocked: { mac: string; name: string; at: number }[];
  trustedMacs: string[];
  events: SecurityEvent[];
  stats: { blocked: number; allowed: number; warned: number; correct: number; wrong: number; since: number };
  updatesCheckedAt: number | null;
  location: LocationCtx;
  trustedPlaces: TrustedPlace[];
  radarMode: Mode;
  quizBest: number | null;
  keyHistory: KeyRecord[];
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
  caps: Capabilities;
  flood: Flood | null;
  lastEventAt: number;
  tickCount: number;
  macRotations: number;
  autoOffNotified: boolean;

  go: (s: Screen) => void;
  completeOnboarding: (beginner: boolean) => void;
  setMaster: (m: Mode) => void;
  setRadioMode: (m: Mode) => void;
  wakeRadio: () => void;
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
  removeStale: () => number;
  setPermission: (id: string, key: keyof Permissions, v: boolean) => void;
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
  simulateAttack: (id: ModuleId) => void;
  setRadarMode: (m: Mode) => void;
  startLive: () => Promise<void>;
  stopLive: () => Promise<void>;
  setLive: (p: Partial<LiveState>) => void;
  setBatteryLive: (level: number, charging: boolean) => void;
  setSysInfo: (i: SystemInfo) => void;
  tick: () => void;
}

const alertedTrackers = new Set<string>();

function persistedDefaults(now: number) {
  return {
    onboarded: false,
    master: 'on' as Mode,
    radioMode: 'on' as Mode,
    radioOn: true,
    discoverable: false,
    discoverableUntil: null as number | null,
    deviceName: 'Galaxy S23 του Γιώργου',
    modules: { ...DEFAULT_MODULES },
    settings: { ...DEFAULT_SETTINGS },
    paired: initialPaired(now),
    blocked: [] as { mac: string; name: string; at: number }[],
    trustedMacs: [] as string[],
    events: [] as SecurityEvent[],
    stats: { blocked: 0, allowed: 0, warned: 0, correct: 0, wrong: 0, since: now },
    updatesCheckedAt: null as number | null,
    location: 'home' as LocationCtx,
    trustedPlaces: [
      { id: 'tp-home', name: 'Σπίτι', kind: 'home', radius: 150 },
      { id: 'tp-work', name: 'Εργασία', kind: 'work', radius: 200 },
    ] as TrustedPlace[],
    radarMode: 'on' as Mode,
    quizBest: null as number | null,
    keyHistory: [] as KeyRecord[],
    readEventsAt: now,
  };
}

interface AttackOutcome {
  event?: EventInput;
  request?: IncomingRequest;
  flood?: Flood;
  key?: KeyRecord;
  spawnTracker?: boolean;
  blockedPkts: number;
}

function resolveAttack(s: State, spec: AttackSpec, now: number): AttackOutcome {
  const eff = effectiveMode(s.master, s.modules[spec.moduleId], s.location);
  const rank = SEVERITY_RANK[spec.severity];
  const thr = s.settings.sensitivity === 3 ? 1 : s.settings.sensitivity === 2 ? 2 : 3;
  let action: EventAction;
  if (spec.moduleId === 'tracking') action = eff === 'off' ? 'allowed' : eff === 'auto' && rank < thr ? 'info' : 'warned';
  else if (spec.flood) {
    const r = spec.flood.pps / s.settings.dosThreshold;
    action = eff === 'on' ? (r >= 1 ? 'blocked' : 'info') : eff === 'auto' ? (r >= 1.5 ? 'blocked' : 'warned') : 'allowed';
  } else if (spec.keyBytes) {
    const k = spec.keyBytes;
    const min = s.settings.minKeyBytes;
    action = eff === 'on' ? (k >= min ? 'info' : 'blocked') : eff === 'auto' ? (k < 7 ? 'blocked' : k < min ? 'warned' : 'info') : 'allowed';
  } else action = eff === 'on' ? 'blocked' : eff === 'auto' ? (rank >= thr ? 'blocked' : 'warned') : 'allowed';

  const out: AttackOutcome = { blockedPkts: 0 };
  let description = spec.description;
  // Στο AUTO, τα αιτήματα που δεν είναι ξεκάθαρα κακόβουλα φτάνουν στον χρήστη για απόφαση
  if (spec.request && eff === 'auto' && action === 'blocked' && chance(0.5)) action = 'warned';
  if (spec.request && action !== 'blocked') {
    if (s.settings.autoRejectUnknown) {
      action = 'blocked';
      description += ' Απορρίφθηκε αυτόματα λόγω της ρύθμισης «Αυτόματη απόρριψη άγνωστων αιτημάτων».';
    } else if (!s.pendingRequest) {
      out.request = {
        id: uid(),
        kind: spec.request.kind,
        deviceName: spec.device,
        mac: spec.mac,
        detail: spec.request.detail,
        pin: spec.request.kind === 'pair' ? String(randInt(100000, 999999)) : undefined,
        moduleId: spec.moduleId,
        severity: spec.severity,
        explanation: spec.request.explanation,
        createdAt: now,
        title: spec.title,
        description: spec.description,
        advice: spec.advice,
      };
      return out;
    } else action = 'warned';
  }
  out.event = { moduleId: spec.moduleId, severity: spec.severity, title: spec.title, description, advice: spec.advice, device: spec.device, action };
  if (spec.flood) out.flood = { until: now + spec.flood.seconds * 1000, pps: spec.flood.pps, source: spec.device, blocked: action === 'blocked' };
  if (spec.keyBytes) out.key = { t: now, bytes: spec.keyBytes, device: spec.device, accepted: action !== 'blocked' };
  if (spec.trackerFollow) out.spawnTracker = true;
  out.blockedPkts = action === 'blocked' ? randInt(4, 30) : 0;
  return out;
}

function macTypeOf(id: string): NearbyDevice['macType'] {
  const m = id.match(/^([0-9A-Fa-f]{2}):/);
  if (!m) return 'random';
  const b = parseInt(m[1], 16);
  if ((b & 0xc0) === 0x40) return 'rpa';
  if ((b & 0xc0) === 0xc0) return 'random';
  return 'public';
}

function ingestLive(nearby: NearbyDevice[], adverts: LiveAdvert[], now: number): NearbyDevice[] {
  const map = new Map(nearby.filter((d) => d.source === 'live').map((d) => [d.id, d] as const));
  for (const a of adverts) {
    const ex = map.get(a.id);
    if (ex) {
      map.set(a.id, { ...ex, name: a.name ?? ex.name, rssi: a.rssi, rssiHistory: [...ex.rssiHistory, a.rssi].slice(-40), lastSeen: now });
    } else {
      const c = classifyAdvert(a);
      const looksMac = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(a.id);
      map.set(a.id, {
        id: a.id, name: a.name, type: c.type, mac: looksMac ? a.id.toUpperCase() : '— (κρυφή από τον browser)', macType: macTypeOf(a.id),
        protocol: 'ble', manufacturer: c.manufacturer, rssi: a.rssi, rssiBase: a.rssi, rssiHistory: [a.rssi], txPower: a.txPower,
        firstSeen: now, lastSeen: now, risk: c.risk, reason: c.reason, tags: c.tags, encrypted: null, source: 'live',
        services: c.services, angle: hashAngle(a.id), label: c.label,
      });
    }
  }
  return Array.from(map.values()).filter((d) => now - d.lastSeen < 30000);
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      screen: 'home',
      ...persistedDefaults(Date.now()),
      nearby: [],
      timeline: [],
      lastActivity: Date.now(),
      pendingRequest: null,
      toasts: [],
      help: null,
      sheet: null,
      selectedDevice: null,
      live: { btEnabled: null, scanning: false, error: null, bonded: [] },
      battery: { source: 'sim', level: 82, charging: false, history: [] },
      sysInfo: null,
      caps: detectCapabilities(),
      flood: null,
      lastEventAt: 0,
      tickCount: 0,
      macRotations: 0,
      autoOffNotified: false,

      go: (screen) => {
        if (screen === get().screen) return;
        try {
          window.history.pushState({ screen }, '');
        } catch {
          /* ignore */
        }
        set({ screen, ...(screen === 'events' ? { readEventsAt: Date.now() } : {}) });
      },

      completeOnboarding: (beginner) => set((s) => ({ onboarded: true, settings: { ...s.settings, beginnerMode: beginner } })),

      setMaster: (m) => {
        set({ master: m });
        const t = { on: 'Η κεντρική προστασία είναι ΕΝΕΡΓΗ', off: 'Η κεντρική προστασία ΑΠΕΝΕΡΓΟΠΟΙΗΘΗΚΕ', auto: 'Έξυπνη προστασία (AUTO) ενεργή' }[m];
        get().toast(t, m === 'off' ? 'warning' : 'success');
      },

      setRadioMode: (m) => {
        const s = get();
        const now = Date.now();
        if (s.live.btEnabled !== null) {
          if (m === 'on' && !s.live.btEnabled) void nativeRequestEnable();
          if (m === 'off' && s.live.btEnabled) {
            void nativeOpenSettings();
            get().toast('Το Android δεν επιτρέπει σε εφαρμογές να κλείνουν μόνες τους το Bluetooth. Κλείστε το από τις ρυθμίσεις που άνοιξαν.', 'info');
          }
          set({ radioMode: m, lastActivity: now, autoOffNotified: false });
          return;
        }
        set({ radioMode: m, radioOn: m !== 'off', lastActivity: now, autoOffNotified: false });
        get().toast(
          m === 'off' ? 'Bluetooth OFF — μέγιστη ασφάλεια' : m === 'on' ? 'Bluetooth μόνιμα ON' : `Bluetooth AUTO — κλείνει μετά από ${s.settings.autoOffMinutes}′ αδράνειας`,
          m === 'on' ? 'info' : 'success',
        );
      },

      wakeRadio: () => {
        const s = get();
        if (s.live.btEnabled !== null) {
          void nativeRequestEnable();
          return;
        }
        set({ radioOn: true, lastActivity: Date.now() });
        get().toast('Το Bluetooth ενεργοποιήθηκε προσωρινά (AUTO)', 'info');
      },

      setModule: (id, m) => set((s) => ({ modules: { ...s.modules, [id]: m } })),

      setAllModules: (m) => {
        const modules = m === 'recommended' ? { ...RECOMMENDED_MODULES } : (Object.fromEntries(Object.keys(DEFAULT_MODULES).map((k) => [k, m])) as Record<ModuleId, Mode>);
        set({ modules });
        get().toast(m === 'recommended' ? 'Εφαρμόστηκαν οι προτεινόμενες ρυθμίσεις' : `Όλες οι μονάδες σε ${m.toUpperCase()}`, m === 'off' ? 'warning' : 'success');
      },

      setDiscoverable: (on) => {
        const s = get();
        if (on && !s.radioOn) {
          get().toast('Ενεργοποιήστε πρώτα το Bluetooth', 'warning');
          return;
        }
        set({ discoverable: on, discoverableUntil: on ? Date.now() + s.settings.discoverableTimeout * 1000 : null });
        if (on) get().toast(`Ορατό για ${s.settings.discoverableTimeout} δευτ. — μετά κλείνει αυτόματα`, 'info');
      },

      setDeviceName: (n) => {
        set({ deviceName: n.trim() || get().deviceName });
        get().toast('Το όνομα συσκευής ενημερώθηκε', 'success');
      },

      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      setLocation: (l, reason) => {
        const s = get();
        if (l === s.location) return;
        const leaving = s.location !== 'public' && l === 'public';
        const patch: Partial<State> = { location: l, nearby: s.live.scanning ? s.nearby : [] };
        if (leaving && s.radioMode === 'auto' && s.settings.offWhenLeaving && s.radioOn && s.live.btEnabled === null) {
          patch.radioOn = false;
          set(patch);
          get().addEvent({
            moduleId: null, severity: 'info', action: 'info', simulated: true,
            title: 'Το Bluetooth απενεργοποιήθηκε αυτόματα',
            description: `Φύγατε από έμπιστη τοποθεσία (${LOCATION_LABEL[s.location]}). Η λειτουργία AUTO έκλεισε το Bluetooth για να σας προστατεύσει.`,
            advice: 'Μπορείτε να το ενεργοποιήσετε προσωρινά από την Αρχική, όποτε το χρειαστείτε.',
          });
        } else set(patch);
        get().toast(`Τοποθεσία: ${LOCATION_LABEL[l]}${reason ? ` (${reason})` : ''}`, l === 'public' ? 'warning' : 'info');
      },

      addTrustedPlace: (p) => set((s) => ({ trustedPlaces: [...s.trustedPlaces.filter((x) => x.id !== p.id), p] })),
      removeTrustedPlace: (id) => set((s) => ({ trustedPlaces: s.trustedPlaces.filter((x) => x.id !== id) })),

      togglePairedConnection: (id) => {
        const s = get();
        const d = s.paired.find((p) => p.id === id);
        if (!d) return;
        const now = Date.now();
        if (!d.connected && !s.radioOn) {
          if (s.radioMode === 'off' || s.live.btEnabled !== null) {
            get().toast('Το Bluetooth είναι κλειστό. Ενεργοποιήστε το πρώτα.', 'warning');
            return;
          }
          set({ radioOn: true });
        }
        set({ paired: s.paired.map((p) => (p.id === id ? { ...p, connected: !p.connected, lastUsed: now } : p)), lastActivity: now });
        get().toast(d.connected ? `Αποσυνδέθηκε: ${d.name}` : `Συνδέθηκε: ${d.name}`, 'info');
      },

      removePaired: (id) => {
        const d = get().paired.find((p) => p.id === id);
        set((s) => ({ paired: s.paired.filter((p) => p.id !== id) }));
        if (d) get().toast(`Αφαιρέθηκε: ${d.name}`, 'success');
      },

      removeStale: () => {
        const s = get();
        const stale = s.paired.filter((p) => daysSince(p.lastUsed) > s.settings.staleDays);
        if (!stale.length) return 0;
        set({ paired: s.paired.filter((p) => daysSince(p.lastUsed) <= s.settings.staleDays) });
        get().addEvent({
          moduleId: 'bias', severity: 'info', action: 'info', simulated: true,
          title: `Αφαιρέθηκαν ${stale.length} παλιές συσκευές`,
          description: `Διαγράφηκαν: ${stale.map((p) => p.name).join(', ')}. Λιγότερες αποθηκευμένες «έμπιστες» συσκευές σημαίνει μικρότερο ρίσκο πλαστοπροσωπίας (BIAS).`,
          advice: 'Επαναλάβετε τον έλεγχο κάθε λίγους μήνες.',
        });
        get().toast(`Αφαιρέθηκαν ${stale.length} παλιές συσκευές`, 'success');
        return stale.length;
      },

      setPermission: (id, key, v) => set((s) => ({ paired: s.paired.map((p) => (p.id === id ? { ...p, permissions: { ...p.permissions, [key]: v } } : p)) })),

      pairNew: (nearbyId) => {
        const s = get();
        const d = s.nearby.find((x) => x.id === nearbyId);
        if (!d) return false;
        const name = d.name || d.label || 'Νέα συσκευή';
        const now = Date.now();
        if (!s.radioOn) {
          get().toast('Το Bluetooth είναι κλειστό', 'warning');
          return false;
        }
        const sniff = effectiveMode(s.master, s.modules.sniffing, s.location);
        if (s.location === 'public' && (s.settings.pairingOnlyTrusted || sniff !== 'off')) {
          get().addEvent({
            moduleId: 'sniffing', severity: 'medium', action: 'blocked', simulated: true, device: name,
            title: 'Μπλοκαρίστηκε pairing σε δημόσιο χώρο',
            description: `Η σύζευξη με «${name}» μπλοκαρίστηκε επειδή βρίσκεστε σε δημόσιο χώρο, όπου κάποιος μπορεί να υποκλέψει τα κλειδιά ασφαλείας (sniffing).`,
            advice: 'Κάντε τη σύζευξη όταν βρίσκεστε σε έμπιστη τοποθεσία (π.χ. στο σπίτι σας).',
          });
          get().toast('Η σύζευξη μπλοκαρίστηκε: βρίσκεστε σε δημόσιο χώρο', 'warning');
          return false;
        }
        if (s.location === 'public')
          get().addEvent({
            moduleId: 'sniffing', severity: 'medium', action: 'allowed', simulated: true, device: name,
            title: 'Pairing σε δημόσιο χώρο χωρίς προστασία',
            description: `Έγινε σύζευξη με «${name}» σε δημόσιο χώρο. Τα κλειδιά ασφαλείας ανταλλάχθηκαν εκεί που μπορεί να υπάρχει sniffer.`,
            advice: 'Την επόμενη φορά, κάντε pairing στο σπίτι. Ενεργοποιήστε τη ρύθμιση «Pairing μόνο σε έμπιστες τοποθεσίες».',
          });
        const dev: PairedDevice = {
          id: uid(), name, type: d.type, mac: d.mac.startsWith('—') ? randomMac('public') : d.mac, pairedAt: now, lastUsed: now, connected: true,
          secure: 'sc', encrypted: d.encrypted !== false, keyBytes: 16, trusted: true,
          permissions: { contacts: false, messages: false, calls: d.type === 'headphones' || d.type === 'car', files: false },
        };
        set({ paired: [dev, ...s.paired], lastActivity: now });
        get().addEvent({
          moduleId: null, severity: 'info', action: 'info', simulated: true, device: name,
          title: 'Νέα ασφαλής σύζευξη',
          description: `Η συσκευή «${name}» συζεύχθηκε με LE Secure Connections και κλειδί 16 bytes.`,
          advice: 'Ελέγξτε τα δικαιώματά της στην καρτέλα «Συσκευές».',
        });
        get().toast(`Σύζευξη με «${name}» ολοκληρώθηκε`, 'success');
        return true;
      },

      blockDevice: (mac, name) => {
        set((s) => ({ blocked: [{ mac, name, at: Date.now() }, ...s.blocked.filter((b) => b.mac !== mac)], trustedMacs: s.trustedMacs.filter((m) => m !== mac) }));
        get().toast(`Αποκλείστηκε: ${name}`, 'success');
      },
      unblockDevice: (mac) => set((s) => ({ blocked: s.blocked.filter((b) => b.mac !== mac) })),
      trustDevice: (mac) => {
        set((s) => ({ trustedMacs: s.trustedMacs.includes(mac) ? s.trustedMacs.filter((m) => m !== mac) : [...s.trustedMacs, mac], blocked: s.blocked.filter((b) => b.mac !== mac) }));
      },

      addEvent: (e) => {
        const now = Date.now();
        const ev: SecurityEvent = { id: uid(), time: now, simulated: true, ...e };
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
        if (s.settings.vibration && rank >= 3 && e.action !== 'info') vibrate(e.action === 'allowed' ? [200, 80, 200, 80, 200] : [90, 50, 90]);
        if (s.settings.notifications && rank >= 3 && e.action !== 'info') {
          const pre = e.action === 'blocked' ? '🛡️ Αποκλείστηκε: ' : '⚠️ ';
          void showNotification(pre + e.title, e.description.slice(0, 140));
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
          moduleId: r.moduleId, severity: r.severity, title: r.title, device: r.deviceName, advice: r.advice,
          description: r.description + (accept ? ' Ο χρήστης ΑΠΟΔΕΧΤΗΚΕ το αίτημα.' : timedOut ? ' Το αίτημα έληξε χωρίς απάντηση.' : ' Ο χρήστης απέρριψε το αίτημα.'),
          action: accept ? 'user-allowed' : 'user-blocked',
        });
        get().toast(
          accept
            ? 'Αποδεχτήκατε αίτημα από άγνωστη συσκευή! Σε πραγματική επίθεση, θα είχε τώρα πρόσβαση στο κινητό σας.'
            : timedOut
              ? 'Το αίτημα έληξε και απορρίφθηκε αυτόματα.'
              : 'Σωστά! Απορρίψατε ένα ύποπτο αίτημα. 👏',
          accept ? 'danger' : 'success',
        );
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
        get().toast('Καταγράφηκε: ελέγξατε για ενημερώσεις λογισμικού', 'success');
      },
      setQuizBest: (n) => set((s) => ({ quizBest: Math.max(n, s.quizBest ?? 0) })),
      markEventsRead: () => set({ readEventsAt: Date.now() }),
      clearEvents: () => {
        set({ events: [], stats: { blocked: 0, allowed: 0, warned: 0, correct: 0, wrong: 0, since: Date.now() } });
        get().toast('Το αρχείο συμβάντων διαγράφηκε', 'info');
      },
      resetAll: () => {
        const now = Date.now();
        set({ ...persistedDefaults(now), onboarded: true, nearby: [], timeline: [], pendingRequest: null, flood: null, screen: 'home', sheet: null });
        get().toast('Έγινε επαναφορά όλων των ρυθμίσεων', 'info');
      },

      simulateAttack: (id) => {
        const s = get();
        const now = Date.now();
        if (!s.radioOn) {
          get().addEvent({
            moduleId: id, severity: 'info', action: 'info', simulated: true,
            title: `Δοκιμή ${MODULE_MAP[id].attack}: αδύνατη`,
            description: 'Το Bluetooth είναι κλειστό, οπότε καμία επίθεση Bluetooth δεν μπορεί να φτάσει στο κινητό σας. Αυτή είναι η πιο αποτελεσματική προστασία!',
            advice: 'Κρατάτε το Bluetooth κλειστό (ή σε AUTO) όταν δεν το χρειάζεστε.',
          });
          get().toast('Bluetooth κλειστό → η επίθεση είναι αδύνατη 🛡️', 'success');
          return;
        }
        const spec = generateAttack(id, { paired: s.paired, nearby: s.nearby, discoverable: s.discoverable, dosThreshold: s.settings.dosThreshold, location: s.location });
        const out = resolveAttack({ ...s, pendingRequest: null }, spec, now);
        const patch: Partial<State> = {};
        if (out.request) patch.pendingRequest = out.request;
        if (out.flood) patch.flood = out.flood;
        if (out.key) patch.keyHistory = [...s.keyHistory, out.key].slice(-30);
        if (out.spawnTracker && !s.nearby.some((d) => d.follow) && !s.live.scanning) patch.nearby = [...s.nearby, spawnDevice(FOLLOW_TRACKER, now)];
        set(patch);
        if (out.event) {
          get().addEvent({ ...out.event, simulated: true });
          const a = out.event.action;
          get().toast(
            a === 'blocked' ? `🛡️ Η δοκιμαστική επίθεση αποκλείστηκε` : a === 'allowed' ? '⚠️ Η επίθεση ΔΕΝ αποκλείστηκε — η μονάδα είναι OFF' : a === 'warned' ? 'Η επίθεση ανιχνεύθηκε (προειδοποίηση)' : 'Η σύνδεση κρίθηκε αποδεκτή',
            a === 'blocked' ? 'success' : a === 'allowed' ? 'danger' : 'warning',
          );
        }
      },

      setRadarMode: (m) => set({ radarMode: m }),

      startLive: async () => {
        const s = get();
        try {
          if (s.caps.native) await nativeStartScan();
          else if (s.caps.leScan) await webStartScan();
          else throw new Error('Η πραγματική σάρωση υποστηρίζεται στην εφαρμογή APK ή σε Chrome για Android με ενεργή την πειραματική σάρωση BLE.');
          drainLiveBuffer();
          set({ live: { ...get().live, scanning: true, error: null }, nearby: [] });
          get().toast('Πραγματική σάρωση BLE σε εξέλιξη', 'success');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          set({ live: { ...get().live, scanning: false, error: msg } });
          get().toast(msg, 'warning');
        }
      },
      stopLive: async () => {
        const s = get();
        if (s.caps.native) await nativeStopScan();
        else webStopScan();
        set({ live: { ...get().live, scanning: false }, nearby: [] });
      },
      setLive: (p) => set((s) => ({ live: { ...s.live, ...p } })),
      setBatteryLive: (level, charging) =>
        set((s) => ({
          battery: {
            source: 'live',
            level,
            charging,
            history: s.battery.source === 'live' ? [...s.battery.history, { t: Date.now(), level }].slice(-240) : [{ t: Date.now(), level }],
          },
        })),
      setSysInfo: (i) => set({ sysInfo: i }),

      tick: () => {
        const s = get();
        const now = Date.now();
        const tickCount = s.tickCount + 1;
        const events: EventInput[] = [];
        let { radioOn, discoverable, discoverableUntil, paired, nearby, flood, lastActivity, battery, macRotations, keyHistory, autoOffNotified } = s;
        let pendingRequest = s.pendingRequest;
        const sim = s.settings.simulation;
        const nativeBt = s.live.btEnabled;
        const anyConnected = paired.some((p) => p.connected);
        if (anyConnected) lastActivity = now;

        // 1) Bluetooth radio (ON / OFF / AUTO)
        if (nativeBt !== null) {
          radioOn = nativeBt;
          if (s.radioMode === 'auto' && radioOn && !anyConnected && now - lastActivity > s.settings.autoOffMinutes * 60000 && !autoOffNotified) {
            autoOffNotified = true;
            events.push({
              moduleId: null, severity: 'medium', action: 'warned', simulated: false,
              title: 'Προτείνεται κλείσιμο του Bluetooth',
              description: `Το Bluetooth δεν χρησιμοποιείται εδώ και ${s.settings.autoOffMinutes} λεπτά. Το Android δεν επιτρέπει σε εφαρμογές να το κλείνουν αυτόματα.`,
              advice: 'Κλείστε το από τις Γρήγορες ρυθμίσεις ή πατήστε OFF στην Αρχική για να ανοίξουν οι ρυθμίσεις Bluetooth.',
            });
          }
          if (anyConnected) autoOffNotified = false;
        } else if (s.radioMode === 'off') radioOn = false;
        else if (s.radioMode === 'on') radioOn = true;
        else if (radioOn) {
          if (s.settings.nightEnabled && inTimeWindow(s.settings.nightFrom, s.settings.nightTo)) {
            radioOn = false;
            events.push({
              moduleId: null, severity: 'info', action: 'info',
              title: 'Νυχτερινή λειτουργία: Bluetooth OFF',
              description: `Το Bluetooth απενεργοποιήθηκε αυτόματα (${s.settings.nightFrom}–${s.settings.nightTo}).`,
              advice: 'Μπορείτε να αλλάξετε το ωράριο στις Ρυθμίσεις → Αυτοματισμοί.',
            });
          } else if (!anyConnected && now - lastActivity > s.settings.autoOffMinutes * 60000) {
            radioOn = false;
            events.push({
              moduleId: null, severity: 'info', action: 'info',
              title: 'Αυτόματη απενεργοποίηση Bluetooth',
              description: `Καμία συσκευή δεν ήταν συνδεδεμένη για ${s.settings.autoOffMinutes} λεπτά. Η λειτουργία AUTO έκλεισε το Bluetooth.`,
              advice: 'Θα ανοίξει ξανά όταν συνδέσετε μια συσκευή ή πατήσετε «Ενεργοποίηση τώρα».',
            });
          }
        }
        if (!radioOn) {
          if (paired.some((p) => p.connected)) paired = paired.map((p) => (p.connected ? { ...p, connected: false } : p));
          discoverable = false;
          discoverableUntil = null;
          flood = null;
          if (pendingRequest) pendingRequest = null;
        }

        // 2) Ορατότητα
        if (discoverable && discoverableUntil && now > discoverableUntil) {
          discoverable = false;
          discoverableUntil = null;
          events.push({
            moduleId: null, severity: 'info', action: 'info',
            title: 'Η ορατότητα απενεργοποιήθηκε αυτόματα',
            description: 'Το κινητό σας δεν εμφανίζεται πλέον στις αναζητήσεις άλλων συσκευών.',
            advice: 'Ενεργοποιήστε την ξανά μόνο όταν θέλετε να κάνετε pairing.',
          });
        }
        if (radioOn && anyConnected && tickCount % 10 === 0) paired = paired.map((p) => (p.connected ? { ...p, lastUsed: now } : p));

        // 3) Κοντινές συσκευές
        const drained = drainLiveBuffer();
        if (s.live.scanning) nearby = ingestLive(nearby, drained, now);
        else if (!radioOn || !sim) nearby = nearby.length ? [] : nearby;
        else {
          if (nearby.length === 0) nearby = initialNearby(s.location, now);
          const scanActive = s.radarMode === 'on' || (s.radarMode === 'auto' && Math.floor(now / 1000) % 30 < 12);
          if (scanActive) {
            nearby = nearby.map((d) => {
              const target = d.follow ? -55 : d.rssiBase;
              const r = clamp(d.rssi + rand(-2.6, 2.6) + (target - d.rssi) * 0.12, -100, -30);
              return { ...d, rssi: r, rssiHistory: [...d.rssiHistory, Math.round(r)].slice(-40), lastSeen: now };
            });
            if (chance(s.location === 'public' ? 0.06 : 0.012)) {
              const removable = nearby.filter((d) => !d.follow && d.type === 'phone' && !d.name);
              if (removable.length > 2) {
                const rm = removable[randInt(0, removable.length - 1)];
                nearby = nearby.filter((d) => d.id !== rm.id);
              }
              if (nearby.length < (s.location === 'public' ? 18 : 8)) nearby = [...nearby, randomExtra(s.location, now)];
            }
            if (chance(0.015)) {
              const rpas = nearby.filter((d) => d.macType === 'rpa');
              if (rpas.length) {
                const target = rpas[randInt(0, rpas.length - 1)];
                nearby = nearby.map((d) => (d.id === target.id ? { ...d, mac: randomMac('rpa') } : d));
                macRotations += 1;
              }
            }
          }
        }

        // 4) Επιθέσεις (προσομοίωση)
        let blockedPkts = 0;
        let threats = 0;
        if (sim && radioOn && s.onboarded && now - s.lastEventAt > 7000) {
          const ctxF = s.location === 'public' ? 3 : s.location === 'work' ? 1.3 : 0.6;
          const intF = [0, 0.45, 1, 2.2][s.settings.intensity];
          const boost = tickCount < 180 ? 2.5 : 1;
          if (chance(0.016 * ctxF * intF * boost)) {
            const type = weightedPick<ModuleId>({
              sniffing: 1.4, bluejacking: discoverable ? 3 : 0.8, bluesnarfing: 1.6, bluebugging: 0.9, blueborne: 0.7, knob: 1.2,
              bias: paired.length ? 1.1 : 0.3, braktooth: 0.7, tracking: s.location === 'public' ? 2.6 : 0.6, dos: flood ? 0 : 1,
            });
            if (type) {
              const spec = generateAttack(type, { paired, nearby, discoverable, dosThreshold: s.settings.dosThreshold, location: s.location });
              const out = resolveAttack({ ...s, pendingRequest }, spec, now);
              threats = 1;
              blockedPkts += out.blockedPkts;
              if (out.request) pendingRequest = out.request;
              if (out.event) events.push({ ...out.event, simulated: true });
              if (out.flood) flood = out.flood;
              if (out.key) keyHistory = [...keyHistory, out.key].slice(-30);
              if (out.spawnTracker && !nearby.some((d) => d.follow) && !s.live.scanning) nearby = [...nearby, spawnDevice(FOLLOW_TRACKER, now)];
            }
          }
        }
        if (radioOn && anyConnected && chance(0.03)) {
          const strong = paired.filter((p) => p.connected && p.keyBytes >= 16);
          if (strong.length) {
            const p = strong[randInt(0, strong.length - 1)];
            keyHistory = [...keyHistory, { t: now, bytes: p.keyBytes, device: p.name, accepted: true }].slice(-30);
          }
        }

        // 5) Πραγματικοί trackers (live σάρωση)
        if (s.live.scanning) {
          for (const d of nearby) {
            if (d.tags.includes('tracker') && now - d.firstSeen > 10 * 60000 && !alertedTrackers.has(d.id)) {
              alertedTrackers.add(d.id);
              const eff = effectiveMode(s.master, s.modules.tracking, s.location);
              events.push({
                moduleId: 'tracking', severity: 'high', action: eff === 'off' ? 'allowed' : 'warned', simulated: false, device: d.label || d.name || 'Tracker',
                title: 'Tracker κοντά σας για πάνω από 10 λεπτά',
                description: `Η συσκευή «${d.label || d.name}» εμφανίζεται συνεχώς κοντά σας εδώ και ${Math.round((now - d.firstSeen) / 60000)} λεπτά.`,
                advice: 'Χρησιμοποιήστε τον «Εντοπισμό» στο Ραντάρ. Αν δεν είναι δικός σας ή κάποιου που είναι μαζί σας, ελέγξτε τα πράγματά σας.',
              });
            }
          }
        }

        // 6) Κίνηση πακέτων (live γράφημα)
        if (flood && now >= flood.until) flood = null;
        let packets = 0;
        let blocked = blockedPkts;
        if (radioOn) {
          const connected = paired.filter((p) => p.connected);
          const audio = connected.some((p) => p.type === 'headphones' || p.type === 'speaker' || p.type === 'car');
          packets = connected.length * rand(6, 14) + (audio ? rand(28, 42) : 0) + rand(2, 8) + nearby.length * 0.4;
          if (flood) {
            const fp = flood.pps * rand(0.85, 1.1);
            packets += fp;
            if (flood.blocked) blocked += fp * rand(0.93, 0.99);
          }
        }
        let prevTimeline = s.timeline;
        if (prevTimeline.length === 0) {
          const connected = paired.filter((p) => p.connected).length;
          prevTimeline = Array.from({ length: 60 }, (_, i) => ({
            t: now - (60 - i) * 1000,
            packets: radioOn ? Math.round(connected * rand(6, 14) + (connected ? rand(28, 42) : 0) + rand(2, 8)) : 0,
            blocked: 0,
            threats: 0,
          }));
        }
        const timeline = [...prevTimeline, { t: now, packets: Math.round(packets), blocked: Math.round(blocked), threats }].slice(-90);

        // 7) Μπαταρία
        if (battery.source === 'sim') {
          let lvl = battery.level;
          let charging = battery.charging;
          const drain = 0.0025 + (radioOn ? 0.0008 : 0) + (flood ? (flood.blocked ? 0.006 : 0.09) : 0);
          if (charging) {
            lvl += 0.025;
            if (lvl >= 96) charging = false;
          } else {
            lvl -= drain;
            if (lvl <= 15) charging = true;
          }
          let hist = battery.history;
          if (hist.length === 0) hist = Array.from({ length: 20 }, (_, i) => ({ t: now - (20 - i) * 3000, level: Math.round((lvl + (20 - i) * 0.008) * 100) / 100 }));
          battery = { ...battery, level: lvl, charging, history: tickCount % 3 === 0 ? [...hist, { t: now, level: Math.round(lvl * 100) / 100 }].slice(-200) : hist };
        } else if (tickCount % 15 === 0) {
          battery = { ...battery, history: [...battery.history, { t: now, level: battery.level }].slice(-240) };
        }

        set({
          tickCount, radioOn, discoverable, discoverableUntil, paired, nearby, flood, lastActivity, battery, macRotations,
          keyHistory, timeline, pendingRequest, autoOffNotified,
        });
        for (const e of events) get().addEvent({ simulated: nativeBt === null, ...e });
      },
    }),
    {
      name: 'blueshield-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        master: s.master,
        radioMode: s.radioMode,
        radioOn: s.radioOn,
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
        keyHistory: s.keyHistory,
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
