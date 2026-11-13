import { useEffect, useState } from 'react';
import {
  Bell, Settings as SettingsIcon, ArrowLeft, House, Radar, ShieldCheck, MonitorSmartphone, GraduationCap, Info, Check, ChevronDown,
  CircleCheck, TriangleAlert, OctagonAlert, Link2, Contact, Lock, FileText, Building, Coffee, MapPin, X, Sparkles, ScanSearch,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { LOCATION_LABEL } from '../lib/mode';
import { maskMac } from '../lib/utils';
import { useScore } from '../lib/score';
import { vibrate } from '../platform/system';
import type { LocationCtx, Screen } from '../types';
import { BottomSheet, Button, Hint, IconBox, ProgressBar, SimBadge } from './ui';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <path d="M24 3 L41 9 V22 C41 33 33.5 41.5 24 45 C14.5 41.5 7 33 7 22 V9 Z" fill="url(#logoG)" />
      <path d="M24 3 L41 9 V22 C41 33 33.5 41.5 24 45" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <path d="M18 17 L30 29 L24 35 V13 L30 19 L18 31" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TITLES: Record<Screen, string> = {
  home: 'BlueShield',
  radar: 'Ραντάρ Bluetooth',
  protection: 'Μονάδες Προστασίας',
  devices: 'Συσκευές',
  learn: 'Οδηγός Ασφάλειας',
  settings: 'Ρυθμίσεις',
  events: 'Αρχείο Συμβάντων',
};

export function TopBar() {
  const screen = useStore((s) => s.screen);
  const go = useStore((s) => s.go);
  const master = useStore((s) => s.master);
  const location = useStore((s) => s.location);
  const openSheet = useStore((s) => s.openSheet);
  const unread = useStore((s) => s.events.filter((e) => e.time > s.readEventsAt && e.severity !== 'info').length);
  const sub = screen === 'settings' || screen === 'events';
  const back = () => {
    const before = useStore.getState().screen;
    try {
      window.history.back();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (useStore.getState().screen === before) useStore.setState({ screen: 'home' });
    }, 250);
  };
  const dot = master === 'on' ? 'bg-emerald-400' : master === 'auto' ? 'bg-sky-400' : 'bg-rose-500';
  return (
    <header className="z-20 flex items-center gap-3 border-b border-white/[0.06] bg-app/85 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-xl">
      {sub ? (
        <button type="button" onClick={back} aria-label="Πίσω" className="rounded-full bg-white/5 p-2 text-slate-200 hover:bg-white/10">
          <ArrowLeft size={20} />
        </button>
      ) : (
        <Logo />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-bold leading-tight text-white">{TITLES[screen]}</div>
        <button type="button" onClick={() => openSheet('location')} className="flex items-center gap-1.5 text-[11.5px] text-slate-400 hover:text-slate-200">
          <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
          Προστασία {master.toUpperCase()} · <MapPin size={11} /> {LOCATION_LABEL[location]}
        </button>
      </div>
      <button type="button" onClick={() => go('events')} aria-label="Συμβάντα" className="relative rounded-full bg-white/5 p-2.5 text-slate-200 hover:bg-white/10">
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-app">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <button type="button" onClick={() => go('settings')} aria-label="Ρυθμίσεις" className="rounded-full bg-white/5 p-2.5 text-slate-200 hover:bg-white/10">
        <SettingsIcon size={19} />
      </button>
    </header>
  );
}

const NAV: { id: Screen; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Αρχική', icon: House },
  { id: 'radar', label: 'Ραντάρ', icon: Radar },
  { id: 'protection', label: 'Προστασία', icon: ShieldCheck },
  { id: 'devices', label: 'Συσκευές', icon: MonitorSmartphone },
  { id: 'learn', label: 'Οδηγός', icon: GraduationCap },
];

export function BottomNav() {
  const screen = useStore((s) => s.screen);
  const go = useStore((s) => s.go);
  const danger = useStore((s) => s.nearby.some((d) => d.risk === 'high'));
  const offModules = useStore((s) => s.master === 'off' || Object.values(s.modules).some((m) => m === 'off'));
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-app/90 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="grid grid-cols-5">
        {NAV.map((n) => {
          const active = screen === n.id;
          const I = n.icon;
          const badge = (n.id === 'radar' && danger) || (n.id === 'protection' && offModules);
          return (
            <button key={n.id} type="button" onClick={() => go(n.id)} className="flex flex-col items-center gap-1 py-0.5">
              <span className={cn('relative flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300', active ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400')}>
                <I size={20} strokeWidth={active ? 2.4 : 2} />
                {badge && <span className={cn('absolute right-3 top-1 h-2 w-2 rounded-full ring-2 ring-app', n.id === 'radar' ? 'bg-rose-500' : 'bg-amber-400')} />}
              </span>
              <span className={cn('text-[10.5px] leading-none', active ? 'font-semibold text-white' : 'text-slate-400')}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const tone = {
    info: { cls: 'border-sky-400/25 bg-[#0d1d36]/95 text-sky-50', I: Info, ic: 'text-sky-300' },
    success: { cls: 'border-emerald-400/25 bg-[#0c2423]/95 text-emerald-50', I: CircleCheck, ic: 'text-emerald-300' },
    warning: { cls: 'border-amber-400/25 bg-[#2a2210]/95 text-amber-50', I: TriangleAlert, ic: 'text-amber-300' },
    danger: { cls: 'border-rose-400/30 bg-[#2c1018]/95 text-rose-50', I: OctagonAlert, ic: 'text-rose-300' },
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[74px] z-[80] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const m = tone[t.tone];
        return (
          <button key={t.id} type="button" onClick={() => dismiss(t.id)} className={cn('anim-toast pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-[13px] leading-snug shadow-2xl backdrop-blur-xl', m.cls)}>
            <m.I size={17} className={cn('mt-0.5 shrink-0', m.ic)} />
            <span>{t.text}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HelpSheet() {
  const help = useStore((s) => s.help);
  const close = useStore((s) => s.closeHelp);
  const expert = useStore((s) => !s.settings.beginnerMode);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(expert), [help, expert]);
  return (
    <BottomSheet open={!!help} onClose={close} title={help?.title} icon={<IconBox icon={Info} size="sm" />}>
      {help && (
        <div className="space-y-4">
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-slate-200">{help.body}</p>
          {help.tips?.length ? (
            <div className="rounded-2xl bg-white/[0.04] p-3.5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Συμβουλές</div>
              <ul className="space-y-2">
                {help.tips.map((t) => (
                  <li key={t} className="flex gap-2 text-[13px] leading-snug text-slate-300">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {help.more && (
            <div>
              <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-sky-300">
                Για προχωρημένους <ChevronDown size={16} className={cn('transition', more && 'rotate-180')} />
              </button>
              {more && <p className="mt-2 rounded-2xl border border-white/10 bg-black/25 p-3.5 text-[12.5px] leading-relaxed text-slate-300">{help.more}</p>}
            </div>
          )}
          <Button onClick={close} className="w-full">
            Κατάλαβα
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

const REQ_META = {
  pair: { icon: Link2, title: 'Αίτημα σύζευξης Bluetooth' },
  file: { icon: FileText, title: 'Εισερχόμενο αρχείο' },
  vcard: { icon: Contact, title: 'Εισερχόμενη κάρτα επαφής' },
  access: { icon: Lock, title: 'Αίτημα πρόσβασης σε δεδομένα' },
};

export function RequestModal() {
  const r = useStore((s) => s.pendingRequest);
  const resolve = useStore((s) => s.resolveRequest);
  const vib = useStore((s) => s.settings.vibration);
  const [left, setLeft] = useState(20);
  const [why, setWhy] = useState(false);
  const rid = r?.id;
  useEffect(() => {
    if (!rid) return;
    setLeft(20);
    setWhy(false);
    if (vib) vibrate([70, 40, 70]);
    const iv = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(iv);
  }, [rid, vib]);
  useEffect(() => {
    if (rid && left <= 0) resolve(false, true);
  }, [left, rid, resolve]);
  if (!r) return null;
  const meta = REQ_META[r.kind];
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center p-5">
      <div className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="anim-pop relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/10 bg-[#121c36] shadow-2xl">
        <div className="h-1 bg-white/10">
          <div className="h-full bg-amber-400 transition-all duration-1000 ease-linear" style={{ width: `${(Math.max(0, left) / 20) * 100}%` }} />
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <IconBox icon={meta.icon} tone="amber" size="lg" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Bluetooth</div>
              <div className="text-[17px] font-semibold leading-tight text-white">{meta.title}</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-black/25 p-3.5">
            <div className="text-[15px] font-semibold text-white">«{r.deviceName}»</div>
            <div className="font-mono text-[11px] text-slate-400">{maskMac(r.mac)}</div>
            <div className="mt-2 text-[13px] text-slate-300">{r.detail}</div>
            {r.pin && (
              <div className="mt-3 text-center">
                <div className="text-[11px] text-slate-400">Κωδικός σύζευξης</div>
                <div className="font-mono text-2xl font-bold tracking-[0.3em] text-white">{r.pin}</div>
              </div>
            )}
          </div>
          <Hint className="mt-3">
            Δεν ξεκινήσατε εσείς αυτή τη σύνδεση; Πατήστε <b>Απόρριψη</b>. Τα αιτήματα από άγνωστες συσκευές είναι ο πιο συνηθισμένος τρόπος επίθεσης.
          </Hint>
          <button type="button" onClick={() => setWhy((v) => !v)} className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-sky-300">
            Γιατί είναι ύποπτο; <ChevronDown size={14} className={cn('transition', why && 'rotate-180')} />
          </button>
          {why && <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">{r.explanation}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => resolve(true)}>
              Αποδοχή
            </Button>
            <Button variant="success" icon={ShieldCheck} onClick={() => resolve(false)}>
              Απόρριψη
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            Αυτόματη απόρριψη σε {Math.max(0, left)} δευτ. <SimBadge label="ΑΣΚΗΣΗ" />
          </div>
        </div>
      </div>
    </div>
  );
}

const LOCS: { id: LocationCtx; icon: typeof House; desc: string }[] = [
  { id: 'home', icon: House, desc: 'Έμπιστη τοποθεσία. Επιτρέπεται το pairing και η προστασία λειτουργεί όπως την ρυθμίσατε.' },
  { id: 'work', icon: Building, desc: 'Έμπιστη τοποθεσία, με περισσότερες κοντινές συσκευές.' },
  { id: 'public', icon: Coffee, desc: 'Καφετέρια, μετρό, εμπορικό κέντρο, αεροδρόμιο. Πολύ περισσότερες απειλές — η AUTO ανεβάζει όλη την προστασία στο μέγιστο.' },
];

export function LocationSheet() {
  const open = useStore((s) => s.sheet === 'location');
  const openSheet = useStore((s) => s.openSheet);
  const location = useStore((s) => s.location);
  const setLocation = useStore((s) => s.setLocation);
  const useGps = useStore((s) => s.settings.useGps);
  return (
    <BottomSheet open={open} onClose={() => openSheet(null)} title="Πού βρίσκεστε;" icon={<IconBox icon={MapPin} size="sm" />}>
      <div className="space-y-2.5">
        <Hint>Η τοποθεσία επηρεάζει τις αυτόματες (AUTO) αποφάσεις: σε δημόσιους χώρους οι επιθέσεις είναι πιο πιθανές, οπότε η εφαρμογή γίνεται αυστηρότερη και μπλοκάρει το pairing.</Hint>
        {LOCS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              setLocation(l.id);
              openSheet(null);
            }}
            className={cn('flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition', location === l.id ? 'border-sky-400/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]')}
          >
            <IconBox icon={l.icon} tone={l.id === 'public' ? 'amber' : 'sky'} />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold text-white">
                {LOCATION_LABEL[l.id]} {l.id !== 'public' && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">Έμπιστη</span>}
              </div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{l.desc}</div>
            </div>
            {location === l.id && <Check size={18} className="mt-1 text-sky-300" />}
          </button>
        ))}
        <p className="pt-1 text-[12px] text-slate-500">
          {useGps ? 'Ο αυτόματος εντοπισμός μέσω GPS είναι ενεργός.' : 'Συμβουλή: ενεργοποιήστε τον αυτόματο εντοπισμό με GPS από τις Ρυθμίσεις → Τοποθεσίες.'}
        </p>
      </div>
    </BottomSheet>
  );
}

export function ScoreSheet() {
  const open = useStore((s) => s.sheet === 'score');
  const openSheet = useStore((s) => s.openSheet);
  const score = useScore();
  return (
    <BottomSheet
      open={open}
      onClose={() => openSheet(null)}
      title="Πώς υπολογίζεται η βαθμολογία"
      icon={<IconBox icon={Sparkles} size="sm" />}
      footer={
        <Button icon={ScanSearch} className="w-full" onClick={() => openSheet('audit')}>
          Έλεγχος & διόρθωση με ένα πάτημα
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-slate-300">
          Η βαθμολογία (0–100) δείχνει πόσο καλά προστατεύεται το κινητό σας. Αποτελείται από τρία μέρη. Κάθε γραμμή που δεν είναι πλήρης, είναι κάτι που μπορείτε να βελτιώσετε.
        </p>
        {score.parts.map((p) => (
          <div key={p.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold text-white">{p.label}</span>
              <span className="text-sm font-bold tabular-nums text-sky-200">
                {Math.round(p.value)}/{p.max}
              </span>
            </div>
            <ProgressBar value={p.value} max={p.max} color={p.value / p.max > 0.8 ? '#34d399' : p.value / p.max > 0.5 ? '#fbbf24' : '#fb7185'} />
            <ul className="mt-3 space-y-1.5">
              {p.items.map((it) => (
                <li key={it.label} className="flex items-start gap-2 text-[12.5px]">
                  {it.points >= it.max - 0.01 ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> : <X size={15} className="mt-0.5 shrink-0 text-rose-400" />}
                  <span className="flex-1 text-slate-300">{it.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {Math.round(it.points)}/{it.max}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {score.penalty > 0 && (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3.5 text-[12.5px] text-rose-100">
            <b>−{score.penalty} πόντοι:</b> επιθέσεις που δεν αποκλείστηκαν ή αιτήματα που εγκρίθηκαν τα τελευταία 10 λεπτά.
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
