import { useMemo, useState } from 'react';
import { Info, Download, Trash2, ChartColumn, ListFilter, ShieldCheck, TriangleAlert, OctagonAlert, Brain, Wrench, Bot, ChevronRight, Trophy } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { MODULE_MAP, SEVERITY_LABEL } from '../data/modules';
import { downloadFile, fmtClock, fmtDate, timeAgo } from '../lib/utils';
import type { EventAction, ModuleId, SecurityEvent, Severity } from '../types';
import { ActionBadge, actionLabel, BottomSheet, Button, Card, IconBox, LiveBadge, SectionTitle, Segmented, SeverityBadge, SimBadge, severityTone } from '../components/ui';
import { EventsBar } from '../components/charts';

const CONSEQUENCE: Record<ModuleId, string> = {
  sniffing: 'interception of the data you exchange (keystrokes, audio, files)',
  bluejacking: 'falling victim to phishing by tapping a booby-trapped link',
  bluesnarfing: 'silent theft of your contacts, messages, and photos',
  bluebugging: 'full covert takeover: calls, SMS, and hidden microphone activation',
  blueborne: 'remote device takeover and worm-like spread to nearby phones',
  knob: 'having your Bluetooth encryption cracked within seconds',
  bias: 'a spoofed "trusted" device connecting to your phone without the link key',
  braktooth: 'Bluetooth freezes or arbitrary code execution on unpatched chips',
  tracking: 'having your physical movements logged without your knowledge',
  dos: 'phone lag, crashes, and rapid battery depletion',
};

export function outcomeText(e: SecurityEvent) {
  const mod = e.moduleId ? MODULE_MAP[e.moduleId] : null;
  switch (e.action) {
    case 'blocked':
      return mod ? `The "${mod.name}" module automatically blocked this threat. No action needed.` : 'This threat was blocked automatically.';
    case 'user-blocked':
      return 'You rejected the prompt — great call! Always reject requests you did not initiate yourself.';
    case 'allowed':
      return mod
        ? `This threat was NOT blocked because "${mod.name}" was set to OFF or Master Protection was disabled. In a real attack this could lead to ${CONSEQUENCE[mod.id]}.`
        : 'Event was not blocked.';
    case 'user-allowed':
      return `You accepted the prompt. In a real attack the adversary would now have access${mod ? ` — risking ${CONSEQUENCE[mod.id]}` : ''}. Next time, tap "Reject".`;
    case 'warned':
      return mod?.id === 'tracking'
        ? 'BlueShield alerted you. Follow the guidance below.'
        : `"${mod?.name ?? ''}" is set to AUTO and rated this event below your auto-block sensitivity, issuing a warning instead. Switch it to ON or raise sensitivity to always block.`;
    default:
      return 'Informational BlueShield status log.';
  }
}

export function EventRow({ e, onClick }: { e: SecurityEvent; onClick?: () => void }) {
  const mod = e.moduleId ? MODULE_MAP[e.moduleId] : null;
  const Icon = mod?.icon ?? Info;
  const bad = e.action === 'allowed' || e.action === 'user-allowed';
  const good = e.action === 'blocked' || e.action === 'user-blocked';
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 py-3 text-left transition active:opacity-70">
      <IconBox icon={Icon} tone={bad ? 'rose' : good ? 'emerald' : severityTone(e.severity)} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13.5px] font-semibold leading-snug text-slate-100">{e.title}</span>
          <span className="shrink-0 pt-0.5 text-[10.5px] text-slate-500">{timeAgo(e.time)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <ActionBadge action={e.action} />
          {e.severity !== 'info' && <SeverityBadge severity={e.severity} />}
          {e.device && <span className="max-w-[140px] truncate text-[11px] text-slate-500">· {e.device}</span>}
        </div>
      </div>
    </button>
  );
}

export function EventDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const e = useStore((s) => (id ? s.events.find((x) => x.id === id) : undefined));
  const go = useStore((s) => s.go);
  const mod = e?.moduleId ? MODULE_MAP[e.moduleId] : null;
  return (
    <BottomSheet open={!!e} onClose={onClose} title={e?.title} icon={mod ? <IconBox icon={mod.icon} size="sm" tone={e ? severityTone(e.severity) : 'sky'} /> : undefined}>
      {e && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionBadge action={e.action} />
            <SeverityBadge severity={e.severity} />
            {e.simulated ? <SimBadge /> : <LiveBadge label="REAL" />}
            <span className="text-[11.5px] text-slate-500">
              {fmtDate(e.time)} · {fmtClock(e.time)}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-slate-200">{e.description}</p>
          <div className={cn('rounded-2xl border p-3.5', e.action === 'allowed' || e.action === 'user-allowed' ? 'border-rose-400/25 bg-rose-500/10' : e.action === 'warned' ? 'border-amber-400/20 bg-amber-500/10' : 'border-emerald-400/20 bg-emerald-500/10')}>
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-200">
              <Bot size={14} /> What BlueShield did
            </div>
            <p className="text-[13px] leading-relaxed text-slate-200">{outcomeText(e)}</p>
          </div>
          {mod && (
            <div className="rounded-2xl bg-white/[0.04] p-3.5">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-sky-300">
                <Brain size={14} /> What this means (in plain English)
              </div>
              <p className="text-[13px] leading-relaxed text-slate-300">{mod.analogy}</p>
            </div>
          )}
          <div className="rounded-2xl bg-white/[0.04] p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-emerald-300">
              <Wrench size={14} /> Recommended action
            </div>
            <p className="text-[13px] leading-relaxed text-slate-300">{e.advice}</p>
          </div>
          {mod && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                onClose();
                go('protection');
              }}
            >
              Configure “{mod.name}” <ChevronRight size={15} />
            </Button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

type SevFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type ActFilter = 'all' | 'blocked' | 'warned' | 'allowed';

export function EventsScreen() {
  const events = useStore((s) => s.events);
  const stats = useStore((s) => s.stats);
  const clearEvents = useStore((s) => s.clearEvents);
  const toast = useStore((s) => s.toast);
  const [sev, setSev] = useState<SevFilter>('all');
  const [act, setAct] = useState<ActFilter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const [confirmClear, setConfirmClear] = useState(false);

  const counts = useMemo(() => {
    const c = { total: events.length, blocked: 0, warned: 0, allowed: 0 };
    events.forEach((e) => {
      if (e.action === 'blocked' || e.action === 'user-blocked') c.blocked++;
      else if (e.action === 'warned') c.warned++;
      else if (e.action === 'allowed' || e.action === 'user-allowed') c.allowed++;
    });
    return c;
  }, [events]);

  const bars = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 15 }, (_, i) => ({ label: i === 14 ? 'now' : `-${14 - i}m`, blocked: 0, warned: 0, allowed: 0 }));
    events.forEach((e) => {
      const m = Math.floor((now - e.time) / 60000);
      if (m < 15 && e.severity !== 'info') {
        const b = buckets[14 - m];
        if (e.action === 'blocked' || e.action === 'user-blocked') b.blocked++;
        else if (e.action === 'warned') b.warned++;
        else if (e.action === 'allowed' || e.action === 'user-allowed') b.allowed++;
      }
    });
    return buckets;
  }, [events]);

  const filtered = events.filter((e) => {
    const sevOk: Record<SevFilter, (s: Severity) => boolean> = {
      all: () => true,
      critical: (s) => s === 'critical',
      high: (s) => s === 'high',
      medium: (s) => s === 'medium',
      low: (s) => s === 'low' || s === 'info',
    };
    const actOk: Record<ActFilter, (a: EventAction) => boolean> = {
      all: () => true,
      blocked: (a) => a === 'blocked' || a === 'user-blocked',
      warned: (a) => a === 'warned',
      allowed: (a) => a === 'allowed' || a === 'user-allowed',
    };
    return sevOk[sev](e.severity) && actOk[act](e.action);
  });

  const exportCsv = () => {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Time', 'Module', 'Severity', 'Outcome', 'Title', 'Device', 'Description', 'Source'].map(esc).join(','),
      ...events.map((e) =>
        [fmtDate(e.time), fmtClock(e.time), e.moduleId ? MODULE_MAP[e.moduleId].name : '—', SEVERITY_LABEL[e.severity], actionLabel(e.action), e.title, e.device || '', e.description, e.simulated ? 'Simulation' : 'Live']
          .map(esc)
          .join(','),
      ),
    ];
    downloadFile(`blueshield-events-${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + rows.join('\n'), 'text/csv');
    toast('CSV log exported', 'success');
  };

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: 'Total', v: counts.total, c: 'text-white', I: ListFilter },
          { l: 'Blocked', v: counts.blocked, c: 'text-emerald-300', I: ShieldCheck },
          { l: 'Warned', v: counts.warned, c: 'text-amber-300', I: TriangleAlert },
          { l: 'Passed', v: counts.allowed, c: 'text-rose-300', I: OctagonAlert },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl border border-white/[0.07] bg-surface/80 p-2.5 text-center">
            <x.I size={15} className={cn('mx-auto', x.c)} />
            <div className={cn('mt-1 text-lg font-bold tabular-nums', x.c)}>{x.v}</div>
            <div className="text-[10.5px] text-slate-400">{x.l}</div>
          </div>
        ))}
      </div>

      {stats.correct + stats.wrong > 0 && (
        <Card className="flex items-center gap-3 py-3">
          <IconBox icon={Trophy} tone="amber" />
          <div className="flex-1 text-[13px] text-slate-300">
            Correct decisions on incoming prompts: <b className="text-white">{stats.correct}</b> of <b className="text-white">{stats.correct + stats.wrong}</b>
          </div>
          <span className="text-lg font-bold text-amber-300">{Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)}%</span>
        </Card>
      )}

      <Card>
        <SectionTitle icon={ChartColumn} title="Events per minute" subtitle="Last 15 minutes" help={{ title: 'Events per minute', body: 'Each bar represents one minute. Green = blocked threats, yellow = warnings, red = threats that were NOT blocked (for example, because a module was turned OFF). Tap any bar to inspect values.' }} />
        <EventsBar data={bars} />
      </Card>

      <div className="space-y-2">
        <Segmented<SevFilter>
          size="sm"
          value={sev}
          onChange={setSev}
          options={[
            { value: 'all', label: 'All' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
        <Segmented<ActFilter>
          size="sm"
          value={act}
          onChange={setAct}
          options={[
            { value: 'all', label: 'All actions' },
            { value: 'blocked', label: 'Blocked' },
            { value: 'warned', label: 'Warned' },
            { value: 'allowed', label: 'Passed' },
          ]}
        />
      </div>

      <Card className="py-1">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-slate-400">No events match these filters.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filtered.slice(0, limit).map((e) => (
              <EventRow key={e.id} e={e} onClick={() => setOpen(e.id)} />
            ))}
          </div>
        )}
        {filtered.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 30)} className="w-full py-3 text-sm font-semibold text-sky-300">
            Show more ({filtered.length - limit})
          </button>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!events.length}>
          Export CSV
        </Button>
        <Button
          variant="danger"
          icon={Trash2}
          disabled={!events.length}
          onClick={() => {
            if (confirmClear) {
              clearEvents();
              setConfirmClear(false);
            } else {
              setConfirmClear(true);
              setTimeout(() => setConfirmClear(false), 3000);
            }
          }}
        >
          {confirmClear ? 'Tap again to confirm' : 'Clear log'}
        </Button>
      </div>
      <EventDetailSheet id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
