import { useEffect, useMemo, useState } from 'react';
import { ScanSearch, CircleCheck, TriangleAlert, OctagonAlert, LoaderCircle, Wrench, PartyPopper, RotateCcw } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { analyzeName, daysSince, suggestName } from '../lib/utils';
import { useScore } from '../lib/score';
import type { Screen } from '../types';
import { BottomSheet, Button, IconBox, LiveBadge } from './ui';

interface Check {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  fix?: () => void;
  fixLabel?: string;
  nav?: Screen;
  live?: boolean;
}

function useChecks(): Check[] {
  const s = useStore();
  return useMemo(() => {
    const out: Check[] = [];
    out.push(
      s.radioMode === 'on'
        ? { id: 'radio', title: 'Κατάσταση Bluetooth', status: 'warn', detail: 'Το Bluetooth είναι μόνιμα ανοιχτό. Με AUTO κλείνει μόνο του όταν δεν το χρησιμοποιείτε.', fix: () => s.setRadioMode('auto'), fixLabel: 'Ρύθμιση σε AUTO' }
        : { id: 'radio', title: 'Κατάσταση Bluetooth', status: 'pass', detail: s.radioMode === 'off' ? 'Bluetooth OFF — η πιο ασφαλής επιλογή.' : 'AUTO: κλείνει αυτόματα όταν δεν χρησιμοποιείται.', live: s.live.btEnabled !== null },
    );
    out.push(
      s.discoverable
        ? { id: 'disc', title: 'Ορατότητα (discoverable)', status: 'fail', detail: 'Το κινητό εμφανίζεται σε όλους γύρω σας — ευάλωτο σε Bluejacking.', fix: () => s.setDiscoverable(false), fixLabel: 'Απενεργοποίηση' }
        : { id: 'disc', title: 'Ορατότητα (discoverable)', status: 'pass', detail: 'Το κινητό δεν εμφανίζεται σε αγνώστους.' },
    );
    const na = analyzeName(s.deviceName);
    out.push(
      na.level === 'safe'
        ? { id: 'name', title: 'Όνομα συσκευής', status: 'pass', detail: `«${s.deviceName}» — ουδέτερο, δεν αποκαλύπτει στοιχεία.` }
        : { id: 'name', title: 'Όνομα συσκευής', status: na.level === 'danger' ? 'fail' : 'warn', detail: `«${s.deviceName}»: ${na.issues.join(' ')}`, fix: () => s.setDeviceName(suggestName()), fixLabel: 'Ουδέτερο όνομα' },
    );
    const stale = s.paired.filter((p) => daysSince(p.lastUsed) > s.settings.staleDays);
    out.push(
      stale.length
        ? { id: 'stale', title: 'Παλιές αποθηκευμένες συσκευές', status: stale.length > 1 ? 'fail' : 'warn', detail: `${stale.map((p) => p.name).join(', ')} — αχρησιμοποίητες πάνω από ${s.settings.staleDays} ημέρες (ρίσκο BIAS).`, fix: () => s.removeStale(), fixLabel: `Αφαίρεση (${stale.length})` }
        : { id: 'stale', title: 'Παλιές αποθηκευμένες συσκευές', status: 'pass', detail: 'Καμία ξεχασμένη συσκευή στη λίστα.' },
    );
    const sys = s.sysInfo;
    const checked = s.updatesCheckedAt && Date.now() - s.updatesCheckedAt < 30 * 86400000;
    const sysStatus: Check['status'] = sys?.support === 'fail' ? 'fail' : sys?.support === 'warn' || !checked ? 'warn' : 'pass';
    out.push({
      id: 'os',
      title: 'Ενημερώσεις λογισμικού',
      status: sysStatus,
      live: !!sys?.live,
      detail: `${sys ? `${sys.osName}${sys.version ? ' ' + sys.version : ''}${sys.model ? ' · ' + sys.model : ''}. ${sys.supportText}` : 'Ανάγνωση συστήματος…'}${checked ? ' Ελέγξατε για ενημερώσεις πρόσφατα ✓' : ' Δεν έχετε επιβεβαιώσει έλεγχο ενημερώσεων τις τελευταίες 30 ημέρες.'}`,
      fix: checked ? undefined : () => s.markUpdatesChecked(),
      fixLabel: 'Έλεγξα για ενημερώσεις',
    });
    out.push(
      s.modules.knob === 'off'
        ? { id: 'knob', title: 'Μήκος κλειδιών κρυπτογράφησης (KNOB)', status: 'fail', detail: 'Η προστασία KNOB είναι OFF — οι συσκευές μπορεί να συμφωνήσουν σε κλειδί 1 byte.', fix: () => { s.setModule('knob', 'on'); s.updateSettings({ minKeyBytes: 16 }); }, fixLabel: 'ON με 16 bytes' }
        : s.settings.minKeyBytes < 16
          ? { id: 'knob', title: 'Μήκος κλειδιών κρυπτογράφησης (KNOB)', status: 'warn', detail: `Ελάχιστο κλειδί: ${s.settings.minKeyBytes} bytes. Προτείνονται 16 bytes (128 bit).`, fix: () => s.updateSettings({ minKeyBytes: 16 }), fixLabel: 'Ορισμός 16 bytes' }
          : { id: 'knob', title: 'Μήκος κλειδιών κρυπτογράφησης (KNOB)', status: 'pass', detail: 'Επιβάλλεται ελάχιστο κλειδί 16 bytes.' },
    );
    const unenc = s.paired.filter((p) => !p.encrypted);
    out.push(
      unenc.length && s.modules.sniffing !== 'on'
        ? { id: 'enc', title: 'Μη κρυπτογραφημένες συνδέσεις', status: 'warn', detail: `${unenc.map((p) => p.name).join(', ')}: χωρίς κρυπτογράφηση — ευάλωτες σε sniffing.`, fix: () => s.setModule('sniffing', 'on'), fixLabel: 'Αντι-Υποκλοπή ON' }
        : { id: 'enc', title: 'Μη κρυπτογραφημένες συνδέσεις', status: 'pass', detail: unenc.length ? 'Υπάρχουν μη κρυπτογραφημένες συσκευές, αλλά η Αντι-Υποκλοπή είναι ON.' : 'Όλες οι συνδέσεις είναι κρυπτογραφημένες.' },
    );
    const off = Object.values(s.modules).filter((m) => m === 'off').length;
    out.push(
      s.master === 'off'
        ? { id: 'mods', title: 'Μονάδες προστασίας', status: 'fail', detail: 'Η κεντρική προστασία είναι OFF — καμία μονάδα δεν λειτουργεί.', fix: () => s.setMaster('on'), fixLabel: 'Ενεργοποίηση' }
        : off
          ? { id: 'mods', title: 'Μονάδες προστασίας', status: off > 2 ? 'fail' : 'warn', detail: `${off} μονάδες είναι OFF.`, fix: () => s.setAllModules('recommended'), fixLabel: 'Προτεινόμενες ρυθμίσεις' }
          : { id: 'mods', title: 'Μονάδες προστασίας', status: 'pass', detail: 'Όλες οι μονάδες είναι ενεργές (ON ή AUTO).' },
    );
    const bad = [!s.settings.pairingOnlyTrusted && 'pairing μόνο σε έμπιστες τοποθεσίες', !s.settings.autoRejectUnknown && 'αυτόματη απόρριψη άγνωστων αιτημάτων'].filter(Boolean);
    out.push(
      bad.length
        ? { id: 'prac', title: 'Καλές πρακτικές', status: 'warn', detail: `Δεν είναι ενεργά: ${bad.join(' και ')}.`, fix: () => s.updateSettings({ pairingOnlyTrusted: true, autoRejectUnknown: true }), fixLabel: 'Ενεργοποίηση' }
        : { id: 'prac', title: 'Καλές πρακτικές', status: 'pass', detail: 'Pairing μόνο σε έμπιστους χώρους και αυτόματη απόρριψη αγνώστων.' },
    );
    const danger = s.nearby.filter((d) => d.risk === 'high');
    out.push(
      danger.length
        ? { id: 'near', title: 'Ύποπτες συσκευές κοντά σας', status: 'warn', detail: `${danger.length} ύποπτ${danger.length === 1 ? 'η' : 'ες'}: ${danger.map((d) => d.name || d.label || 'άγνωστη').join(', ')}.`, nav: 'radar', fixLabel: 'Προβολή στο Ραντάρ', live: s.live.scanning }
        : { id: 'near', title: 'Ύποπτες συσκευές κοντά σας', status: 'pass', detail: s.radioOn ? 'Δεν εντοπίστηκαν ύποπτες συσκευές.' : 'Bluetooth κλειστό — δεν σας «βλέπει» κανείς.', live: s.live.scanning },
    );
    out.push(
      s.modules.dos === 'off'
        ? { id: 'dos', title: 'Προστασία DoS & μπαταρίας', status: 'warn', detail: 'Η προστασία από πλημμύρα πακέτων είναι OFF.', fix: () => s.setModule('dos', 'auto'), fixLabel: 'Ρύθμιση σε AUTO' }
        : { id: 'dos', title: 'Προστασία DoS & μπαταρίας', status: 'pass', detail: `Ενεργή. Μπαταρία: ${Math.round(s.battery.level)}%${s.battery.charging ? ' (φορτίζει)' : ''}.`, live: s.battery.source === 'live' },
    );
    return out;
  }, [s]);
}

const ICON = { pass: CircleCheck, warn: TriangleAlert, fail: OctagonAlert };
const COLOR = { pass: 'text-emerald-400', warn: 'text-amber-400', fail: 'text-rose-400' };

export function AuditSheet() {
  const open = useStore((s) => s.sheet === 'audit');
  return open ? <AuditInner /> : null;
}

function AuditInner() {
  const open = true;
  const openSheet = useStore((s) => s.openSheet);
  const go = useStore((s) => s.go);
  const toast = useStore((s) => s.toast);
  const checks = useChecks();
  const score = useScore();
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const done = step >= checks.length;

  useEffect(() => {
    if (open) setStep(0);
  }, [open, run]);
  useEffect(() => {
    if (!open || done) return;
    const t = setTimeout(() => setStep((x) => x + 1), 380);
    return () => clearTimeout(t);
  }, [open, step, done]);

  const counts = { pass: 0, warn: 0, fail: 0 };
  checks.forEach((c) => counts[c.status]++);
  const fixable = checks.filter((c) => c.status !== 'pass' && c.fix);

  return (
    <BottomSheet
      open={open}
      onClose={() => openSheet(null)}
      tall
      title="Έλεγχος ασφαλείας"
      icon={<IconBox icon={ScanSearch} size="sm" />}
      footer={
        done ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={RotateCcw} onClick={() => setRun((r) => r + 1)}>
              Ξανά
            </Button>
            {fixable.length ? (
              <Button
                variant="success"
                icon={Wrench}
                className="flex-1"
                onClick={() => {
                  fixable.forEach((c) => c.fix?.());
                  toast(`Διορθώθηκαν ${fixable.length} ζητήματα`, 'success');
                }}
              >
                Διόρθωση όλων ({fixable.length})
              </Button>
            ) : (
              <Button className="flex-1" icon={PartyPopper} onClick={() => openSheet(null)}>
                Τέλεια!
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        {!done ? (
          <div className="flex items-center gap-3">
            <LoaderCircle className="animate-spin text-sky-300" size={22} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Γίνεται έλεγχος… {Math.min(step + 1, checks.length)}/{checks.length}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-400 transition-all duration-300" style={{ width: `${(step / checks.length) * 100}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Βαθμολογία</div>
              <div className="text-3xl font-extrabold tabular-nums" style={{ color: score.color }}>
                {score.total}
                <span className="text-base font-medium text-slate-500">/100</span>
              </div>
            </div>
            <div className="flex gap-3 text-center text-xs">
              <div>
                <div className="text-lg font-bold text-emerald-400">{counts.pass}</div>OK
              </div>
              <div>
                <div className="text-lg font-bold text-amber-400">{counts.warn}</div>Προσοχή
              </div>
              <div>
                <div className="text-lg font-bold text-rose-400">{counts.fail}</div>Κίνδυνος
              </div>
            </div>
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {checks.map((c, i) => {
          const revealed = i < step;
          const current = i === step && !done;
          const I = ICON[c.status];
          return (
            <li key={c.id} className={cn('rounded-2xl border p-3 transition-all duration-300', revealed ? 'border-white/10 bg-white/[0.03]' : 'border-transparent opacity-40')}>
              <div className="flex items-start gap-2.5">
                {revealed ? <I size={19} className={cn('mt-0.5 shrink-0', COLOR[c.status])} /> : current ? <LoaderCircle size={19} className="mt-0.5 shrink-0 animate-spin text-sky-300" /> : <span className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/20" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-white">
                    {c.title} {revealed && c.live && <LiveBadge />}
                  </div>
                  {revealed && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{c.detail}</p>}
                  {revealed && c.status !== 'pass' && (c.fix || c.nav) && (
                    <Button
                      size="sm"
                      variant={c.status === 'fail' ? 'success' : 'secondary'}
                      className="mt-2"
                      icon={Wrench}
                      onClick={() => {
                        if (c.nav) {
                          openSheet(null);
                          go(c.nav);
                        } else c.fix?.();
                      }}
                    >
                      {c.fixLabel || 'Διόρθωση'}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
