import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown, Brain, Lightbulb, ShieldCheck, Wrench, Check, FlaskConical, Sparkles, Lock, LockOpen, Contact, MessageSquare, FolderOpen,
  Phone, Fingerprint, Radar, Tag, Signal, Shuffle, Smartphone, RefreshCw, Trash2, KeyRound,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { CATEGORY_LABEL, MODULES, MODULE_COLOR, type ModuleDef } from '../data/modules';
import { effectiveMode, LOCATION_LABEL } from '../lib/mode';
import { daysSince, timeAgo } from '../lib/utils';
import type { Mode, ModuleId, Permissions } from '../types';
import { Button, Card, Hint, IconBox, InfoButton, LiveBadge, ModeSwitch, Segmented, SeverityBadge, severityTone, Slider, Toggle } from '../components/ui';
import { KeyBars, RingProgress, Sparkline, TrafficChart } from '../components/charts';

const MODE_COLOR: Record<Mode, string> = { on: 'text-emerald-300', auto: 'text-sky-300', off: 'text-rose-300' };
const MODE_CHIP: Record<Mode, string> = { on: 'bg-emerald-400 text-emerald-950', auto: 'bg-sky-400 text-sky-950', off: 'bg-rose-500 text-white' };

function Extra({ title, icon: Icon, children, live }: { title: string; icon: LucideIcon; children: ReactNode; live?: boolean }) {
  return (
    <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.05] p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-sky-200">
        <Icon size={14} /> {title} {live && <LiveBadge />}
      </div>
      {children}
    </div>
  );
}

function PermChip({ on, label, icon: Icon, onClick }: { on: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 transition', on ? 'bg-amber-500/15 text-amber-200 ring-amber-400/30' : 'bg-white/[0.04] text-slate-500 ring-white/10')}>
      <Icon size={11} /> {label} {on ? '✓' : '✕'}
    </button>
  );
}

function SystemBox({ firmware }: { firmware?: boolean }) {
  const sys = useStore((s) => s.sysInfo);
  const checkedAt = useStore((s) => s.updatesCheckedAt);
  const mark = useStore((s) => s.markUpdatesChecked);
  const color = sys?.support === 'ok' ? 'text-emerald-300' : sys?.support === 'warn' ? 'text-amber-300' : sys?.support === 'fail' ? 'text-rose-300' : 'text-slate-300';
  return (
    <Extra title="System Patch Status" icon={Smartphone} live={!!sys?.live}>
      <div className="text-[13px] text-slate-200">
        <b>
          {sys ? `${sys.osName}${sys.version ? ' ' + sys.version : ''}` : 'Reading…'}
          {sys?.model ? ` · ${sys.model}` : ''}
        </b>
        {sys && <span className="text-slate-500"> · {sys.browser}</span>}
      </div>
      {sys && <p className={cn('mt-1 text-[12.5px] leading-snug', color)}>{sys.supportText}</p>}
      <p className="mt-2 text-[12px] text-slate-400">Last update check: <b className="text-slate-200">{checkedAt ? timeAgo(checkedAt) : 'never'}</b></p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] leading-snug text-slate-400">
        <li>Android: Settings → System → Software update (Samsung: Settings → Software update).</li>
        <li>Settings → Security & privacy → Updates → Security update / Google Play system update.</li>
        {firmware && <li>Earbuds/watches: check firmware updates inside the companion app (e.g. Galaxy Wearable, Sony Headphones Connect, Zepp).</li>}
      </ol>
      <Button size="sm" variant="secondary" className="mt-3" icon={RefreshCw} onClick={mark}>
        I checked for updates
      </Button>
    </Extra>
  );
}

function ModuleExtras({ id }: { id: ModuleId }) {
  const paired = useStore((s) => s.paired);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setPermission = useStore((s) => s.setPermission);
  const location = useStore((s) => s.location);
  const keyHistory = useStore((s) => s.keyHistory);
  const nearby = useStore((s) => s.nearby);
  const macRotations = useStore((s) => s.macRotations);
  const timeline = useStore((s) => s.timeline);
  const removeStale = useStore((s) => s.removeStale);
  const go = useStore((s) => s.go);
  const events = useStore((s) => s.events);
  const perm = (pid: string, k: keyof Permissions, v: boolean) => setPermission(pid, k, v);

  switch (id) {
    case 'sniffing':
      return (
        <Extra title="Encryption status of your links" icon={Lock}>
          <ul className="space-y-1.5">
            {[...paired].sort((a, b) => Number(b.connected) - Number(a.connected)).slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[12.5px]">
                {p.encrypted ? <Lock size={14} className="text-emerald-400" /> : <LockOpen size={14} className="text-rose-400" />}
                <span className="flex-1 truncate text-slate-200">
                  {p.name} {p.connected && <span className="text-[10.5px] text-sky-300">· connected</span>}
                </span>
                <span className={cn('text-[11px]', p.encrypted ? 'text-emerald-300' : 'text-rose-300')}>{p.encrypted ? (p.secure === 'sc' ? 'Secure Conn.' : 'Legacy') : 'UNENCRYPTED'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
            <div className="flex-1 text-[13px] text-slate-200">Pair only in trusted places</div>
            <Toggle checked={settings.pairingOnlyTrusted} onChange={(v) => updateSettings({ pairingOnlyTrusted: v })} label="Pair only in trusted places" />
          </div>
          <p className={cn('mt-1.5 text-[12px]', location === 'public' ? 'text-amber-300' : 'text-emerald-300')}>
            Current location: {LOCATION_LABEL[location]} — {location === 'public' ? 'new pairing is blocked' : 'pairing allowed'}
          </p>
        </Extra>
      );
    case 'bluejacking': {
      const blockedCount = events.filter((e) => e.moduleId === 'bluejacking' && (e.action === 'blocked' || e.action === 'user-blocked')).length;
      return (
        <Extra title="Phishing keyword & URL filter" icon={MessageSquare}>
          <div className="flex flex-wrap gap-1.5">
            {['you won', 'free gift', 'verify now', 'security update', 'your parcel', 'passcode', 'account', 'bit.ly', 'tinyurl', '.apk'].map((w) => (
              <span key={w} className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11.5px] text-violet-200">
                {w}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
            <div className="flex-1 text-[13px] text-slate-200">Auto-reject unknown requests</div>
            <Toggle checked={settings.autoRejectUnknown} onChange={(v) => updateSettings({ autoRejectUnknown: v })} label="Auto-reject unknown requests" />
          </div>
          <p className="mt-1.5 text-[12px] text-slate-400">Messages / vCards blocked: <b className="text-emerald-300">{blockedCount}</b></p>
        </Extra>
      );
    }
    case 'bluesnarfing':
      return (
        <Extra title="Per-device data permissions" icon={Contact}>
          <ul className="space-y-2.5">
            {paired.map((p) => (
              <li key={p.id}>
                <div className="mb-1 text-[12.5px] font-medium text-slate-200">{p.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  <PermChip on={p.permissions.contacts} label="Contacts" icon={Contact} onClick={() => perm(p.id, 'contacts', !p.permissions.contacts)} />
                  <PermChip on={p.permissions.messages} label="Messages" icon={MessageSquare} onClick={() => perm(p.id, 'messages', !p.permissions.messages)} />
                  <PermChip on={p.permissions.files} label="Files" icon={FolderOpen} onClick={() => perm(p.id, 'files', !p.permissions.files)} />
                </div>
              </li>
            ))}
          </ul>
          <Hint className="mt-3">Grant only what each device genuinely needs: your personal car needs Contacts, earbuds need none of these. In a rental car, keep everything off!</Hint>
        </Extra>
      );
    case 'bluebugging':
      return (
        <Extra title="Devices allowed to control calls & mic" icon={Phone}>
          <ul className="space-y-2">
            {paired.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-[12.5px] text-slate-200">{p.name}</span>
                <PermChip on={p.permissions.calls} label="Calls / Mic" icon={Phone} onClick={() => perm(p.id, 'calls', !p.permissions.calls)} />
              </li>
            ))}
          </ul>
          <Hint className="mt-3">Only your earbuds and your personal car need call/microphone control. Any other device requesting it is suspicious.</Hint>
        </Extra>
      );
    case 'blueborne':
      return <SystemBox />;
    case 'braktooth':
      return <SystemBox firmware />;
    case 'knob': {
      const data = keyHistory.map((k, i) => ({ i, bytes: k.bytes, device: k.device, accepted: k.accepted }));
      const weak = paired.filter((p) => p.keyBytes < 16);
      return (
        <Extra title="Minimum encryption key length" icon={KeyRound}>
          <Segmented<7 | 10 | 16>
            size="sm"
            value={settings.minKeyBytes}
            onChange={(v) => updateSettings({ minKeyBytes: v })}
            options={[
              { value: 7, label: '7 B (56-bit)' },
              { value: 10, label: '10 B (80-bit)' },
              { value: 16, label: '16 B (128-bit) ✓' },
            ]}
          />
          <div className="mt-3 text-[11.5px] text-slate-400">Recently negotiated link keys (tap a bar):</div>
          {data.length ? <KeyBars data={data} min={settings.minKeyBytes} /> : <p className="py-4 text-center text-[12px] text-slate-500">No key negotiations logged yet.</p>}
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10.5px]">
            <div className="rounded-lg bg-rose-500/10 p-1.5 text-rose-200">
              <b>1 byte</b>
              <br />
              256 keys
              <br />→ cracked instantly
            </div>
            <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-200">
              <b>7 bytes</b>
              <br />≈7×10¹⁶
              <br />→ hours on custom rigs
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-200">
              <b>16 bytes</b>
              <br />≈3×10³⁸
              <br />→ practically unbreakable
            </div>
          </div>
          {weak.length > 0 && <p className="mt-2 text-[12px] text-amber-300">Devices with shorter keys: {weak.map((w) => `${w.name} (${w.keyBytes}B)`).join(', ')}</p>}
        </Extra>
      );
    }
    case 'bias': {
      const stale = paired.filter((p) => daysSince(p.lastUsed) > settings.staleDays).length;
      const fp = (mac: string) => mac.replace(/:/g, '').split('').reverse().join('').slice(0, 8);
      return (
        <Extra title="Trusted device fingerprints" icon={Fingerprint}>
          <ul className="space-y-1.5">
            {paired.map((p) => {
              const old = daysSince(p.lastUsed) > settings.staleDays;
              return (
                <li key={p.id} className="flex items-center gap-2 text-[12px]">
                  <Fingerprint size={13} className={p.secure === 'sc' ? 'text-emerald-400' : 'text-amber-400'} />
                  <span className="flex-1 truncate text-slate-200">{p.name}</span>
                  <span className="font-mono text-[10.5px] text-slate-500">FP-{fp(p.mac)}</span>
                  <span className={cn('text-[10.5px]', old ? 'text-rose-300' : p.secure === 'sc' ? 'text-emerald-300' : 'text-amber-300')}>{old ? 'stale' : p.secure === 'sc' ? 'SC ✓' : 'Legacy'}</span>
                </li>
              );
            })}
          </ul>
          {stale > 0 && (
            <Button size="sm" variant="danger" icon={Trash2} className="mt-3" onClick={() => removeStale()}>
              Remove stale devices ({stale})
            </Button>
          )}
        </Extra>
      );
    }
    case 'tracking':
      return (
        <Extra title="Tracking & beacon monitor" icon={Radar}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.04] p-2">
              <Tag size={15} className="mx-auto text-rose-300" />
              <div className="text-lg font-bold text-white">{nearby.filter((d) => d.tags.includes('tracker')).length}</div>
              <div className="text-[10px] text-slate-400">Trackers</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-2">
              <Signal size={15} className="mx-auto text-sky-300" />
              <div className="text-lg font-bold text-white">{nearby.filter((d) => d.tags.includes('beacon')).length}</div>
              <div className="text-[10px] text-slate-400">Beacons</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-2">
              <Shuffle size={15} className="mx-auto text-violet-300" />
              <div className="text-lg font-bold text-white">{macRotations}</div>
              <div className="text-[10px] text-slate-400">MAC rotations</div>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-slate-400">Android 10+ and iOS automatically rotate your broadcast Bluetooth MAC. Pairing that with a neutral device name and turning Bluetooth off when idle completes your privacy shield.</p>
          <Button size="sm" variant="secondary" icon={Radar} className="mt-2" onClick={() => go('radar')}>
            Open Radar
          </Button>
        </Extra>
      );
    case 'dos':
      return (
        <Extra title="Packet rate limit & live traffic" icon={Signal}>
          <Slider value={settings.dosThreshold} min={100} max={800} step={50} onChange={(v) => updateSettings({ dosThreshold: v })} format={(v) => `${v} /s`} />
          <div className="mt-2">
            <TrafficChart data={timeline} threshold={settings.dosThreshold} height={140} forceThreshold />
          </div>
          <Hint className="mt-2">Drag the slider: the dashed red threshold line on the live chart updates instantly. Lower limit = stricter flood protection.</Hint>
        </Extra>
      );
  }
}

function ModuleCard({ def, open, onToggle }: { def: ModuleDef; open: boolean; onToggle: () => void }) {
  const mode = useStore((s) => s.modules[def.id]);
  const setModule = useStore((s) => s.setModule);
  const master = useStore((s) => s.master);
  const location = useStore((s) => s.location);
  const events = useStore((s) => s.events);
  const simulateAttack = useStore((s) => s.simulateAttack);
  const expert = useStore((s) => !s.settings.beginnerMode);
  const [tech, setTech] = useState(false);
  const eff = effectiveMode(master, mode, location);
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const now = Date.now();
    const mine = events.filter((e) => e.moduleId === def.id && e.severity !== 'info');
    const spark = Array.from({ length: 15 }, () => 0);
    mine.forEach((e) => {
      const b = Math.floor((now - e.time) / 120000);
      if (b < 15) spark[14 - b]++;
    });
    return {
      blocked: mine.filter((e) => (e.action === 'blocked' || e.action === 'user-blocked') && new Date(e.time).toDateString() === today).length,
      passed: mine.filter((e) => (e.action === 'allowed' || e.action === 'user-allowed') && new Date(e.time).toDateString() === today).length,
      spark,
    };
  }, [events, def.id]);
  const showTech = tech || expert;
  return (
    <Card className={cn('overflow-hidden p-0', eff === 'off' && 'border-rose-400/25')}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <IconBox icon={def.icon} tone={severityTone(def.severity)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[14.5px] font-semibold leading-snug text-white">{def.name}</h3>
              <SeverityBadge severity={def.severity} className="shrink-0" />
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{def.short}</p>
          </div>
        </div>
        <div className="mt-3">
          <ModeSwitch value={mode} onChange={(m) => setModule(def.id, m)} />
        </div>
        {eff !== mode && (
          <div className={cn('mt-2 rounded-xl px-2.5 py-1.5 text-[11.5px]', master === 'off' ? 'bg-rose-500/10 text-rose-200' : 'bg-emerald-500/10 text-emerald-200')}>
            {master === 'off' ? '⚠ Inactive: Master Protection is set to OFF.' : '↑ Escalated to ON: Master AUTO in a public place.'}
          </div>
        )}
        <p className="mt-2 text-[12.5px] leading-snug text-slate-300">
          <b className={MODE_COLOR[eff]}>{eff.toUpperCase()}:</b> {def.modes[eff]}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 text-[11.5px] text-slate-400">
            Blocked today: <b className="text-emerald-300">{stats.blocked}</b>
            {stats.passed > 0 && (
              <>
                {' '}
                · Passed: <b className="text-rose-300">{stats.passed}</b>
              </>
            )}
          </div>
          <Sparkline values={stats.spark} color={MODULE_COLOR[def.id]} />
        </div>
      </div>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[13px] font-semibold text-sky-300 transition hover:bg-white/[0.03]">
        {open ? 'Hide details' : 'What is it? How does it protect me?'}
        <ChevronDown size={16} className={cn('transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="anim-fade space-y-4 border-t border-white/[0.06] bg-black/10 px-4 py-4">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-sky-300">
              <Brain size={14} /> The threat in plain English
            </div>
            <p className="text-[13px] leading-relaxed text-slate-300">{def.threat}</p>
          </div>
          <div className="rounded-2xl bg-amber-400/[0.07] p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-amber-300">
              <Lightbulb size={14} /> Everyday analogy
            </div>
            <p className="text-[13px] leading-relaxed text-amber-50/90">{def.analogy}</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-emerald-300">
              <ShieldCheck size={14} /> What this shield does
            </div>
            <p className="text-[13px] leading-relaxed text-slate-300">{def.does}</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {(['on', 'auto', 'off'] as Mode[]).map((m) => (
              <div key={m} className={cn('flex items-start gap-3 border-b border-white/[0.06] p-3 text-[12.5px] last:border-0', eff === m && 'bg-white/[0.06]')}>
                <span className={cn('w-12 shrink-0 rounded-lg py-1 text-center text-[11px] font-extrabold', MODE_CHIP[m])}>{m.toUpperCase()}</span>
                <span className="flex-1 leading-snug text-slate-300">{def.modes[m]}</span>
                {eff === m && <Check size={16} className="mt-0.5 shrink-0 text-sky-300" />}
              </div>
            ))}
          </div>
          <ModuleExtras id={def.id} />
          <div>
            <button type="button" onClick={() => setTech((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-violet-300">
              <Wrench size={14} /> Technical details <ChevronDown size={14} className={cn('transition', showTech && 'rotate-180')} />
            </button>
            {showTech && <p className="mt-1.5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.06] p-3 text-[12.5px] leading-relaxed text-slate-300">{def.technical}</p>}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-300">Practical tips</div>
            <ul className="space-y-1.5">
              {def.tips.map((t) => (
                <li key={t} className="flex gap-2 text-[12.5px] leading-snug text-slate-300">
                  <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Button variant="secondary" icon={FlaskConical} className="w-full" onClick={() => simulateAttack(def.id)}>
            Simulate “{def.attack}” attack
          </Button>
          <p className="-mt-2 text-center text-[11px] text-slate-500">Safe simulation: watch live how BlueShield reacts with your current settings.</p>
        </div>
      )}
    </Card>
  );
}

type Cat = 'all' | ModuleDef['category'];

export function Protection() {
  const master = useStore((s) => s.master);
  const modules = useStore((s) => s.modules);
  const location = useStore((s) => s.location);
  const setAllModules = useStore((s) => s.setAllModules);
  const [cat, setCat] = useState<Cat>('all');
  const [open, setOpen] = useState<ModuleId | null>(null);
  const active = MODULES.filter((m) => effectiveMode(master, modules[m.id], location) !== 'off').length;
  const list = MODULES.filter((m) => cat === 'all' || m.category === cat);
  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <Card className="bg-gradient-to-br from-emerald-500/[0.10] to-surface/80">
        <div className="flex items-center gap-4">
          <RingProgress value={active} max={MODULES.length} size={78} color={active === MODULES.length ? '#34d399' : active >= 7 ? '#fbbf24' : '#fb7185'}>
            <div className="text-center leading-none">
              <div className="text-xl font-bold text-white">{active}</div>
              <div className="text-[10px] text-slate-400">/{MODULES.length}</div>
            </div>
          </RingProgress>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
              Active Shields
              <InfoButton
                help={{
                  title: 'Protection Modules',
                  body: 'Each module defends against a specific Bluetooth threat. For every module you can choose:\n\n• ON: always blocks the threat.\n• AUTO: decides intelligently based on threat severity, your sensitivity setting, and your location.\n• OFF: disables protection (events are still logged).\n\nTap "What is it?" on any card for a plain-English explanation and interactive controls.',
                  tips: ['"Recommended" applies balanced settings ideal for most people.', 'Run a "Simulate attack" test to see the difference between ON and OFF live.'],
                }}
              />
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">
              {master === 'off' ? 'Master Protection is OFF — every module below is disabled!' : master === 'auto' && location === 'public' ? 'Master AUTO in a public place: all shields escalated to ON.' : 'Configure each shield individually or apply a preset:'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button size="sm" variant="success" onClick={() => setAllModules('on')}>
            All ON
          </Button>
          <Button size="sm" icon={Sparkles} onClick={() => setAllModules('recommended')}>
            Recommended
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAllModules('auto')}>
            All AUTO
          </Button>
        </div>
      </Card>

      <Hint>
        <b>ON</b> = always blocks · <b>AUTO</b> = blocks serious threats & warns on minor ones · <b>OFF</b> = no protection. Unsure what to pick? Tap “Recommended”.
      </Hint>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-1.5">
          {(['all', 'sniffing', 'classic', 'modern', 'privacy', 'dos'] as Cat[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn('rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition', cat === c ? 'bg-sky-500 text-white' : 'bg-white/[0.06] text-slate-300 hover:bg-white/10')}
            >
              {c === 'all' ? `All (${MODULES.length})` : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {list.map((m) => (
        <ModuleCard key={m.id} def={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
      ))}
    </div>
  );
}
