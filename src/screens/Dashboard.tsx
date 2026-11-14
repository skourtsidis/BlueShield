import { useMemo, useState } from 'react';
import {
  ShieldCheck, ScanSearch, ChartBar, MapPin, ChevronRight, Bluetooth, BluetoothOff, Timer, Eye, EyeOff, Activity, Siren, Radar, Link2,
  Layers, PieChart as PieIcon, BatteryCharging, BatteryMedium, ListChecks, Lightbulb, RefreshCw, Moon, FlaskConical,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { useScore } from '../lib/score';
import { effectiveMode, LOCATION_LABEL } from '../lib/mode';
import { fmtCountdown, fmtClock, pick } from '../lib/utils';
import { MODULES, MODULE_COLOR, MODULE_MAP } from '../data/modules';
import { TIPS } from '../data/content';
import { useNow } from '../hooks/useNow';
import type { ModuleId } from '../types';
import { Button, Card, Hint, InfoButton, LiveBadge, ModeSwitch, SectionTitle, SimBadge, StatTile, Toggle } from '../components/ui';
import { MiniArea, ScoreGauge, ThreatDonut, TrafficChart } from '../components/charts';
import { EventDetailSheet, EventRow } from './Events';

function ScoreHero() {
  const score = useScore();
  const openSheet = useStore((s) => s.openSheet);
  const msg =
    score.total >= 85
      ? 'Your phone is strongly protected against Bluetooth threats. Keep it up!'
      : score.total >= 70
        ? 'Solid protection — just a couple more steps for full hardening.'
        : score.total >= 50
          ? 'Security gaps detected. Tap "Security Audit" to fix them in one tap.'
          : 'Your phone is exposed! Run a Security Audit right away.';
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-sky-500/[0.16] via-surface/80 to-indigo-500/[0.10] p-5">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Security Score</span>
          <InfoButton
            help={{
              title: 'Security Score',
              body: 'A single 0–100 score showing at a glance how safe your phone is against Bluetooth security risks.\n\nIt combines: active protection modules (50 pts), Bluetooth hygiene — whether Bluetooth stays always on, discoverability, device name privacy, and stale paired devices (30 pts) — plus your security best practices (20 pts). Unblocked attacks deduct points.',
              tips: ['85+ is excellent.', 'Tap "Breakdown" to see where points are lost.', '"Security Audit" fixes most issues in a single tap.'],
            }}
          />
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${score.color}22`, color: score.color }}>
          {score.level}
        </span>
      </div>
      <div className="relative mt-1 flex flex-col items-center">
        <ScoreGauge value={score.total} color={score.color} />
        <p className="-mt-4 max-w-[280px] text-center text-[13px] leading-snug text-slate-300">{msg}</p>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <Button icon={ScanSearch} onClick={() => openSheet('audit')}>
          Security Audit
        </Button>
        <Button variant="secondary" icon={ChartBar} onClick={() => openSheet('score')}>
          Breakdown
        </Button>
      </div>
    </Card>
  );
}

function MasterCard() {
  const master = useStore((s) => s.master);
  const setMaster = useStore((s) => s.setMaster);
  const location = useStore((s) => s.location);
  const openSheet = useStore((s) => s.openSheet);
  const desc = {
    on: 'All protection modules operate according to their individual settings.',
    auto:
      location === 'public'
        ? 'You are in a public place: every protection module has automatically escalated to ON.'
        : `You are in a trusted place (${LOCATION_LABEL[location]}): modules run normally, and will automatically escalate to ON whenever you enter a public place.`,
    off: 'WARNING: All protection modules are disabled. Your phone is unshielded against attacks.',
  }[master];
  return (
    <Card>
      <SectionTitle
        icon={ShieldCheck}
        title="Master Protection"
        subtitle="Global switch controlling all security shields"
        help={{
          title: 'Master Protection',
          body: 'Acts as the master switch for all 10 Bluetooth security shields.\n\n• ON: every module runs as configured on the "Shields" tab.\n• AUTO: smart context mode — at Home/Work modules run normally, while in public places (café, subway, airport) ALL modules automatically escalate to ON.\n• OFF: disables all shields. Not recommended.',
          tips: ['AUTO is the recommended setting for beginners.', 'Set your current location accurately so AUTO can adapt.'],
        }}
      />
      <ModeSwitch value={master} onChange={setMaster} size="lg" />
      <p className={cn('mt-3 text-[13px] leading-relaxed', master === 'off' ? 'font-medium text-rose-300' : 'text-slate-300')}>{desc}</p>
      <button type="button" onClick={() => openSheet('location')} className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-left text-[13px] text-slate-200 transition hover:bg-white/[0.07]">
        <MapPin size={16} className="text-sky-300" />
        Location: <b>{LOCATION_LABEL[location]}</b>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', location === 'public' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300')}>
          {location === 'public' ? 'Untrusted' : 'Trusted'}
        </span>
        <ChevronRight size={16} className="ml-auto text-slate-500" />
      </button>
    </Card>
  );
}

function BluetoothCard() {
  const now = useNow(1000);
  const radioMode = useStore((s) => s.radioMode);
  const radioOn = useStore((s) => s.radioOn);
  const setRadioMode = useStore((s) => s.setRadioMode);
  const wakeRadio = useStore((s) => s.wakeRadio);
  const discoverable = useStore((s) => s.discoverable);
  const discoverableUntil = useStore((s) => s.discoverableUntil);
  const setDiscoverable = useStore((s) => s.setDiscoverable);
  const settings = useStore((s) => s.settings);
  const paired = useStore((s) => s.paired);
  const lastActivity = useStore((s) => s.lastActivity);
  const native = useStore((s) => s.live.btEnabled !== null);
  const connected = paired.filter((p) => p.connected);
  const autoOffIn = settings.autoOffMinutes * 60000 - (now - lastActivity);
  return (
    <Card className={cn('relative overflow-hidden', radioOn && 'bg-gradient-to-br from-sky-500/[0.12] to-surface/80')}>
      <div className="flex items-start gap-4">
        <div className="relative">
          {radioOn && <span className="pulse-ring absolute inset-0 rounded-2xl border-2 border-sky-400/50" />}
          <span className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all', radioOn ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/40' : 'bg-white/10 text-slate-400')}>
            {radioOn ? <Bluetooth size={28} /> : <BluetoothOff size={28} />}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-white">Bluetooth Radio</h3>
            {native ? <LiveBadge /> : <SimBadge />}
            <InfoButton
              help={{
                title: 'Bluetooth Radio (ON / OFF / AUTO)',
                body: 'Controls your phone’s Bluetooth radio.\n\n• ON: Bluetooth stays permanently on.\n• OFF: stays completely off — the simplest, 100% effective defense, since no Bluetooth attack can reach a powered-off radio.\n• AUTO: turns on when you need it and shuts off automatically after idle minutes with no connected devices, overnight, and when leaving a trusted place.',
                more: 'Starting in Android 13 (API 33), third-party apps are no longer allowed to disable Bluetooth silently (BluetoothAdapter.disable() was deprecated). In the Android APK, BlueShield reads real radio state, requests enabling via the official system dialog, and alerts you + opens Bluetooth Settings whenever shutoff is needed.',
                tips: ['iPhone note: turn Bluetooth off inside Settings — Control Center only disconnects accessories.', 'AUTO gives the best balance between convenience and safety.'],
              }}
            />
          </div>
          <div className={cn('text-xl font-bold', radioOn ? 'text-sky-300' : 'text-slate-400')}>{radioOn ? 'Active' : 'Off'}</div>
          <div className="text-xs text-slate-400">
            {radioOn ? `${connected.length} connected device${connected.length === 1 ? '' : 's'}` : 'No Bluetooth attack is possible 🛡️'}
          </div>
        </div>
      </div>
      <ModeSwitch className="mt-4" value={radioMode} onChange={setRadioMode} palette="radio" size="lg" />
      <div className="mt-3 space-y-2 rounded-2xl bg-black/20 p-3 text-[12.5px] leading-relaxed text-slate-300">
        {radioMode === 'auto' && radioOn && connected.length === 0 && (
          <div className="flex items-center gap-2">
            <Timer size={15} className="shrink-0 text-violet-300" />
            <span>
              Auto-shutoff in <b className="tabular-nums text-white">{fmtCountdown(autoOffIn)}</b> — no connected devices.
            </span>
          </div>
        )}
        {radioMode === 'auto' && radioOn && connected.length > 0 && (
          <div className="flex items-start gap-2">
            <Timer size={15} className="mt-0.5 shrink-0 text-violet-300" />
            <span>
              Staying on while connected to <b className="text-white">{connected.map((c) => c.name).join(', ')}</b>. Will turn off {settings.autoOffMinutes}m after disconnect.
            </span>
          </div>
        )}
        {radioMode === 'auto' && !radioOn && (
          <div className="flex items-center justify-between gap-2">
            <span>Automatically turned off to keep you safe.</span>
            <Button size="sm" onClick={wakeRadio}>
              Enable now
            </Button>
          </div>
        )}
        {radioMode === 'on' && <div>Permanently on. Switching to AUTO is recommended so Bluetooth turns off when idle.</div>}
        {radioMode === 'off' && <div>Permanently off — the safest state possible.</div>}
        {settings.nightEnabled && radioMode === 'auto' && (
          <div className="flex items-center gap-2 text-slate-400">
            <Moon size={14} /> Night shutoff {settings.nightFrom}–{settings.nightTo}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] p-3">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', discoverable ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-slate-400')}>
          {discoverable ? <Eye size={18} /> : <EyeOff size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
            Discoverable to nearby devices
            <InfoButton
              help={{
                title: 'Discoverable Visibility',
                body: 'When enabled, your phone appears in the "Available devices" scan list of everyone nearby — including attackers. Attacks like classic Bluejacking rely on discoverability.\n\nYou only need it for a few seconds when pairing a brand-new accessory. BlueShield automatically turns it back off after a short timer.',
                tips: ['Keep discoverable mode off.', 'You can change the auto-hide timer in Settings.'],
              }}
            />
          </div>
          <div className="text-xs text-slate-400">
            {discoverable && discoverableUntil ? `Auto-hides in ${fmtCountdown(discoverableUntil - now)}` : 'Hidden from strangers — recommended'}
          </div>
        </div>
        <Toggle checked={discoverable} onChange={setDiscoverable} label="Discoverable" />
      </div>
      <Hint className="mt-3">“OFF” is the safest choice: with Bluetooth powered down, zero Bluetooth attacks can reach you. “AUTO” turns it off automatically whenever idle.</Hint>
    </Card>
  );
}

function TrafficCard() {
  const timeline = useStore((s) => s.timeline);
  const flood = useStore((s) => s.flood);
  const threshold = useStore((s) => s.settings.dosThreshold);
  const native = useStore((s) => s.caps.native);
  const last = timeline[timeline.length - 1];
  const peak = timeline.reduce((m, t) => Math.max(m, t.packets), 0);
  const blocked = timeline.reduce((a, t) => a + t.blocked, 0);
  return (
    <Card>
      <SectionTitle
        icon={Activity}
        title="Live Bluetooth Traffic"
        subtitle="Packets per second — last 90 seconds"
        action={native ? undefined : <SimBadge />}
        help={{
          title: 'Live Bluetooth Traffic Chart',
          body: 'Displays, second by second, how many Bluetooth data packets arrive at your phone (blue) and how many suspicious packets were blocked (green).\n\nThe dashed red line marks your Anti-DoS rate limit: a sudden spike past that line indicates a packet-flood attack (such as Bluesmack).\n\nTouch or drag across the chart to inspect exact values.',
          more: 'Typical traffic depends on connected peripherals: wireless audio (A2DP) ~30–45 pkt/s, fitness bands only a few pkt/s. Non-root Android apps cannot read raw HCI packets directly (only Developer Options HCI snoop log captures them), so packet rates here are modeled interactively.',
        }}
      />
      {flood && (
        <div className={cn('mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs', flood.blocked ? 'bg-emerald-500/15 text-emerald-200' : 'animate-pulse bg-rose-500/20 text-rose-100')}>
          <Siren size={15} /> Packet flood from “{flood.source}” — {flood.blocked ? 'being blocked ✓' : 'NOT blocked!'}
        </div>
      )}
      <TrafficChart data={timeline} threshold={threshold} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { l: 'Now', v: last?.packets ?? 0, c: 'text-sky-300' },
          { l: 'Peak', v: peak, c: 'text-white' },
          { l: 'Blocked', v: blocked, c: 'text-emerald-300' },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl bg-white/[0.04] py-2">
            <div className={cn('text-lg font-bold tabular-nums', x.c)}>{x.v.toLocaleString('en-US')}</div>
            <div className="text-[10.5px] text-slate-400">{x.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Incoming</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Blocked</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-rose-400" />DoS limit: {threshold}/s</span>
      </div>
      {threshold > Math.max(80, peak * 1.25) && (
        <p className="mt-1.5 text-[11px] text-slate-500">Traffic is well below your DoS threshold ✓ — the red limit line appears automatically if packet rates climb near it.</p>
      )}
    </Card>
  );
}

function QuickStats() {
  const go = useStore((s) => s.go);
  const nearby = useStore((s) => s.nearby);
  const paired = useStore((s) => s.paired);
  const events = useStore((s) => s.events);
  const master = useStore((s) => s.master);
  const modules = useStore((s) => s.modules);
  const location = useStore((s) => s.location);
  const today = new Date().toDateString();
  const blockedToday = events.filter((e) => (e.action === 'blocked' || e.action === 'user-blocked') && new Date(e.time).toDateString() === today).length;
  const suspicious = nearby.filter((d) => d.risk === 'high' || d.risk === 'medium').length;
  const active = MODULES.filter((m) => effectiveMode(master, modules[m.id], location) !== 'off').length;
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile icon={Radar} label="Nearby devices" value={nearby.length} sub={suspicious ? `${suspicious} suspicious` : 'none suspicious'} tone={suspicious ? 'amber' : 'sky'} onClick={() => go('radar')} />
      <StatTile icon={ShieldCheck} label="Threats blocked today" value={blockedToday} tone="emerald" onClick={() => go('events')} />
      <StatTile icon={Link2} label="Connected devices" value={paired.filter((p) => p.connected).length} sub={`of ${paired.length} saved`} tone="violet" onClick={() => go('devices')} />
      <StatTile icon={Layers} label="Active shields" value={`${active}/${MODULES.length}`} sub={active < MODULES.length ? 'tap to configure' : 'full coverage'} tone={active < MODULES.length ? 'rose' : 'emerald'} onClick={() => go('protection')} />
    </div>
  );
}

function ThreatsCard() {
  const events = useStore((s) => s.events);
  const go = useStore((s) => s.go);
  const simulateAttack = useStore((s) => s.simulateAttack);
  const [sel, setSel] = useState<string | null>(null);
  const data = useMemo(() => {
    const counts = new Map<ModuleId, number>();
    events.forEach((e) => {
      if (e.moduleId && e.severity !== 'info') counts.set(e.moduleId, (counts.get(e.moduleId) || 0) + 1);
    });
    return MODULES.map((m) => ({ id: m.id, name: m.attack, value: counts.get(m.id) || 0, color: MODULE_COLOR[m.id] })).sort((a, b) => b.value - a.value);
  }, [events]);
  const total = data.reduce((a, d) => a + d.value, 0);
  const selMod = sel ? MODULE_MAP[sel as ModuleId] : null;
  return (
    <Card>
      <SectionTitle
        icon={PieIcon}
        title="Threats by Category"
        subtitle="Breakdown of all recorded security events"
        help={{ title: 'Threats by Category', body: 'Shows which Bluetooth attack types have appeared most often. Tap any slice or category row to read what it means and jump to its shield settings.' }}
      />
      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <ThreatDonut data={data} height={140} />
          <p className="text-[13px] text-slate-400">No threats logged yet. Want to see how your shields respond?</p>
          <Button size="sm" variant="secondary" icon={FlaskConical} onClick={() => simulateAttack(pick(MODULES).id)}>
            Simulate an attack
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[150px_1fr] items-center gap-3">
          <ThreatDonut data={data} height={150} selected={sel} onSelect={setSel} />
          <ul className="space-y-1">
            {data
              .filter((d) => d.value > 0)
              .slice(0, 6)
              .map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => setSel(sel === d.id ? null : d.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] transition', sel === d.id ? 'bg-white/10' : 'hover:bg-white/5')}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 truncate text-slate-300">{d.name}</span>
                    <b className="tabular-nums text-white">{d.value}</b>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      {selMod && (
        <div className="anim-fade mt-3 rounded-2xl bg-white/[0.04] p-3">
          <div className="text-sm font-semibold text-white">{selMod.attack}</div>
          <p className="mt-1 text-[12.5px] leading-snug text-slate-400">{selMod.short}</p>
          <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => go('protection')}>
            Configure shield <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </Card>
  );
}

function BatteryCard() {
  const battery = useStore((s) => s.battery);
  const flood = useStore((s) => s.flood);
  const hist = battery.history;
  const span = hist.length > 1 ? (hist[hist.length - 1].t - hist[0].t) / 3600000 : 0;
  const rate = span > 0.03 ? (hist[0].level - hist[hist.length - 1].level) / span : null;
  const status = battery.charging
    ? { t: 'Charging', c: 'text-emerald-300' }
    : rate === null
      ? { t: 'Collecting samples…', c: 'text-slate-400' }
      : rate > 25
        ? { t: 'Abnormally fast battery drain!', c: 'text-rose-300' }
        : rate > 12
          ? { t: 'Elevated power draw', c: 'text-amber-300' }
          : { t: 'Normal discharge rate', c: 'text-emerald-300' };
  return (
    <Card>
      <SectionTitle
        icon={battery.charging ? BatteryCharging : BatteryMedium}
        title="Battery & Drain Monitor"
        subtitle="Spots battery-draining Bluetooth DoS floods"
        action={battery.source === 'live' ? <LiveBadge /> : <SimBadge />}
        help={{
          title: 'Battery Drain Monitoring',
          body: 'Denial-of-Service attacks such as Bluesmack flood your Bluetooth chip with oversized packets and rapidly drain your battery. BlueShield tracks your discharge slope (% per hour) and alerts you if drain spikes abnormally.',
          more: 'Uses the Web/WebView Battery Status API (navigator.getBattery) where available. Because OS battery levels update in 1% steps, slope accuracy improves after several minutes.',
        }}
      />
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-extrabold tabular-nums text-white">
            {Math.round(battery.level)}
            <span className="text-lg text-slate-400">%</span>
          </div>
          <div className={cn('text-[12.5px] font-medium', status.c)}>{status.t}</div>
        </div>
        <div className="text-right text-[12px] text-slate-400">
          {rate !== null && !battery.charging && (
            <>
              <div className="text-base font-bold tabular-nums text-slate-200">{rate.toFixed(1)}%/hr</div>
              discharge rate
            </>
          )}
          {flood && !flood.blocked && <div className="mt-1 font-semibold text-rose-300">⚠ Unblocked DoS flood active</div>}
        </div>
      </div>
      <div className="mt-2">
        <MiniArea data={hist.map((h) => ({ x: h.t, v: h.level }))} color={rate && rate > 25 ? '#fb7185' : '#34d399'} unit="%" name="Battery" height={70} xFormat={(x) => fmtClock(x)} />
      </div>
    </Card>
  );
}

function RecentEvents() {
  const events = useStore((s) => s.events);
  const go = useStore((s) => s.go);
  const [open, setOpen] = useState<string | null>(null);
  const list = events.slice(0, 5);
  return (
    <Card>
      <SectionTitle
        icon={ListChecks}
        title="Recent Events"
        action={
          <Button size="sm" variant="ghost" onClick={() => go('events')}>
            View all <ChevronRight size={14} />
          </Button>
        }
      />
      {list.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-slate-400">All quiet — no events recorded yet. 🛡️</p>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {list.map((e) => (
            <EventRow key={e.id} e={e} onClick={() => setOpen(e.id)} />
          ))}
        </div>
      )}
      <EventDetailSheet id={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function TipCard() {
  const [i, setI] = useState(() => Math.floor(Date.now() / 60000) % TIPS.length);
  return (
    <Card className="bg-gradient-to-br from-amber-400/[0.10] to-surface/80">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Lightbulb size={20} />
        </span>
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Security Tip</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-200">{TIPS[i]}</p>
        </div>
        <button type="button" onClick={() => setI((x) => (x + 1) % TIPS.length)} aria-label="Next tip" className="rounded-full bg-white/5 p-2 text-slate-300 hover:bg-white/10">
          <RefreshCw size={15} />
        </button>
      </div>
    </Card>
  );
}

export function Dashboard() {
  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <ScoreHero />
      <MasterCard />
      <BluetoothCard />
      <TrafficCard />
      <QuickStats />
      <ThreatsCard />
      <BatteryCard />
      <RecentEvents />
      <TipCard />
    </div>
  );
}
