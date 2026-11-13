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
      toast(`Αποθηκεύτηκε η τρέχουσα θέση ως «${pl?.name}» (ακρίβεια ~${Math.round(p.accuracy)} μ.)`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Σφάλμα τοποθεσίας', 'warning');
    }
  };

  const exportAll = () => {
    const st = useStore.getState();
    const data = { app: 'BlueShield', exportedAt: new Date().toISOString(), settings: st.settings, modules: st.modules, master: st.master, radioMode: st.radioMode, paired: st.paired, events: st.events };
    downloadFile(`blueshield-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
    toast('Το αντίγραφο ασφαλείας δημιουργήθηκε', 'success');
  };

  const capsList: { label: string; ok: boolean; note: string }[] = [
    { label: 'Εφαρμογή Android (APK)', ok: caps.native, note: caps.native ? 'Εκτελείται ως εγγενής εφαρμογή' : 'Εκτελείται σε browser' },
    { label: 'Κατάσταση Bluetooth συστήματος', ok: live.btEnabled !== null, note: live.btEnabled !== null ? (live.btEnabled ? 'Ενεργό' : 'Ανενεργό') : 'Μόνο στο APK' },
    { label: 'Σάρωση BLE συσκευών & trackers', ok: caps.native || caps.leScan, note: caps.native ? 'Native σάρωση' : caps.leScan ? 'Web Bluetooth Scanning' : 'Μόνο στο APK' },
    { label: 'Επιθεώρηση συσκευής BLE', ok: caps.webBluetooth, note: caps.webBluetooth ? 'Web Bluetooth' : 'Chrome/Edge σε Android ή υπολογιστή' },
    { label: 'Μπαταρία', ok: battery.source === 'live', note: battery.source === 'live' ? `${Math.round(battery.level)}%` : 'Δεν υποστηρίζεται — προσομοίωση' },
    { label: 'Έκδοση λειτουργικού', ok: !!sys?.live, note: sys ? `${sys.osName} ${sys.version ?? ''}` : '—' },
    { label: 'GPS (έμπιστες τοποθεσίες)', ok: caps.geolocation, note: caps.geolocation ? 'Διαθέσιμο' : 'Μη διαθέσιμο' },
    { label: 'Ειδοποιήσεις', ok: caps.notifications, note: caps.notifications ? 'Διαθέσιμες' : 'Μη διαθέσιμες εδώ' },
    { label: 'Δόνηση', ok: caps.vibrate, note: caps.vibrate ? 'Διαθέσιμη' : 'Μη διαθέσιμη' },
  ];

  const LOC_ICONS: Record<LocationCtx, LucideIcon> = { home: House, work: Building, public: Coffee };

  return (
    <div className="space-y-5 px-4 pb-8 pt-4">
      <Section title="Εμφάνιση & βοήθεια">
        <Row
          icon={GraduationCap}
          title="Λειτουργία αρχαρίου"
          desc="Απλές εξηγήσεις και συμβουλές σε κάθε οθόνη"
          help={{ title: 'Λειτουργία αρχαρίου', body: 'Όταν είναι ενεργή, βλέπετε κίτρινα πλαίσια με συμβουλές και εξηγήσεις σε όλη την εφαρμογή. Όταν είναι ανενεργή, εμφανίζονται αυτόματα οι τεχνικές λεπτομέρειες (CVE, πρωτόκολλα) για προχωρημένους.' }}
          right={<Toggle checked={s.beginnerMode} onChange={(v) => update({ beginnerMode: v })} label="Λειτουργία αρχαρίου" />}
        />
      </Section>

      <Section title="Αυτοματισμοί Bluetooth (λειτουργία AUTO)">
        <Row
          icon={Timer}
          title="Αυτόματο κλείσιμο μετά από αδράνεια"
          desc="Όταν καμία συσκευή δεν είναι συνδεδεμένη"
          help={{ title: 'Αυτόματο κλείσιμο', body: 'Στη λειτουργία AUTO, αν δεν υπάρχει καμία συνδεδεμένη συσκευή (ακουστικά, ρολόι κ.λπ.) για όσα λεπτά ορίσετε, το Bluetooth κλείνει μόνο του. Λιγότερος χρόνος = περισσότερη ασφάλεια.', more: 'Στο Android 13+ οι εφαρμογές δεν μπορούν να κλείσουν το Bluetooth. Στο APK, μόλις περάσει ο χρόνος λαμβάνετε ειδοποίηση με οδηγία να το κλείσετε.' }}
        >
          <Slider value={s.autoOffMinutes} min={1} max={60} onChange={(v) => update({ autoOffMinutes: v })} format={(v) => `${v} λεπτ${v === 1 ? 'ό' : 'ά'}`} />
        </Row>
        <Row
          icon={Moon}
          title="Νυχτερινή λειτουργία"
          desc="Κλείσιμο του Bluetooth τις ώρες ύπνου"
          right={<Toggle checked={s.nightEnabled} onChange={(v) => update({ nightEnabled: v })} label="Νυχτερινή λειτουργία" />}
        >
          {s.nightEnabled && (
            <div className="flex items-center gap-2 text-[13px] text-slate-300">
              Από
              <input type="time" value={s.nightFrom} onChange={(e) => update({ nightFrom: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-white [color-scheme:dark]" />
              έως
              <input type="time" value={s.nightTo} onChange={(e) => update({ nightTo: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-white [color-scheme:dark]" />
            </div>
          )}
        </Row>
        <Row
          icon={MapPin}
          title="Κλείσιμο όταν φεύγω από έμπιστο χώρο"
          desc="π.χ. όταν βγαίνετε από το σπίτι"
          right={<Toggle checked={s.offWhenLeaving} onChange={(v) => update({ offWhenLeaving: v })} label="Κλείσιμο όταν φεύγω" />}
        />
        <Row icon={Eye} title="Αυτόματο κλείσιμο ορατότητας" desc="Πόση ώρα μένει ορατό το κινητό όταν το ενεργοποιείτε">
          <Segmented<number>
            size="sm"
            value={s.discoverableTimeout}
            onChange={(v) => update({ discoverableTimeout: v })}
            options={[
              { value: 30, label: '30″' },
              { value: 60, label: '1′' },
              { value: 120, label: '2′' },
              { value: 300, label: '5′' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Τοποθεσίες">
        <Row icon={MapPin} title="Πού βρίσκεστε τώρα" desc="Επηρεάζει τις αποφάσεις της λειτουργίας AUTO">
          <Segmented<LocationCtx>
            size="sm"
            value={location}
            onChange={(v) => setLocation(v)}
            options={(['home', 'work', 'public'] as LocationCtx[]).map((l) => ({ value: l, label: LOCATION_LABEL[l], icon: LOC_ICONS[l] }))}
          />
        </Row>
        <Row
          icon={LocateFixed}
          title="Αυτόματος εντοπισμός με GPS"
          desc={caps.geolocation ? 'Αλλάζει μόνη της την τοποθεσία όταν μπαίνετε/βγαίνετε από έμπιστο χώρο' : 'Το GPS δεν είναι διαθέσιμο'}
          help={{ title: 'Αυτόματος εντοπισμός', body: 'Ορίστε μία φορά τη θέση του σπιτιού και της εργασίας σας (πατώντας «Εδώ» όταν βρίσκεστε εκεί). Μετά, η εφαρμογή καταλαβαίνει μόνη της πότε είστε σε έμπιστο χώρο και πότε όχι. Η θέση σας αποθηκεύεται ΜΟΝΟ στη συσκευή σας.' }}
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
                    toast(e instanceof Error ? e.message : 'Σφάλμα GPS', 'warning');
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
                  <div className="text-[11px] text-slate-500">{p.lat != null ? `Ορίστηκε · ακτίνα ${p.radius} μ.` : 'Δεν έχει οριστεί θέση'}</div>
                </div>
                <Button size="sm" variant="secondary" disabled={!caps.geolocation} onClick={() => void setPlaceHere(p.id)}>
                  Εδώ
                </Button>
              </div>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Ασφάλεια">
        <Row
          icon={Link2}
          title="Pairing μόνο σε έμπιστες τοποθεσίες"
          desc="Μπλοκάρει νέες συζεύξεις σε δημόσιους χώρους"
          help={{ title: 'Pairing μόνο σε έμπιστες τοποθεσίες', body: 'Η ανταλλαγή των κλειδιών ασφαλείας γίνεται τη στιγμή της πρώτης σύνδεσης. Σε δημόσιους χώρους κάποιος μπορεί να την υποκλέψει (sniffing). Με αυτή τη ρύθμιση, η σύζευξη επιτρέπεται μόνο στο σπίτι ή στην εργασία.' }}
          right={<Toggle checked={s.pairingOnlyTrusted} onChange={(v) => update({ pairingOnlyTrusted: v })} label="Pairing μόνο σε έμπιστες τοποθεσίες" />}
        />
        <Row
          icon={Ban}
          title="Αυτόματη απόρριψη άγνωστων αιτημάτων"
          desc="Αιτήματα σύνδεσης/αρχείων από αγνώστους απορρίπτονται χωρίς ερώτηση"
          help={{ title: 'Αυτόματη απόρριψη', body: 'Όταν είναι ανενεργή, η εφαρμογή σας ρωτά για κάθε αίτημα που δεν μπλοκαρίστηκε (καλή εξάσκηση!). Όταν είναι ενεργή, απορρίπτει αυτόματα κάθε αίτημα από άγνωστη συσκευή — ο κανόνας «απορρίπτετε ό,τι δεν ξεκινήσατε εσείς» εφαρμόζεται για εσάς.' }}
          right={<Toggle checked={s.autoRejectUnknown} onChange={(v) => update({ autoRejectUnknown: v })} label="Αυτόματη απόρριψη" />}
        />
        <Row
          icon={Gauge}
          title="Ευαισθησία λειτουργίας AUTO"
          desc={s.sensitivity === 3 ? 'Υψηλή: μπλοκάρει ακόμη και χαμηλού κινδύνου απειλές' : s.sensitivity === 2 ? 'Μεσαία: μπλοκάρει μέτριες και σοβαρότερες απειλές' : 'Χαμηλή: μπλοκάρει μόνο σοβαρές απειλές — λιγότερες ενοχλήσεις'}
          help={{ title: 'Ευαισθησία', body: 'Καθορίζει από ποια σοβαρότητα και πάνω οι μονάδες σε AUTO μπλοκάρουν αυτόματα μια απειλή. Όσα είναι κάτω από το όριο εμφανίζονται ως προειδοποίηση. Οι μονάδες σε ON μπλοκάρουν πάντα τα πάντα.' }}
        >
          <Segmented<1 | 2 | 3>
            size="sm"
            value={s.sensitivity}
            onChange={(v) => update({ sensitivity: v })}
            options={[
              { value: 1, label: 'Χαμηλή' },
              { value: 2, label: 'Μεσαία' },
              { value: 3, label: 'Υψηλή' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Ειδοποιήσεις">
        <Row
          icon={Bell}
          title="Ειδοποιήσεις συστήματος"
          desc={caps.notifications ? 'Για σοβαρές απειλές, ακόμη κι όταν η εφαρμογή είναι στο παρασκήνιο' : 'Δεν υποστηρίζονται σε αυτό το περιβάλλον'}
          right={
            <Toggle
              checked={s.notifications}
              disabled={!caps.notifications}
              onChange={async (v) => {
                if (v) {
                  const ok = await requestNotificationPermission();
                  if (ok) update({ notifications: true });
                  else toast('Δεν δόθηκε άδεια για ειδοποιήσεις.', 'warning');
                } else update({ notifications: false });
              }}
              label="Ειδοποιήσεις"
            />
          }
        >
          {s.notifications && (
            <Button size="sm" variant="secondary" onClick={() => void showNotification('🛡️ BlueShield', 'Δοκιμαστική ειδοποίηση: οι ειδοποιήσεις λειτουργούν!', true)}>
              Δοκιμαστική ειδοποίηση
            </Button>
          )}
        </Row>
        <Row
          icon={Vibrate}
          title="Δόνηση"
          desc="Για απειλές, αιτήματα σύνδεσης και τον «Εντοπισμό»"
          right={
            <Toggle
              checked={s.vibration}
              onChange={(v) => {
                update({ vibration: v });
                if (v) vibrate([60, 40, 60]);
              }}
              label="Δόνηση"
            />
          }
        />
      </Section>

      <Section title="Προσομοίωση & εργαστήριο επιθέσεων">
        <Row
          icon={Sparkles}
          title="Εκπαιδευτική προσομοίωση"
          desc="Ρεαλιστικά σενάρια επιθέσεων για να βλέπετε πώς αντιδρά η προστασία"
          help={{ title: 'Προσομοίωση', body: 'Επειδή οι πραγματικές επιθέσεις είναι σπάνιες, η εφαρμογή δημιουργεί ρεαλιστικά, ακίνδυνα σενάρια (με την ετικέτα ΠΡΟΣΟΜΟΙΩΣΗ), ώστε να μαθαίνετε πώς λειτουργεί κάθε προστασία και να εξασκείστε στην απόρριψη ύποπτων αιτημάτων. Αν την κλείσετε, βλέπετε μόνο πραγματικά δεδομένα.' }}
          right={<Toggle checked={s.simulation} onChange={(v) => update({ simulation: v })} label="Προσομοίωση" />}
        >
          {s.simulation && (
            <Segmented<1 | 2 | 3>
              size="sm"
              value={s.intensity}
              onChange={(v) => update({ intensity: v })}
              options={[
                { value: 1, label: 'Ήρεμο' },
                { value: 2, label: 'Κανονικό' },
                { value: 3, label: 'Εχθρικό' },
              ]}
            />
          )}
        </Row>
        <div className="py-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-slate-200">
            <FlaskConical size={16} className="text-violet-300" /> Δοκιμάστε μια επίθεση
          </div>
          <p className="mb-3 text-[12px] leading-snug text-slate-400">
            Πατήστε μια επίθεση και δείτε αν οι τρέχουσες ρυθμίσεις σας την μπλοκάρουν. {radioOn ? '' : 'Το Bluetooth είναι κλειστό — καμία επίθεση δεν θα περάσει!'}
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

      <Section title="Δεδομένα">
        <Row icon={Download} title="Αντίγραφο ασφαλείας (JSON)" desc="Ρυθμίσεις, συσκευές και αρχείο συμβάντων" right={<Button size="sm" variant="secondary" onClick={exportAll}>Εξαγωγή</Button>} />
        <Row
          icon={RotateCcw}
          title="Επαναφορά εφαρμογής"
          desc="Επιστροφή όλων των ρυθμίσεων στις αρχικές"
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
              {confirmReset ? 'Σίγουρα;' : 'Επαναφορά'}
            </Button>
          }
        />
      </Section>

      <Section title="Δυνατότητες αυτής της συσκευής">
        {capsList.map((c) => (
          <div key={c.label} className="flex items-center gap-3 py-2.5">
            {c.ok ? <CircleCheck size={18} className="shrink-0 text-emerald-400" /> : <CircleX size={18} className="shrink-0 text-slate-500" />}
            <span className="flex-1 text-[13px] text-slate-200">{c.label}</span>
            <span className={cn('text-right text-[11.5px]', c.ok ? 'text-emerald-300' : 'text-slate-500')}>{c.note}</span>
          </div>
        ))}
      </Section>

      <Section title="Εγκατάσταση & σχετικά">
        {!caps.native && (
          <Row icon={MonitorDown} title="Εγκατάσταση στην αρχική οθόνη" desc={installable ? 'Λειτουργεί σαν κανονική εφαρμογή, και offline' : 'Chrome: μενού ⋮ → «Εγκατάσταση εφαρμογής» / «Προσθήκη στην αρχική οθόνη»'} right={installable ? <Button size="sm" onClick={() => void promptInstall()}>Εγκατάσταση</Button> : undefined} />
        )}
        <Row icon={Package} title="Έκδοση APK για Android" desc="Ο κώδικας περιέχει έτοιμο project Capacitor με native Bluetooth LE. Οδηγίες στο αρχείο ANDROID_APK.md." right={caps.native ? <LiveBadge label="APK" /> : undefined} />
        <div className="py-3">
          <div className="flex items-start gap-3">
            <IconBox icon={Info} size="sm" tone="violet" />
            <p className="flex-1 text-[12.5px] leading-relaxed text-slate-400">
              <b className="text-slate-200">BlueShield 1.0</b> — Ειλικρινά: καμία εφαρμογή χωρίς root δεν μπορεί να μπλοκάρει πακέτα μέσα στη στοίβα Bluetooth του Android ή να κλείσει μόνη της το Bluetooth (Android 13+). Το BlueShield παρακολουθεί ό,τι επιτρέπει το σύστημα (πραγματική σάρωση, trackers, κατάσταση, μπαταρία), σας καθοδηγεί και σας εκπαιδεύει με ρεαλιστικές προσομοιώσεις.
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
      <Hint>Όλα τα δεδομένα (ρυθμίσεις, συμβάντα, τοποθεσίες) αποθηκεύονται μόνο στη συσκευή σας. Η εφαρμογή δεν στέλνει τίποτα στο διαδίκτυο.</Hint>
    </div>
  );
}
