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
  sniffing: 'υποκλοπή των δεδομένων που ανταλλάσσετε (πληκτρολογήσεις, ήχος, αρχεία)',
  bluejacking: 'να πέσετε θύμα phishing πατώντας έναν παγιδευμένο σύνδεσμο',
  bluesnarfing: 'κλοπή επαφών, μηνυμάτων και φωτογραφιών',
  bluebugging: 'πλήρη έλεγχο του κινητού: κλήσεις, SMS και κρυφό άνοιγμα μικροφώνου',
  blueborne: 'απομακρυσμένο έλεγχο του κινητού και μετάδοση σε άλλα κινητά',
  knob: 'σπάσιμο της κρυπτογράφησης σε δευτερόλεπτα',
  bias: 'σύνδεση μιας ψεύτικης «έμπιστης» συσκευής στο κινητό σας',
  braktooth: 'πάγωμα του κινητού ή εκτέλεση κακόβουλου κώδικα',
  tracking: 'καταγραφή των κινήσεών σας χωρίς να το ξέρετε',
  dos: 'κόλλημα του κινητού και ραγδαία εξάντληση της μπαταρίας',
};

export function outcomeText(e: SecurityEvent) {
  const mod = e.moduleId ? MODULE_MAP[e.moduleId] : null;
  switch (e.action) {
    case 'blocked':
      return mod ? `Η μονάδα «${mod.name}» απέκλεισε αυτόματα την απειλή. Δεν χρειάζεται να κάνετε κάτι.` : 'Η απειλή αποκλείστηκε αυτόματα.';
    case 'user-blocked':
      return 'Απορρίψατε το αίτημα — σωστή απόφαση! Αυτό ακριβώς πρέπει να κάνετε με κάθε αίτημα που δεν ξεκινήσατε εσείς.';
    case 'allowed':
      return mod
        ? `Η απειλή ΔΕΝ αποκλείστηκε, επειδή η μονάδα «${mod.name}» ήταν ανενεργή (OFF) ή η κεντρική προστασία ήταν κλειστή. Σε πραγματική επίθεση αυτό θα μπορούσε να σημαίνει ${CONSEQUENCE[mod.id]}.`
        : 'Το συμβάν δεν αποκλείστηκε.';
    case 'user-allowed':
      return `Αποδεχτήκατε το αίτημα. Σε πραγματική επίθεση ο επιτιθέμενος θα είχε τώρα πρόσβαση${mod ? ` — ${CONSEQUENCE[mod.id]}` : ''}. Την επόμενη φορά πατήστε «Απόρριψη».`;
    case 'warned':
      return mod?.id === 'tracking'
        ? 'Η εφαρμογή σας ειδοποίησε. Ακολουθήστε τις οδηγίες παρακάτω.'
        : `Η μονάδα «${mod?.name ?? ''}» είναι σε AUTO και έκρινε την απειλή χαμηλότερης σοβαρότητας: σας ειδοποίησε χωρίς να τη μπλοκάρει. Για να μπλοκάρεται πάντα, ρυθμίστε τη σε ON ή αυξήστε την ευαισθησία.`;
    default:
      return 'Ενημερωτικό μήνυμα της εφαρμογής.';
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
            {e.simulated ? <SimBadge /> : <LiveBadge label="ΠΡΑΓΜΑΤΙΚΟ" />}
            <span className="text-[11.5px] text-slate-500">
              {fmtDate(e.time)} · {fmtClock(e.time)}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-slate-200">{e.description}</p>
          <div className={cn('rounded-2xl border p-3.5', e.action === 'allowed' || e.action === 'user-allowed' ? 'border-rose-400/25 bg-rose-500/10' : e.action === 'warned' ? 'border-amber-400/20 bg-amber-500/10' : 'border-emerald-400/20 bg-emerald-500/10')}>
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-200">
              <Bot size={14} /> Τι έκανε η εφαρμογή
            </div>
            <p className="text-[13px] leading-relaxed text-slate-200">{outcomeText(e)}</p>
          </div>
          {mod && (
            <div className="rounded-2xl bg-white/[0.04] p-3.5">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-sky-300">
                <Brain size={14} /> Τι σημαίνει αυτό; (με απλά λόγια)
              </div>
              <p className="text-[13px] leading-relaxed text-slate-300">{mod.analogy}</p>
            </div>
          )}
          <div className="rounded-2xl bg-white/[0.04] p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-emerald-300">
              <Wrench size={14} /> Τι πρέπει να κάνω;
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
              Ρυθμίσεις «{mod.name}» <ChevronRight size={15} />
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
    const buckets = Array.from({ length: 15 }, (_, i) => ({ label: i === 14 ? 'τώρα' : `-${14 - i}′`, blocked: 0, warned: 0, allowed: 0 }));
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
      ['Ημερομηνία', 'Ώρα', 'Μονάδα', 'Σοβαρότητα', 'Ενέργεια', 'Τίτλος', 'Συσκευή', 'Περιγραφή', 'Πηγή'].map(esc).join(','),
      ...events.map((e) =>
        [fmtDate(e.time), fmtClock(e.time), e.moduleId ? MODULE_MAP[e.moduleId].name : '—', SEVERITY_LABEL[e.severity], actionLabel(e.action), e.title, e.device || '', e.description, e.simulated ? 'Προσομοίωση' : 'Πραγματικό']
          .map(esc)
          .join(','),
      ),
    ];
    downloadFile(`blueshield-symvanta-${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + rows.join('\n'), 'text/csv');
    toast('Το αρχείο CSV δημιουργήθηκε', 'success');
  };

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: 'Σύνολο', v: counts.total, c: 'text-white', I: ListFilter },
          { l: 'Αποκλ.', v: counts.blocked, c: 'text-emerald-300', I: ShieldCheck },
          { l: 'Προειδ.', v: counts.warned, c: 'text-amber-300', I: TriangleAlert },
          { l: 'Πέρασαν', v: counts.allowed, c: 'text-rose-300', I: OctagonAlert },
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
            Σωστές αποφάσεις σε αιτήματα σύνδεσης: <b className="text-white">{stats.correct}</b> από <b className="text-white">{stats.correct + stats.wrong}</b>
          </div>
          <span className="text-lg font-bold text-amber-300">{Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)}%</span>
        </Card>
      )}

      <Card>
        <SectionTitle icon={ChartColumn} title="Συμβάντα ανά λεπτό" subtitle="Τελευταία 15 λεπτά" help={{ title: 'Συμβάντα ανά λεπτό', body: 'Κάθε στήλη είναι ένα λεπτό. Πράσινο = απειλές που μπλοκαρίστηκαν, κίτρινο = προειδοποιήσεις, κόκκινο = απειλές που ΔΕΝ μπλοκαρίστηκαν (π.χ. επειδή μια μονάδα ήταν OFF). Αγγίξτε μια στήλη για λεπτομέρειες.' }} />
        <EventsBar data={bars} />
      </Card>

      <div className="space-y-2">
        <Segmented<SevFilter>
          size="sm"
          value={sev}
          onChange={setSev}
          options={[
            { value: 'all', label: 'Όλα' },
            { value: 'critical', label: 'Κρίσιμα' },
            { value: 'high', label: 'Υψηλά' },
            { value: 'medium', label: 'Μέτρια' },
            { value: 'low', label: 'Χαμηλά' },
          ]}
        />
        <Segmented<ActFilter>
          size="sm"
          value={act}
          onChange={setAct}
          options={[
            { value: 'all', label: 'Κάθε ενέργεια' },
            { value: 'blocked', label: 'Αποκλείστηκαν' },
            { value: 'warned', label: 'Προειδοπ.' },
            { value: 'allowed', label: 'Πέρασαν' },
          ]}
        />
      </div>

      <Card className="py-1">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-slate-400">Κανένα συμβάν με αυτά τα φίλτρα.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filtered.slice(0, limit).map((e) => (
              <EventRow key={e.id} e={e} onClick={() => setOpen(e.id)} />
            ))}
          </div>
        )}
        {filtered.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 30)} className="w-full py-3 text-sm font-semibold text-sky-300">
            Εμφάνιση περισσότερων ({filtered.length - limit})
          </button>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!events.length}>
          Εξαγωγή CSV
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
          {confirmClear ? 'Πατήστε ξανά' : 'Διαγραφή'}
        </Button>
      </div>
      <EventDetailSheet id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
