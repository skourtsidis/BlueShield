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
      ? 'Το κινητό σας είναι πολύ καλά προστατευμένο. Συνεχίστε έτσι!'
      : score.total >= 70
        ? 'Καλή προστασία — λίγα βήματα ακόμη για το τέλειο.'
        : score.total >= 50
          ? 'Υπάρχουν κενά ασφαλείας. Πατήστε «Έλεγχος ασφαλείας» για να τα διορθώσετε με ένα πάτημα.'
          : 'Το κινητό σας είναι εκτεθειμένο! Κάντε αμέσως έλεγχο ασφαλείας.';
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-sky-500/[0.16] via-surface/80 to-indigo-500/[0.10] p-5">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Βαθμολογία ασφαλείας</span>
          <InfoButton
            help={{
              title: 'Βαθμολογία ασφαλείας',
              body: 'Ένας αριθμός από 0 έως 100 που δείχνει με μια ματιά πόσο ασφαλές είναι το κινητό σας απέναντι στους κινδύνους του Bluetooth.\n\nΥπολογίζεται από: τις ενεργές μονάδες προστασίας (50 πόντοι), την «υγιεινή» του Bluetooth — π.χ. αν μένει ανοιχτό, αν είναι ορατό, το όνομα της συσκευής, οι παλιές συσκευές (30 πόντοι) — και τις καλές πρακτικές σας (20 πόντοι). Επιθέσεις που δεν αποκλείστηκαν αφαιρούν πόντους.',
              tips: ['Πάνω από 85: εξαιρετικά.', 'Πατήστε «Ανάλυση» για να δείτε πού χάνετε πόντους.', 'Ο «Έλεγχος ασφαλείας» διορθώνει τα περισσότερα με ένα πάτημα.'],
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
          Έλεγχος ασφαλείας
        </Button>
        <Button variant="secondary" icon={ChartBar} onClick={() => openSheet('score')}>
          Ανάλυση
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
    on: 'Όλες οι μονάδες προστασίας λειτουργούν όπως τις έχετε ρυθμίσει.',
    auto:
      location === 'public'
        ? 'Είστε σε δημόσιο χώρο: όλες οι μονάδες ανέβηκαν αυτόματα σε ON (μέγιστη προστασία).'
        : `Είστε σε έμπιστη τοποθεσία (${LOCATION_LABEL[location]}): οι μονάδες λειτουργούν όπως τις ρυθμίσατε. Σε δημόσιο χώρο θα ανέβουν αυτόματα όλες σε ON.`,
    off: 'ΠΡΟΣΟΧΗ: Καμία μονάδα δεν λειτουργεί. Το κινητό σας δεν προστατεύεται από επιθέσεις.',
  }[master];
  return (
    <Card>
      <SectionTitle
        icon={ShieldCheck}
        title="Κεντρική προστασία"
        subtitle="Ο γενικός διακόπτης όλων των μονάδων"
        help={{
          title: 'Κεντρική προστασία',
          body: 'Είναι ο «γενικός διακόπτης» της εφαρμογής, που ελέγχει όλες τις μονάδες προστασίας μαζί.\n\n• ON: κάθε μονάδα λειτουργεί όπως την έχετε ρυθμίσει στην καρτέλα «Προστασία».\n• AUTO: έξυπνη λειτουργία — στο σπίτι/εργασία οι μονάδες λειτουργούν κανονικά, ενώ σε δημόσιους χώρους (καφετέρια, μετρό) ανεβαίνουν ΟΛΕΣ αυτόματα σε ON.\n• OFF: όλες οι μονάδες σταματούν. Δεν προτείνεται.',
          tips: ['Για αρχάριους προτείνεται το AUTO.', 'Ορίστε σωστά την τοποθεσία σας για να δουλεύει σωστά το AUTO.'],
        }}
      />
      <ModeSwitch value={master} onChange={setMaster} size="lg" />
      <p className={cn('mt-3 text-[13px] leading-relaxed', master === 'off' ? 'font-medium text-rose-300' : 'text-slate-300')}>{desc}</p>
      <button type="button" onClick={() => openSheet('location')} className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-left text-[13px] text-slate-200 transition hover:bg-white/[0.07]">
        <MapPin size={16} className="text-sky-300" />
        Τοποθεσία: <b>{LOCATION_LABEL[location]}</b>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', location === 'public' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300')}>
          {location === 'public' ? 'Μη έμπιστη' : 'Έμπιστη'}
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
            <h3 className="text-[15px] font-semibold text-white">Bluetooth</h3>
            {native ? <LiveBadge /> : <SimBadge />}
            <InfoButton
              help={{
                title: 'Διακόπτης Bluetooth (ON / OFF / AUTO)',
                body: 'Ελέγχει το ίδιο το Bluetooth του κινητού.\n\n• ON: το Bluetooth μένει πάντα ανοιχτό.\n• OFF: μένει πάντα κλειστό — η πιο απλή και 100% αποτελεσματική άμυνα, γιατί καμία επίθεση Bluetooth δεν μπορεί να φτάσει στο κινητό.\n• AUTO: ανοίγει όταν το χρειάζεστε και κλείνει μόνο του όταν δεν υπάρχει συνδεδεμένη συσκευή για όσα λεπτά ορίσετε, τη νύχτα και όταν φεύγετε από έμπιστη τοποθεσία.',
                more: 'Στο Android 13+ οι εφαρμογές δεν επιτρέπεται να κλείνουν μόνες τους το Bluetooth (BluetoothAdapter.disable() καταργήθηκε στο API 33). Στην έκδοση APK, η εφαρμογή διαβάζει την πραγματική κατάσταση, ζητά ενεργοποίηση με το επίσημο παράθυρο του συστήματος και, για απενεργοποίηση, σας ειδοποιεί και ανοίγει τις ρυθμίσεις Bluetooth.',
                tips: ['iPhone: κλείστε το από τις Ρυθμίσεις — το Control Center απλώς αποσυνδέει τις συσκευές.', 'Το AUTO είναι η καλύτερη ισορροπία ασφάλειας και ευκολίας.'],
              }}
            />
          </div>
          <div className={cn('text-xl font-bold', radioOn ? 'text-sky-300' : 'text-slate-400')}>{radioOn ? 'Ενεργό' : 'Ανενεργό'}</div>
          <div className="text-xs text-slate-400">
            {radioOn ? `${connected.length} συνδεδεμέν${connected.length === 1 ? 'η συσκευή' : 'ες συσκευές'}` : 'Καμία επίθεση Bluetooth δεν είναι δυνατή 🛡️'}
          </div>
        </div>
      </div>
      <ModeSwitch className="mt-4" value={radioMode} onChange={setRadioMode} palette="radio" size="lg" />
      <div className="mt-3 space-y-2 rounded-2xl bg-black/20 p-3 text-[12.5px] leading-relaxed text-slate-300">
        {radioMode === 'auto' && radioOn && connected.length === 0 && (
          <div className="flex items-center gap-2">
            <Timer size={15} className="shrink-0 text-violet-300" />
            <span>
              Αυτόματο κλείσιμο σε <b className="tabular-nums text-white">{fmtCountdown(autoOffIn)}</b> — καμία συνδεδεμένη συσκευή.
            </span>
          </div>
        )}
        {radioMode === 'auto' && radioOn && connected.length > 0 && (
          <div className="flex items-start gap-2">
            <Timer size={15} className="mt-0.5 shrink-0 text-violet-300" />
            <span>
              Μένει ανοιχτό όσο είναι συνδεδεμένα: <b className="text-white">{connected.map((c) => c.name).join(', ')}</b>. Θα κλείσει {settings.autoOffMinutes}′ μετά την αποσύνδεση.
            </span>
          </div>
        )}
        {radioMode === 'auto' && !radioOn && (
          <div className="flex items-center justify-between gap-2">
            <span>Κλειστό αυτόματα για την ασφάλειά σας.</span>
            <Button size="sm" onClick={wakeRadio}>
              Ενεργοποίηση τώρα
            </Button>
          </div>
        )}
        {radioMode === 'on' && <div>Μόνιμα ανοιχτό. Προτείνεται το AUTO, ώστε να κλείνει όταν δεν το χρησιμοποιείτε.</div>}
        {radioMode === 'off' && <div>Μόνιμα κλειστό — η πιο ασφαλής κατάσταση.</div>}
        {settings.nightEnabled && radioMode === 'auto' && (
          <div className="flex items-center gap-2 text-slate-400">
            <Moon size={14} /> Νυχτερινό κλείσιμο {settings.nightFrom}–{settings.nightTo}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] p-3">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', discoverable ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-slate-400')}>
          {discoverable ? <Eye size={18} /> : <EyeOff size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
            Ορατό σε άλλες συσκευές
            <InfoButton
              help={{
                title: 'Ορατότητα (Discoverable)',
                body: 'Όταν είναι ενεργή, το κινητό σας εμφανίζεται στη λίστα «διαθέσιμων συσκευών» όλων γύρω σας — άρα και των επιτιθέμενων. Επιθέσεις όπως το Bluejacking απαιτούν η συσκευή να είναι ορατή.\n\nΧρειάζεται ΜΟΝΟ για λίγα δευτερόλεπτα, όταν συνδέετε για πρώτη φορά μια νέα συσκευή. Η εφαρμογή την κλείνει αυτόματα μετά από λίγο.',
                tips: ['Κρατάτε την κλειστή.', 'Ο χρόνος αυτόματου κλεισίματος αλλάζει από τις Ρυθμίσεις.'],
              }}
            />
          </div>
          <div className="text-xs text-slate-400">
            {discoverable && discoverableUntil ? `Κλείνει αυτόματα σε ${fmtCountdown(discoverableUntil - now)}` : 'Κρυφό από αγνώστους — προτείνεται'}
          </div>
        </div>
        <Toggle checked={discoverable} onChange={setDiscoverable} label="Ορατότητα" />
      </div>
      <Hint className="mt-3">Το «OFF» είναι η πιο ασφαλής επιλογή: με κλειστό Bluetooth καμία επίθεση δεν είναι δυνατή. Το «AUTO» το κλείνει μόνο του όταν δεν το χρειάζεστε.</Hint>
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
        title="Κίνηση Bluetooth (live)"
        subtitle="Πακέτα δεδομένων ανά δευτερόλεπτο — τελευταίο 1,5 λεπτό"
        action={native ? undefined : <SimBadge />}
        help={{
          title: 'Γράφημα κίνησης Bluetooth',
          body: 'Δείχνει, κάθε δευτερόλεπτο, πόσα «πακέτα» δεδομένων φτάνουν στο κινητό σας μέσω Bluetooth (μπλε) και πόσα μπλόκαρε η εφαρμογή (πράσινο).\n\nΗ κόκκινη διακεκομμένη γραμμή είναι το όριο της προστασίας DoS: αν η κίνηση το ξεπεράσει απότομα, πιθανότατα πρόκειται για επίθεση «βομβαρδισμού» (Bluesmack).\n\nΑγγίξτε το γράφημα για να δείτε τις τιμές κάθε στιγμής.',
          more: 'Η κανονική κίνηση εξαρτάται από τις συνδεδεμένες συσκευές: ακουστικά (A2DP) ~30–45 πακέτα/δ., fitness trackers λίγα πακέτα/δ. Το Android δεν δίνει σε εφαρμογές πρόσβαση στα πακέτα του Bluetooth stack χωρίς root (μόνο μέσω HCI snoop log στις Επιλογές προγραμματιστή), γι’ αυτό η κίνηση εδώ είναι εκπαιδευτική προσομοίωση.',
        }}
      />
      {flood && (
        <div className={cn('mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs', flood.blocked ? 'bg-emerald-500/15 text-emerald-200' : 'animate-pulse bg-rose-500/20 text-rose-100')}>
          <Siren size={15} /> Πλημμύρα πακέτων από «{flood.source}» — {flood.blocked ? 'αποκλείεται ✓' : 'ΔΕΝ αποκλείεται!'}
        </div>
      )}
      <TrafficChart data={timeline} threshold={threshold} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { l: 'Τώρα', v: last?.packets ?? 0, c: 'text-sky-300' },
          { l: 'Μέγιστο', v: peak, c: 'text-white' },
          { l: 'Αποκλεισμένα', v: blocked, c: 'text-emerald-300' },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl bg-white/[0.04] py-2">
            <div className={cn('text-lg font-bold tabular-nums', x.c)}>{x.v.toLocaleString('el-GR')}</div>
            <div className="text-[10.5px] text-slate-400">{x.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Εισερχόμενα</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Αποκλεισμένα</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-rose-400" />Όριο DoS: {threshold}/δ</span>
      </div>
      {threshold > Math.max(80, peak * 1.25) && (
        <p className="mt-1.5 text-[11px] text-slate-500">Η κίνηση είναι πολύ κάτω από το όριο DoS ✓ — η κόκκινη γραμμή θα εμφανιστεί αν η κίνηση πλησιάσει το όριο.</p>
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
      <StatTile icon={Radar} label="Κοντινές συσκευές" value={nearby.length} sub={suspicious ? `${suspicious} ύποπτες` : 'καμία ύποπτη'} tone={suspicious ? 'amber' : 'sky'} onClick={() => go('radar')} />
      <StatTile icon={ShieldCheck} label="Απειλές αποκλείστηκαν σήμερα" value={blockedToday} tone="emerald" onClick={() => go('events')} />
      <StatTile icon={Link2} label="Συνδεδεμένες συσκευές" value={paired.filter((p) => p.connected).length} sub={`από ${paired.length} αποθηκευμένες`} tone="violet" onClick={() => go('devices')} />
      <StatTile icon={Layers} label="Ενεργές μονάδες" value={`${active}/${MODULES.length}`} sub={active < MODULES.length ? 'πατήστε για ρύθμιση' : 'πλήρης κάλυψη'} tone={active < MODULES.length ? 'rose' : 'emerald'} onClick={() => go('protection')} />
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
        title="Απειλές ανά κατηγορία"
        subtitle="Όλα τα συμβάντα ασφαλείας που καταγράφηκαν"
        help={{ title: 'Απειλές ανά κατηγορία', body: 'Το διάγραμμα δείχνει ποιοι τύποι επιθέσεων εμφανίστηκαν περισσότερο. Αγγίξτε ένα κομμάτι ή μια κατηγορία στη λίστα για να δείτε τι είναι και να μεταβείτε στην αντίστοιχη προστασία.' }}
      />
      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <ThreatDonut data={data} height={140} />
          <p className="text-[13px] text-slate-400">Δεν έχουν καταγραφεί απειλές ακόμη. Θέλετε να δείτε πώς αντιδρά η προστασία;</p>
          <Button size="sm" variant="secondary" icon={FlaskConical} onClick={() => simulateAttack(pick(MODULES).id)}>
            Δοκιμαστική επίθεση
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
            Ρύθμιση προστασίας <ChevronRight size={14} />
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
    ? { t: 'Φορτίζει', c: 'text-emerald-300' }
    : rate === null
      ? { t: 'Συλλογή δεδομένων…', c: 'text-slate-400' }
      : rate > 25
        ? { t: 'Ασυνήθιστα γρήγορη αποφόρτιση!', c: 'text-rose-300' }
        : rate > 12
          ? { t: 'Αυξημένη κατανάλωση', c: 'text-amber-300' }
          : { t: 'Φυσιολογική κατανάλωση', c: 'text-emerald-300' };
  return (
    <Card>
      <SectionTitle
        icon={battery.charging ? BatteryCharging : BatteryMedium}
        title="Μπαταρία & κατανάλωση"
        subtitle="Ανίχνευση επιθέσεων που αδειάζουν την μπαταρία"
        action={battery.source === 'live' ? <LiveBadge /> : <SimBadge />}
        help={{
          title: 'Παρακολούθηση μπαταρίας',
          body: 'Οι επιθέσεις άρνησης υπηρεσίας (π.χ. Bluesmack) βομβαρδίζουν το κινητό με πακέτα και αδειάζουν απότομα την μπαταρία. Η εφαρμογή μετρά πόσο γρήγορα πέφτει η μπαταρία (% ανά ώρα) και σας προειδοποιεί αν ο ρυθμός γίνει ασυνήθιστος.',
          more: 'Στην έκδοση για browser/APK χρησιμοποιείται το Battery Status API (navigator.getBattery). Η μπαταρία αλλάζει σε βήματα του 1%, οπότε ο ρυθμός γίνεται ακριβής μετά από μερικά λεπτά.',
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
              <div className="text-base font-bold tabular-nums text-slate-200">{rate.toFixed(1)}%/ώρα</div>
              ρυθμός αποφόρτισης
            </>
          )}
          {flood && !flood.blocked && <div className="mt-1 font-semibold text-rose-300">⚠ Επίθεση DoS σε εξέλιξη</div>}
        </div>
      </div>
      <div className="mt-2">
        <MiniArea data={hist.map((h) => ({ x: h.t, v: h.level }))} color={rate && rate > 25 ? '#fb7185' : '#34d399'} unit="%" name="Μπαταρία" height={70} xFormat={(x) => fmtClock(x)} />
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
        title="Πρόσφατα συμβάντα"
        action={
          <Button size="sm" variant="ghost" onClick={() => go('events')}>
            Όλα <ChevronRight size={14} />
          </Button>
        }
      />
      {list.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-slate-400">Όλα ήσυχα — κανένα συμβάν ακόμη. 🛡️</p>
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
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Συμβουλή ασφαλείας</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-200">{TIPS[i]}</p>
        </div>
        <button type="button" onClick={() => setI((x) => (x + 1) % TIPS.length)} aria-label="Επόμενη συμβουλή" className="rounded-full bg-white/5 p-2 text-slate-300 hover:bg-white/10">
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
