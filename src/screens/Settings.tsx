import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  GraduationCap, Timer, Moon, MapPin, Eye, Link2, Ban, Gauge, Bell, Vibrate, FlaskConical, Download, RotateCcw, Info, CircleCheck,
  CircleX, Smartphone, House, Building, Coffee, LocateFixed, Sparkles, Bluetooth, BatteryMedium, Radar, MonitorDown, Package,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { MODULES } from '../data/modules';
import { downloadFile } from '../lib/utils';
import { LOCATION_LABEL } from '../lib/mode';
import { getPosition, requestNotificationPermission, showNotification, vibrate } from '../platform/system';
import { canInstall, onInstallAvailability, promptInstall } from '../platform/pwa';
import type { HelpContent, LocationCtx } from '../types';
import { Button, Card, Hint, IconBox, InfoButton, LiveBadge, Segmented, Slider, Toggle } from '../components/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">{title}</h2>
      <Card className="divide-y divide-white/[0.06] py-1">{children}</Card>
    </section>
  );
}

function Row({ icon, title, desc, help, right, children }: { icon: LucideIcon; title: string; desc?: string; help?: HelpContent; right?: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <IconBox icon={icon} size="sm" tone="slate" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14px] font-medium text-slate-100">
            {title}
            {help && <InfoButton help={help} />}
          </div>
          {desc && <div className="mt-0.5 text-[12px] leading-snug text-slate-400">{desc}</div>}
        </div>
        {right}
      </div>
      {children && <div className="mt-3 pl-11">{children}</div>}
    </div>
  );
}

export function SettingsScreen() {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const location = useStore((st) => st.location);
  const setLocation = useStore((st) => st.setLocation);
  const places = useStore((st) => st.trustedPlaces);
  const addPlace = useStore((st) => st.addTrustedPlace);
  const simulateAttack = useStore((st) => st.simulateAttack);
  const toast = useStore((st) => st.toast);
  const resetAll = useStore((st) => st.resetAll);
  const caps = useStore((st) => st.caps);
  const sys = useStore((st) => st.sysInfo);
  const battery = useStore((st) => st.battery);
  const live = useStore((st) => st.live);
  const radioOn = useStore((st) => st.radioOn);
  const [confirmReset, setConfirmReset] = useState(false);
  const [installable, setInstallable] = useState(canInstall());
  useEffect(() => onInstallAvailability(setInstallable), []);

  const setPlaceHere = async (id: string) => {
    try {
      const p = await getPosition();
      const pl = places.find((x) => x.id === id);
      if (pl) addPlace({ ...pl, lat: p.lat, lon: p.lon });
      toast(`Saved current coordinates as “${pl?.name}” (±${Math.round(p.accuracy)} m)`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Location error', 'warning');
    }
  };

  const exportAll = () => {
    const st = useStore.getState();
    const data = { app: 'BlueShield', exportedAt: new Date().toISOString(), settings: st.settings, modules: st.modules, master: st.master, radioMode: st.radioMode, paired: st.paired, events: st.events };
    downloadFile(`blueshield-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
    toast('JSON backup exported', 'success');
  };

  const capsList: { label: string; ok: boolean; note: string }[] = [
    { label: 'Android Native App (APK)', ok: caps.native, note: caps.native ? 'Running natively via Capacitor' : 'Running in web browser' },
    { label: 'System Bluetooth state', ok: live.btEnabled !== null, note: live.btEnabled !== null ? (live.btEnabled ? 'Enabled' : 'Disabled') : 'APK only' },
    { label: 'Live BLE device & tracker scan', ok: caps.native || caps.leScan, note: caps.native ? 'Native scanner' : caps.leScan ? 'Web Bluetooth Scanning' : 'APK only' },
    { label: 'BLE GATT privacy inspector', ok: caps.webBluetooth, note: caps.webBluetooth ? 'Web Bluetooth' : 'Chrome/Edge on Android or desktop' },
    { label: 'Battery telemetry', ok: battery.source === 'live', note: battery.source === 'live' ? `${Math.round(battery.level)}%` : 'Unsupported — simulated' },
    { label: 'OS version detection', ok: !!sys?.live, note: sys ? `${sys.osName} ${sys.version ?? ''}` : '—' },
    { label: 'GPS (trusted geofences)', ok: caps.geolocation, note: caps.geolocation ? 'Available' : 'Unavailable' },
    { label: 'System notifications', ok: caps.notifications, note: caps.notifications ? 'Available' : 'Unavailable here' },
    { label: 'Haptic vibration', ok: caps.vibrate, note: caps.vibrate ? 'Available' : 'Unavailable' },
  ];

  const LOC_ICONS: Record<LocationCtx, LucideIcon> = { home: House, work: Building, public: Coffee };

  return (
    <div className="space-y-5 px-4 pb-8 pt-4">
      <Section title="Guidance & Display">
        <Row
          icon={GraduationCap}
          title="Beginner Mode"
          desc="Plain-English tips and analogies across every screen"
          help={{ title: 'Beginner Mode', body: 'When enabled, amber tip callouts and plain-language guidance appear throughout the app. When disabled, technical CVE and protocol notes expand automatically for power users.' }}
          right={<Toggle checked={s.beginnerMode} onChange={(v) => update({ beginnerMode: v })} label="Beginner Mode" />}
        />
      </Section>

      <Section title="Bluetooth Automations (AUTO mode)">
        <Row
          icon={Timer}
          title="Idle auto-shutoff timer"
          desc="When no paired device is connected"
          help={{ title: 'Idle Auto-Shutoff', body: 'In AUTO mode, if zero devices (earbuds, watch, car) remain connected for this many minutes, Bluetooth turns off automatically. Shorter timeout = tighter security.', more: 'On Android 13+, apps cannot silently disable Bluetooth. In the APK, BlueShield alerts you as soon as the timer expires and offers a shortcut to Bluetooth Settings.' }}
        >
          <Slider value={s.autoOffMinutes} min={1} max={60} onChange={(v) => update({ autoOffMinutes: v })} format={(v) => `${v} min`} />
        </Row>
        <Row
          icon={Moon}
          title="Night shutoff schedule"
          desc="Turn Bluetooth off during sleeping hours"
          right={<Toggle checked={s.nightEnabled} onChange={(v) => update({ nightEnabled: v })} label="Night schedule" />}
        >
          {s.nightEnabled && (
            <div className="flex items-center gap-2 text-[13px] text-slate-300">
              From
              <input type="time" value={s.nightFrom} onChange={(e) => update({ nightFrom: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-white [color-scheme:dark]" />
              to
              <input type="time" value={s.nightTo} onChange={(e) => update({ nightTo: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-white [color-scheme:dark]" />
            </div>
          )}
        </Row>
        <Row
          icon={MapPin}
          title="Turn off when leaving a trusted place"
          desc="e.g. when stepping out of Home into public"
          right={<Toggle checked={s.offWhenLeaving} onChange={(v) => update({ offWhenLeaving: v })} label="Turn off when leaving" />}
        />
        <Row icon={Eye} title="Discoverable auto-hide timer" desc="How long your phone stays visible when you turn discoverable on">
          <Segmented<number>
            size="sm"
            value={s.discoverableTimeout}
            onChange={(v) => update({ discoverableTimeout: v })}
            options={[
              { value: 30, label: '30s' },
              { value: 60, label: '1m' },
              { value: 120, label: '2m' },
              { value: 300, label: '5m' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Locations">
        <Row icon={MapPin} title="Current location context" desc="Drives smart AUTO mode decisions">
          <Segmented<LocationCtx>
            size="sm"
            value={location}
            onChange={(v) => setLocation(v)}
            options={(['home', 'work', 'public'] as LocationCtx[]).map((l) => ({ value: l, label: LOCATION_LABEL[l], icon: LOC_ICONS[l] }))}
          />
        </Row>
        <Row
          icon={LocateFixed}
          title="Automatic GPS geofencing"
          desc={caps.geolocation ? 'Switches location automatically when entering/leaving trusted zones' : 'GPS is unavailable'}
          help={{ title: 'Automatic GPS Geofencing', body: 'Pin your Home and Work once by tapping "Set here" while standing there. BlueShield then detects automatically whether you are inside a trusted zone or out in public. Your coordinates stay strictly on your device.' }}
          right={
            <Toggle
              checked={s.useGps}
              disabled={!caps.geolocation}
              onChange={async (v) => {
                if (v) {
                  try {
                    await getPosition();
                    update({ useGps: true });
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'GPS error', 'warning');
                  }
                } else update({ useGps: false });
              }}
              label="GPS"
            />
          }
        >
          <div className="space-y-2">
            {places.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                {p.kind === 'home' ? <House size={15} className="text-sky-300" /> : <Building size={15} className="text-sky-300" />}
                <div className="flex-1 text-[12.5px]">
                  <div className="text-slate-200">{p.name}</div>
                  <div className="text-[11px] text-slate-500">{p.lat != null ? `Pinned · ${p.radius} m radius` : 'Not pinned yet'}</div>
                </div>
                <Button size="sm" variant="secondary" disabled={!caps.geolocation} onClick={() => void setPlaceHere(p.id)}>
                  Set here
                </Button>
              </div>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Security Policies">
        <Row
          icon={Link2}
          title="Pair only in trusted places"
          desc="Blocks new pairing attempts in public venues"
          help={{ title: 'Pair Only in Trusted Places', body: 'Encryption keys are exchanged during first-time pairing. In public spaces a nearby sniffer can capture them. Enabling this restricts new pairing strictly to Home or Work.' }}
          right={<Toggle checked={s.pairingOnlyTrusted} onChange={(v) => update({ pairingOnlyTrusted: v })} label="Pair only in trusted places" />}
        />
        <Row
          icon={Ban}
          title="Auto-reject unknown requests"
          desc="Silently rejects connection/file prompts from unknown devices"
          help={{ title: 'Auto-Reject Unknown Requests', body: 'When off, BlueShield shows interactive practice prompts for unblocked incoming requests. When on, every unsolicited prompt from an unknown device is rejected automatically.' }}
          right={<Toggle checked={s.autoRejectUnknown} onChange={(v) => update({ autoRejectUnknown: v })} label="Auto-reject unknown requests" />}
        />
        <Row
          icon={Gauge}
          title="AUTO mode sensitivity"
          desc={s.sensitivity === 3 ? 'High: auto-blocks even low-severity anomalies' : s.sensitivity === 2 ? 'Medium: auto-blocks medium and higher threats' : 'Low: auto-blocks only high/critical threats — fewer interruptions'}
          help={{ title: 'Sensitivity', body: 'Controls the severity threshold at which AUTO modules automatically block vs. warn. Modules set to ON always block regardless of sensitivity.' }}
        >
          <Segmented<1 | 2 | 3>
            size="sm"
            value={s.sensitivity}
            onChange={(v) => update({ sensitivity: v })}
            options={[
              { value: 1, label: 'Low' },
              { value: 2, label: 'Medium' },
              { value: 3, label: 'High' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Notifications & Haptics">
        <Row
          icon={Bell}
          title="System notifications"
          desc={caps.notifications ? 'Alerts for high-severity threats even in the background' : 'Not supported in this environment'}
          right={
            <Toggle
              checked={s.notifications}
              disabled={!caps.notifications}
              onChange={async (v) => {
                if (v) {
                  const ok = await requestNotificationPermission();
                  if (ok) update({ notifications: true });
                  else toast('Notification permission was not granted.', 'warning');
                } else update({ notifications: false });
              }}
              label="Notifications"
            />
          }
        >
          {s.notifications && (
            <Button size="sm" variant="secondary" onClick={() => void showNotification('🛡️ BlueShield', 'Test alert: system notifications are working!', true)}>
              Send test notification
            </Button>
          )}
        </Row>
        <Row
          icon={Vibrate}
          title="Haptic vibration"
          desc="Used for high-risk alerts, incoming prompts, and the Tracker Locator"
          right={
            <Toggle
              checked={s.vibration}
              onChange={(v) => {
                update({ vibration: v });
                if (v) vibrate([60, 40, 60]);
              }}
              label="Vibration"
            />
          }
        />
      </Section>

      <Section title="Simulation & Attack Lab">
        <Row
          icon={Sparkles}
          title="Educational simulation"
          desc="Realistic attack scenarios so you can see your shields in action"
          help={{ title: 'Educational Simulation', body: 'Because real Bluetooth attacks do not happen every minute, BlueShield generates safe, realistic scenarios (badged SIMULATION) so you can watch how each shield responds and practice rejecting malicious prompts. Toggle it off to see only real hardware data.' }}
          right={<Toggle checked={s.simulation} onChange={(v) => update({ simulation: v })} label="Simulation" />}
        >
          {s.simulation && (
            <Segmented<1 | 2 | 3>
              size="sm"
              value={s.intensity}
              onChange={(v) => update({ intensity: v })}
              options={[
                { value: 1, label: 'Calm' },
                { value: 2, label: 'Normal' },
                { value: 3, label: 'Hostile' },
              ]}
            />
          )}
        </Row>
        <div className="py-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-slate-200">
            <FlaskConical size={16} className="text-violet-300" /> Trigger a test attack
          </div>
          <p className="mb-3 text-[12px] leading-snug text-slate-400">
            Tap any attack below to test whether your current shield settings block it. {radioOn ? '' : 'Bluetooth is currently OFF — every attack is impossible!'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map((m) => (
              <button key={m.id} type="button" onClick={() => simulateAttack(m.id)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left text-[12px] text-slate-200 transition hover:bg-white/[0.08] active:scale-[0.98]">
                <m.icon size={15} className="shrink-0 text-violet-300" />
                <span className="truncate">{m.attack}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Data & Backup">
        <Row icon={Download} title="Export backup (JSON)" desc="Settings, saved devices, and full event log" right={<Button size="sm" variant="secondary" onClick={exportAll}>Export</Button>} />
        <Row
          icon={RotateCcw}
          title="Reset application"
          desc="Restore all settings and sample data to factory defaults"
          right={
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (confirmReset) {
                  resetAll();
                  setConfirmReset(false);
                } else {
                  setConfirmReset(true);
                  setTimeout(() => setConfirmReset(false), 3000);
                }
              }}
            >
              {confirmReset ? 'Confirm?' : 'Reset'}
            </Button>
          }
        />
      </Section>

      <Section title="Device Capabilities">
        {capsList.map((c) => (
          <div key={c.label} className="flex items-center gap-3 py-2.5">
            {c.ok ? <CircleCheck size={18} className="shrink-0 text-emerald-400" /> : <CircleX size={18} className="shrink-0 text-slate-500" />}
            <span className="flex-1 text-[13px] text-slate-200">{c.label}</span>
            <span className={cn('text-right text-[11.5px]', c.ok ? 'text-emerald-300' : 'text-slate-500')}>{c.note}</span>
          </div>
        ))}
      </Section>

      <Section title="Install & About">
        {!caps.native && (
          <Row icon={MonitorDown} title="Install on Home Screen" desc={installable ? 'Works like a native app, including offline' : 'Chrome: menu ⋮ → “Install app” / “Add to Home screen”'} right={installable ? <Button size="sm" onClick={() => void promptInstall()}>Install</Button> : undefined} />
        )}
        <Row icon={Package} title="Android APK Build" desc="Includes a ready-to-build Capacitor 8 project with native Bluetooth LE. Step-by-step guide in ANDROID_APK.md." right={caps.native ? <LiveBadge label="APK" /> : undefined} />
        <div className="py-3">
          <div className="flex items-start gap-3">
            <IconBox icon={Info} size="sm" tone="violet" />
            <p className="flex-1 text-[12.5px] leading-relaxed text-slate-400">
              <b className="text-slate-200">BlueShield 1.0</b> — Honest note: no non-root Android app can filter raw HCI packets inside the OS Bluetooth stack or silently turn Bluetooth off on Android 13+. BlueShield monitors everything the OS exposes (live BLE scanning, tracker detection, radio state, battery drain), guides you to the right settings, and trains you with realistic interactive simulations.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 py-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><Bluetooth size={12} /> Web Bluetooth / Capacitor BLE</span>
          <span className="flex items-center gap-1"><BatteryMedium size={12} /> Battery API</span>
          <span className="flex items-center gap-1"><Radar size={12} /> Tracker detection</span>
          <span className="flex items-center gap-1"><Smartphone size={12} /> PWA</span>
        </div>
      </Section>
      <Hint>All data (settings, event history, trusted coordinates) stays strictly on your device. BlueShield sends nothing over the internet.</Hint>
    </div>
  );
}
