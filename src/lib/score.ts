import { useMemo } from 'react';
import { MODULES } from '../data/modules';
import { useStore, type State } from '../store/useStore';
import { analyzeName, clamp, daysSince } from './utils';
import { effectiveMode } from './mode';

export interface ScoreItem {
  label: string;
  points: number;
  max: number;
}
export interface ScorePart {
  key: 'protection' | 'hygiene' | 'practices';
  label: string;
  value: number;
  max: number;
  items: ScoreItem[];
}
export interface ScoreResult {
  total: number;
  parts: ScorePart[];
  penalty: number;
  level: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
  color: string;
  coverage: number;
  stale: number;
}

type ScoreInput = Pick<
  State,
  'master' | 'modules' | 'location' | 'radioMode' | 'discoverable' | 'deviceName' | 'paired' | 'settings' | 'updatesCheckedAt' | 'events'
>;

export function computeScore(s: ScoreInput, now = Date.now()): ScoreResult {
  const totalW = MODULES.reduce((a, m) => a + m.weight, 0);
  const coverage =
    MODULES.reduce((a, m) => {
      const e = effectiveMode(s.master, s.modules[m.id], s.location);
      return a + m.weight * (e === 'on' ? 1 : e === 'auto' ? 0.9 : 0);
    }, 0) / totalW;
  const masterPts = s.master === 'off' ? 0 : 10;
  const modulePts = s.master === 'off' ? 0 : 40 * coverage;

  const radio = s.radioMode === 'off' ? 12 : s.radioMode === 'auto' ? 10 : 4;
  const disc = s.discoverable ? 0 : 6;
  const nameLvl = analyzeName(s.deviceName).level;
  const name = nameLvl === 'safe' ? 6 : nameLvl === 'medium' ? 3 : 0;
  const stale = s.paired.filter((p) => daysSince(p.lastUsed, now) > s.settings.staleDays).length;
  const staleScore = Math.max(0, 6 - stale * 2);

  const updates = s.updatesCheckedAt && now - s.updatesCheckedAt < 30 * 86400000 ? 8 : 0;
  const pairing = s.settings.pairingOnlyTrusted ? 6 : 0;
  const reject = s.settings.autoRejectUnknown ? 6 : 0;

  const recent = s.events.filter((e) => now - e.time < 10 * 60000);
  const penalty = Math.min(
    20,
    recent.filter((e) => e.action === 'allowed' && e.severity !== 'info').length * 4 + recent.filter((e) => e.action === 'user-allowed').length * 6,
  );

  const parts: ScorePart[] = [
    {
      key: 'protection',
      label: 'Μονάδες προστασίας',
      value: masterPts + modulePts,
      max: 50,
      items: [
        { label: 'Κεντρική προστασία ενεργή (ON ή AUTO)', points: masterPts, max: 10 },
        { label: `Κάλυψη μονάδων προστασίας: ${Math.round(coverage * 100)}%`, points: modulePts, max: 40 },
      ],
    },
    {
      key: 'hygiene',
      label: 'Υγιεινή Bluetooth',
      value: radio + disc + name + staleScore,
      max: 30,
      items: [
        { label: 'Bluetooth σε AUTO ή OFF (όχι μόνιμα ανοιχτό)', points: radio, max: 12 },
        { label: 'Ορατότητα (discoverable) κλειστή', points: disc, max: 6 },
        { label: 'Ουδέτερο όνομα συσκευής', points: name, max: 6 },
        { label: stale ? `Παλιές αποθηκευμένες συσκευές: ${stale}` : 'Χωρίς παλιές αποθηκευμένες συσκευές', points: staleScore, max: 6 },
      ],
    },
    {
      key: 'practices',
      label: 'Καλές πρακτικές',
      value: updates + pairing + reject,
      max: 20,
      items: [
        { label: 'Έλεγχος ενημερώσεων τις τελευταίες 30 ημέρες', points: updates, max: 8 },
        { label: 'Pairing μόνο σε έμπιστες τοποθεσίες', points: pairing, max: 6 },
        { label: 'Αυτόματη απόρριψη άγνωστων αιτημάτων', points: reject, max: 6 },
      ],
    },
  ];
  const raw = parts.reduce((a, p) => a + p.value, 0);
  const total = Math.round(clamp(raw - penalty, 0, 100));
  const level = total >= 85 ? 'Εξαιρετική' : total >= 70 ? 'Καλή' : total >= 50 ? 'Μέτρια' : 'Κίνδυνος';
  const tone = total >= 85 ? 'success' : total >= 70 ? 'info' : total >= 50 ? 'warning' : 'danger';
  const color = total >= 85 ? '#34d399' : total >= 70 ? '#38bdf8' : total >= 50 ? '#fbbf24' : '#fb7185';
  return { total, parts, penalty, level, tone, color, coverage, stale };
}

export function useScore() {
  const master = useStore((s) => s.master);
  const modules = useStore((s) => s.modules);
  const location = useStore((s) => s.location);
  const radioMode = useStore((s) => s.radioMode);
  const discoverable = useStore((s) => s.discoverable);
  const deviceName = useStore((s) => s.deviceName);
  const paired = useStore((s) => s.paired);
  const settings = useStore((s) => s.settings);
  const updatesCheckedAt = useStore((s) => s.updatesCheckedAt);
  const events = useStore((s) => s.events);
  return useMemo(
    () => computeScore({ master, modules, location, radioMode, discoverable, deviceName, paired, settings, updatesCheckedAt, events }),
    [master, modules, location, radioMode, discoverable, deviceName, paired, settings, updatesCheckedAt, events],
  );
}
