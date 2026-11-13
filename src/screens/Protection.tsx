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
    <Extra title="Κατάσταση συστήματος" icon={Smartphone} live={!!sys?.live}>
      <div className="text-[13px] text-slate-200">
        <b>
          {sys ? `${sys.osName}${sys.version ? ' ' + sys.version : ''}` : 'Ανάγνωση…'}
          {sys?.model ? ` · ${sys.model}` : ''}
        </b>
        {sys && <span className="text-slate-500"> · {sys.browser}</span>}
      </div>
      {sys && <p className={cn('mt-1 text-[12.5px] leading-snug', color)}>{sys.supportText}</p>}
      <p className="mt-2 text-[12px] text-slate-400">Τελευταίος έλεγχος ενημερώσεων: <b className="text-slate-200">{checkedAt ? timeAgo(checkedAt) : 'ποτέ'}</b></p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] leading-snug text-slate-400">
        <li>Android: Ρυθμίσεις → Σύστημα → Ενημέρωση λογισμικού (Samsung: Ρυθμίσεις → Ενημέρωση λογισμικού).</li>
        <li>Ρυθμίσεις → Ασφάλεια → Ενημέρωση ασφαλείας / Google Play system update.</li>
        {firmware && <li>Ακουστικά/ρολόγια: ενημέρωση firmware από την εφαρμογή του κατασκευαστή (π.χ. Galaxy Wearable, Sony Headphones Connect, Zepp).</li>}
      </ol>
      <Button size="sm" variant="secondary" className="mt-3" icon={RefreshCw} onClick={mark}>
        Έλεγξα για ενημερώσεις
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
        <Extra title="Κρυπτογράφηση των συνδέσεών σας" icon={Lock}>
          <ul className="space-y-1.5">
            {[...paired].sort((a, b) => Number(b.connected) - Number(a.connected)).slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[12.5px]">
                {p.encrypted ? <Lock size={14} className="text-emerald-400" /> : <LockOpen size={14} className="text-rose-400" />}
                <span className="flex-1 truncate text-slate-200">
                  {p.name} {p.connected && <span className="text-[10.5px] text-sky-300">· συνδεδεμένη</span>}
                </span>
                <span className={cn('text-[11px]', p.encrypted ? 'text-emerald-300' : 'text-rose-300')}>{p.encrypted ? (p.secure === 'sc' ? 'Secure Conn.' : 'Legacy') : 'ΧΩΡΙΣ κρυπτογρ.'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
            <div className="flex-1 text-[13px] text-slate-200">Pairing μόνο σε έμπιστες τοποθεσίες</div>
            <Toggle checked={settings.pairingOnlyTrusted} onChange={(v) => updateSettings({ pairingOnlyTrusted: v })} label="Pairing μόνο σε έμπιστες τοποθεσίες" />
          </div>
          <p className={cn('mt-1.5 text-[12px]', location === 'public' ? 'text-amber-300' : 'text-emerald-300')}>
            Τώρα: {LOCATION_LABEL[location]} — {location === 'public' ? 'το νέο pairing μπλοκάρεται' : 'επιτρέπεται το pairing'}
          </p>
        </Extra>
      );
    case 'bluejacking': {
      const blockedCount = events.filter((e) => e.moduleId === 'bluejacking' && (e.action === 'blocked' || e.action === 'user-blocked')).length;
      return (
        <Extra title="Φίλτρο λέξεων-παγίδων (phishing)" icon={MessageSquare}>
          <div className="flex flex-wrap gap-1.5">
            {['κερδίσατε', 'δωρεάν', 'επιβεβαιώστε', 'ενημέρωση ασφαλείας', 'το δέμα σας', 'κωδικός', 'λογαριασμός', 'bit.ly', 'tinyurl', '.apk'].map((w) => (
              <span key={w} className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11.5px] text-violet-200">
                {w}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
            <div className="flex-1 text-[13px] text-slate-200">Αυτόματη απόρριψη άγνωστων αιτημάτων</div>
            <Toggle checked={settings.autoRejectUnknown} onChange={(v) => updateSettings({ autoRejectUnknown: v })} label="Αυτόματη απόρριψη" />
          </div>
          <p className="mt-1.5 text-[12px] text-slate-400">Μηνύματα/κάρτες που απορρίφθηκαν: <b className="text-emerald-300">{blockedCount}</b></p>
        </Extra>
      );
    }
    case 'bluesnarfing':
      return (
        <Extra title="Τι επιτρέπεται σε κάθε συσκευή" icon={Contact}>
          <ul className="space-y-2.5">
            {paired.map((p) => (
              <li key={p.id}>
                <div className="mb-1 text-[12.5px] font-medium text-slate-200">{p.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  <PermChip on={p.permissions.contacts} label="Επαφές" icon={Contact} onClick={() => perm(p.id, 'contacts', !p.permissions.contacts)} />
                  <PermChip on={p.permissions.messages} label="Μηνύματα" icon={MessageSquare} onClick={() => perm(p.id, 'messages', !p.permissions.messages)} />
                  <PermChip on={p.permissions.files} label="Αρχεία" icon={FolderOpen} onClick={() => perm(p.id, 'files', !p.permissions.files)} />
                </div>
              </li>
            ))}
          </ul>
          <Hint className="mt-3">Δώστε μόνο ό,τι χρειάζεται: το αυτοκίνητό σας χρειάζεται επαφές, τα ακουστικά τίποτα από αυτά. Σε νοικιασμένο αυτοκίνητο, όλα κλειστά!</Hint>
        </Extra>
      );
    case 'bluebugging':
      return (
        <Extra title="Ποιες συσκευές ελέγχουν κλήσεις & μικρόφωνο" icon={Phone}>
          <ul className="space-y-2">
            {paired.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-[12.5px] text-slate-200">{p.name}</span>
                <PermChip on={p.permissions.calls} label="Κλήσεις/Μικρόφωνο" icon={Phone} onClick={() => perm(p.id, 'calls', !p.permissions.calls)} />
              </li>
            ))}
          </ul>
          <Hint className="mt-3">Μόνο τα ακουστικά και το δικό σας αυτοκίνητο χρειάζονται έλεγχο κλήσεων. Κάθε άλλη συσκευή που το ζητά είναι ύποπτη.</Hint>
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
        <Extra title="Ελάχιστο μήκος κλειδιού κρυπτογράφησης" icon={KeyRound}>
          <Segmented<7 | 10 | 16>
            size="sm"
            value={settings.minKeyBytes}
            onChange={(v) => updateSettings({ minKeyBytes: v })}
            options={[
              { value: 7, label: '7 B (56 bit)' },
              { value: 10, label: '10 B (80 bit)' },
              { value: 16, label: '16 B (128 bit) ✓' },
            ]}
          />
          <div className="mt-3 text-[11.5px] text-slate-400">Κλειδιά που διαπραγματεύτηκαν πρόσφατα (αγγίξτε μια στήλη):</div>
          {data.length ? <KeyBars data={data} min={settings.minKeyBytes} /> : <p className="py-4 text-center text-[12px] text-slate-500">Δεν υπάρχουν ακόμη συνδέσεις.</p>}
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10.5px]">
            <div className="rounded-lg bg-rose-500/10 p-1.5 text-rose-200">
              <b>1 byte</b>
              <br />
              256 συνδυασμοί
              <br />→ σπάει αμέσως
            </div>
            <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-200">
              <b>7 bytes</b>
              <br />≈7×10¹⁶
              <br />→ ώρες με ειδικό υλικό
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-200">
              <b>16 bytes</b>
              <br />≈3×10³⁸
              <br />→ πρακτικά άσπαστο
            </div>
          </div>
          {weak.length > 0 && <p className="mt-2 text-[12px] text-amber-300">Συσκευές με αδύναμο κλειδί: {weak.map((w) => `${w.name} (${w.keyBytes}B)`).join(', ')}</p>}
        </Extra>
      );
    }
    case 'bias': {
      const stale = paired.filter((p) => daysSince(p.lastUsed) > settings.staleDays).length;
      const fp = (mac: string) => mac.replace(/:/g, '').split('').reverse().join('').slice(0, 8);
      return (
        <Extra title="Ψηφιακά αποτυπώματα έμπιστων συσκευών" icon={Fingerprint}>
          <ul className="space-y-1.5">
            {paired.map((p) => {
              const old = daysSince(p.lastUsed) > settings.staleDays;
              return (
                <li key={p.id} className="flex items-center gap-2 text-[12px]">
                  <Fingerprint size={13} className={p.secure === 'sc' ? 'text-emerald-400' : 'text-amber-400'} />
                  <span className="flex-1 truncate text-slate-200">{p.name}</span>
                  <span className="font-mono text-[10.5px] text-slate-500">FP-{fp(p.mac)}</span>
                  <span className={cn('text-[10.5px]', old ? 'text-rose-300' : p.secure === 'sc' ? 'text-emerald-300' : 'text-amber-300')}>{old ? 'παλιά' : p.secure === 'sc' ? 'SC ✓' : 'Legacy'}</span>
                </li>
              );
            })}
          </ul>
          {stale > 0 && (
            <Button size="sm" variant="danger" icon={Trash2} className="mt-3" onClick={() => removeStale()}>
              Αφαίρεση παλιών συσκευών ({stale})
            </Button>
          )}
        </Extra>
      );
    }
    case 'tracking':
      return (
        <Extra title="Ανίχνευση παρακολούθησης" icon={Radar}>
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
              <div className="text-[10px] text-slate-400">Αλλαγές MAC</div>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-slate-400">Τα Android 10+ και iOS αλλάζουν αυτόματα την ορατή διεύθυνση Bluetooth. Ένα ουδέτερο όνομα συσκευής και το κλειστό Bluetooth συμπληρώνουν την προστασία.</p>
          <Button size="sm" variant="secondary" icon={Radar} className="mt-2" onClick={() => go('radar')}>
            Άνοιγμα Ραντάρ
          </Button>
        </Extra>
      );
    case 'dos':
      return (
        <Extra title="Όριο πακέτων & live κίνηση" icon={Signal}>
          <Slider value={settings.dosThreshold} min={100} max={800} step={50} onChange={(v) => updateSettings({ dosThreshold: v })} format={(v) => `${v} /δ`} />
          <div className="mt-2">
            <TrafficChart data={timeline} threshold={settings.dosThreshold} height={140} forceThreshold />
          </div>
          <Hint className="mt-2">Μετακινήστε τη μπάρα: η κόκκινη γραμμή στο γράφημα αλλάζει live. Χαμηλότερο όριο = πιο αυστηρή προστασία.</Hint>
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
            {master === 'off' ? '⚠ Ανενεργή: η κεντρική προστασία είναι OFF.' : '↑ Λειτουργεί σε ON: Κεντρική AUTO σε δημόσιο χώρο.'}
          </div>
        )}
        <p className="mt-2 text-[12.5px] leading-snug text-slate-300">
          <b className={MODE_COLOR[eff]}>{eff.toUpperCase()}:</b> {def.modes[eff]}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 text-[11.5px] text-slate-400">
            Αποκλείστηκαν σήμερα: <b className="text-emerald-300">{stats.blocked}</b>
            {stats.passed > 0 && (
              <>
                {' '}
                · Πέρασαν: <b className="text-rose-300">{stats.passed}</b>
              </>
            )}
          </div>
          <Sparkline values={stats.spark} color={MODULE_COLOR[def.id]} />
        </div>
      </div>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[13px] font-semibold text-sky-300 transition hover:bg-white/[0.03]">
        {open ? 'Λιγότερα' : 'Τι είναι; Πώς με προστατεύει;'}
        <ChevronDown size={16} className={cn('transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="anim-fade space-y-4 border-t border-white/[0.06] bg-black/10 px-4 py-4">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-sky-300">
              <Brain size={14} /> Η απειλή με απλά λόγια
            </div>
            <p className="text-[13px] leading-relaxed text-slate-300">{def.threat}</p>
          </div>
          <div className="rounded-2xl bg-amber-400/[0.07] p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-amber-300">
              <Lightbulb size={14} /> Παρομοίωση
            </div>
            <p className="text-[13px] leading-relaxed text-amber-50/90">{def.analogy}</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-emerald-300">
              <ShieldCheck size={14} /> Τι κάνει αυτή η προστασία
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
              <Wrench size={14} /> Τεχνικές λεπτομέρειες <ChevronDown size={14} className={cn('transition', showTech && 'rotate-180')} />
            </button>
            {showTech && <p className="mt-1.5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.06] p-3 text-[12.5px] leading-relaxed text-slate-300">{def.technical}</p>}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-300">Συμβουλές</div>
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
            Δοκιμαστική επίθεση «{def.attack}»
          </Button>
          <p className="-mt-2 text-center text-[11px] text-slate-500">Ασφαλής προσομοίωση: δείτε live πώς αντιδρά η προστασία με τις τρέχουσες ρυθμίσεις σας.</p>
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
              Ενεργές μονάδες
              <InfoButton
                help={{
                  title: 'Μονάδες προστασίας',
                  body: 'Κάθε μονάδα προστατεύει από έναν συγκεκριμένο τύπο επίθεσης Bluetooth. Για καθεμία μπορείτε να επιλέξετε:\n\n• ON: μπλοκάρει πάντα την απειλή.\n• AUTO: αποφασίζει έξυπνα ανάλογα με τη σοβαρότητα, την ευαισθησία που ορίσατε και την τοποθεσία σας.\n• OFF: δεν προστατεύει (μόνο καταγράφει).\n\nΠατήστε «Τι είναι;» σε κάθε κάρτα για αναλυτική εξήγηση με απλά λόγια.',
                  tips: ['Το «Προτεινόμενα» εφαρμόζει τις ρυθμίσεις που ταιριάζουν στους περισσότερους.', 'Δοκιμάστε μια «Δοκιμαστική επίθεση» για να δείτε τη διαφορά ON και OFF.'],
                }}
              />
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">
              {master === 'off' ? 'Η κεντρική προστασία είναι OFF — όλες οι μονάδες είναι ανενεργές!' : master === 'auto' && location === 'public' ? 'AUTO σε δημόσιο χώρο: όλες λειτουργούν σε ON.' : 'Ρυθμίστε κάθε μονάδα ξεχωριστά ή όλες μαζί:'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button size="sm" variant="success" onClick={() => setAllModules('on')}>
            Όλα ON
          </Button>
          <Button size="sm" icon={Sparkles} onClick={() => setAllModules('recommended')}>
            Προτεινόμενα
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAllModules('auto')}>
            Όλα AUTO
          </Button>
        </div>
      </Card>

      <Hint>
        <b>ON</b> = πάντα μπλοκάρει · <b>AUTO</b> = μπλοκάρει τα σοβαρά και σας ειδοποιεί για τα υπόλοιπα · <b>OFF</b> = καμία προστασία. Αν δεν ξέρετε τι να διαλέξετε, πατήστε «Προτεινόμενα».
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
              {c === 'all' ? `Όλες (${MODULES.length})` : CATEGORY_LABEL[c]}
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
