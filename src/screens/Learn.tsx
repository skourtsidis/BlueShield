import { useMemo, useState } from 'react';
import { Bug, ListChecks, BookOpen, Trophy, Search, ChevronDown, Check, CircleCheck, Circle, RotateCcw, ArrowRight, Map as MapIcon, History, ChevronRight, Smartphone } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { ATTACKS, GLOSSARY, QUIZ, RULES, type RuleId } from '../data/content';
import { MODULE_COLOR, MODULE_MAP } from '../data/modules';
import { effectiveMode } from '../lib/mode';
import { analyzeName, daysSince } from '../lib/utils';
import { Button, Card, Hint, ProgressBar, SectionTitle, Segmented, SeverityBadge } from '../components/ui';
import { RingProgress, RiskScatter } from '../components/charts';

type Tab = 'threats' | 'rules' | 'glossary' | 'quiz';

function ThreatsTab() {
  const master = useStore((s) => s.master);
  const modules = useStore((s) => s.modules);
  const location = useStore((s) => s.location);
  const go = useStore((s) => s.go);
  const [sel, setSel] = useState<string | null>('blueborne');
  const [open, setOpen] = useState<string | null>(null);
  const data = ATTACKS.map((a) => ({ id: a.id, name: a.name, likelihood: a.likelihood, impact: a.impact, color: MODULE_COLOR[a.module], summary: a.summary }));
  const selA = ATTACKS.find((a) => a.id === sel);
  const modeChip = (id: keyof typeof modules) => {
    const e = effectiveMode(master, modules[id], location);
    return <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-extrabold', e === 'on' ? 'bg-emerald-400 text-emerald-950' : e === 'auto' ? 'bg-sky-400 text-sky-950' : 'bg-rose-500 text-white')}>{e.toUpperCase()}</span>;
  };
  return (
    <>
      <Card>
        <SectionTitle
          icon={MapIcon}
          title="Threat Risk Matrix"
          subtitle="Likelihood vs. real-world impact of each attack"
          help={{
            title: 'Threat Risk Matrix',
            body: 'Each dot represents a Bluetooth threat. Horizontal axis: how likely you are to encounter it in the wild. Vertical axis: how severe the damage can be. The red quadrant at top-right holds the highest-risk threats.\n\nTap any dot to inspect it.',
            more: 'Educational baseline assuming an unpatched device. On fully updated phones (Android/iOS with 2017–2021 patches applied), the likelihood of BlueBorne, KNOB, and BIAS drops dramatically.',
          }}
        />
        <RiskScatter data={data} selected={sel} onSelect={setSel} />
        {selA && (
          <div className="anim-fade mt-2 rounded-2xl bg-white/[0.04] p-3.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODULE_COLOR[selA.module] }} />
              <span className="font-semibold text-white">{selA.name}</span>
              <span className="text-[11px] text-slate-500">{selA.year}</span>
              <span className="ml-auto">{modeChip(selA.module)}</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-300">{selA.summary}</p>
            <Button size="sm" variant="ghost" className="-ml-2 mt-1" onClick={() => go('protection')}>
              Shield: {MODULE_MAP[selA.module].name} <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={History} title="Attack Timeline" subtitle="From early feature phones to today — tap to expand" />
        <ol className="relative ml-2 border-l border-white/10">
          {[...ATTACKS].sort((a, b) => a.year - b.year).map((a) => {
            const m = MODULE_MAP[a.module];
            const isOpen = open === a.id;
            return (
              <li key={a.id} className="relative pb-4 pl-5 last:pb-0">
                <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-surface" style={{ background: MODULE_COLOR[a.module] }} />
                <button type="button" onClick={() => setOpen(isOpen ? null : a.id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">{a.year}</span>
                    <span className="font-semibold text-white">{a.name}</span>
                    <SeverityBadge severity={m.severity} />
                    <ChevronDown size={15} className={cn('ml-auto text-slate-500 transition', isOpen && 'rotate-180')} />
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{a.summary}</p>
                </button>
                {isOpen && (
                  <div className="anim-fade mt-2 space-y-2 rounded-2xl bg-white/[0.04] p-3">
                    <p className="text-[12.5px] leading-relaxed text-slate-300">{m.threat}</p>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">How to stay protected</div>
                    <ul className="space-y-1">
                      {m.tips.map((t) => (
                        <li key={t} className="flex gap-2 text-[12px] text-slate-300">
                          <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                          {t}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-2 pt-1 text-[12px] text-slate-400">
                      Your current shield status: {modeChip(a.module)}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}

function RulesTab() {
  const s = useStore();
  const status: Record<RuleId, boolean> = {
    radio: s.radioMode !== 'on',
    updates: !!s.updatesCheckedAt && Date.now() - s.updatesCheckedAt < 30 * 86400000,
    pairing: s.settings.pairingOnlyTrusted,
    reject: s.settings.autoRejectUnknown,
    name: analyzeName(s.deviceName).level === 'safe',
    stale: !s.paired.some((p) => daysSince(p.lastUsed) > s.settings.staleDays),
  };
  const actions: Record<RuleId, { label: string; run: () => void }> = {
    radio: { label: 'Set Bluetooth to AUTO', run: () => s.setRadioMode('auto') },
    updates: { label: 'I checked for updates', run: () => s.markUpdatesChecked() },
    pairing: { label: 'Enable trusted-place rule', run: () => s.updateSettings({ pairingOnlyTrusted: true }) },
    reject: { label: 'Enable auto-reject', run: () => s.updateSettings({ autoRejectUnknown: true }) },
    name: { label: 'Rename device', run: () => s.openSheet('rename') },
    stale: { label: 'Remove stale devices', run: () => s.removeStale() },
  };
  const done = Object.values(status).filter(Boolean).length;
  return (
    <>
      <Card className="flex items-center gap-4 bg-gradient-to-br from-emerald-500/[0.10] to-surface/80">
        <RingProgress value={done} max={RULES.length} size={76} color={done === RULES.length ? '#34d399' : '#fbbf24'}>
          <span className="text-lg font-bold text-white">
            {done}/{RULES.length}
          </span>
        </RingProgress>
        <div className="flex-1">
          <div className="font-semibold text-white">The 6 Golden Rules</div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">
            {done === RULES.length ? 'Awesome! You are following every single Bluetooth safety rule.' : 'Modern Bluetooth (5.0+) is quite safe — provided you stick to these six everyday habits.'}
          </p>
        </div>
      </Card>
      {RULES.map((r, i) => {
        const ok = status[r.id];
        return (
          <Card key={r.id} className={cn(ok && 'border-emerald-400/20')}>
            <div className="flex items-start gap-3">
              {ok ? <CircleCheck size={22} className="mt-0.5 shrink-0 text-emerald-400" /> : <Circle size={22} className="mt-0.5 shrink-0 text-slate-500" />}
              <div className="flex-1">
                <div className="text-[11px] font-bold text-slate-500">RULE {i + 1}</div>
                <div className="font-semibold leading-snug text-white">{r.title}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{r.text}</p>
                {r.note && (
                  <div className="mt-2 flex gap-2 rounded-xl bg-white/[0.04] p-2.5 text-[12px] leading-snug text-slate-300">
                    <Smartphone size={14} className="mt-0.5 shrink-0 text-sky-300" />
                    {r.note}
                  </div>
                )}
                {!ok && (
                  <Button size="sm" className="mt-2.5" onClick={actions[r.id].run}>
                    {actions[r.id].label} <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </>
  );
}

function GlossaryTab() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const list = useMemo(() => GLOSSARY.filter((g) => norm(g.term + ' ' + g.def).includes(norm(q))), [q]);
  return (
    <>
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search terms (e.g. pairing, key, MAC)…"
          className="w-full rounded-2xl border border-white/10 bg-surface/80 py-3 pl-10 pr-4 text-[14px] text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
        />
      </div>
      <Card className="py-1">
        {list.length === 0 && <p className="py-6 text-center text-[13px] text-slate-400">No matching glossary term.</p>}
        <div className="divide-y divide-white/[0.06]">
          {list.map((g) => {
            const isOpen = open === g.term || q.length > 1;
            return (
              <button key={g.term} type="button" onClick={() => setOpen(open === g.term ? null : g.term)} className="block w-full py-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-slate-100">{g.term}</span>
                  <ChevronDown size={15} className={cn('shrink-0 text-slate-500 transition', isOpen && 'rotate-180')} />
                </div>
                {isOpen && <p className="anim-fade mt-1 text-[13px] leading-relaxed text-slate-400">{g.def}</p>}
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function QuizTab() {
  const quizBest = useStore((s) => s.quizBest);
  const setQuizBest = useStore((s) => s.setQuizBest);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = QUIZ[idx];
  const restart = () => {
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  };
  if (done) {
    const pct = score / QUIZ.length;
    return (
      <Card className="flex flex-col items-center py-8 text-center">
        <div className={cn('flex h-20 w-20 items-center justify-center rounded-full', pct >= 0.8 ? 'bg-amber-400/20 text-amber-300' : 'bg-sky-500/15 text-sky-300')}>
          <Trophy size={40} />
        </div>
        <div className="mt-4 text-3xl font-extrabold text-white">
          {score}/{QUIZ.length}
        </div>
        <p className="mt-2 max-w-[260px] text-[14px] leading-relaxed text-slate-300">
          {pct === 1 ? 'Perfect score! You are a certified Bluetooth security pro! 🏆' : pct >= 0.7 ? 'Great job! You know the essentials to keep your phone safe.' : 'Nice start! Review the "Threats" and "Rules" tabs and give it another shot.'}
        </p>
        {quizBest !== null && <p className="mt-2 text-[12px] text-slate-500">Best score: {quizBest}/{QUIZ.length}</p>}
        <Button className="mt-5" icon={RotateCcw} onClick={restart}>
          Play again
        </Button>
      </Card>
    );
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-[12px] text-slate-400">
        <span>
          Question {idx + 1} of {QUIZ.length}
        </span>
        <span>Score: {score}</span>
      </div>
      <ProgressBar value={idx + (picked !== null ? 1 : 0)} max={QUIZ.length} />
      <h3 className="mt-4 text-[16px] font-semibold leading-snug text-white">{q.q}</h3>
      <div className="mt-4 space-y-2">
        {q.options.map((o, i) => {
          const state = picked === null ? 'idle' : i === q.correct ? 'correct' : i === picked ? 'wrong' : 'dim';
          return (
            <button
              key={o}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                setPicked(i);
                if (i === q.correct) setScore((s) => s + 1);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] transition',
                state === 'idle' && 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]',
                state === 'correct' && 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100',
                state === 'wrong' && 'border-rose-400/50 bg-rose-500/15 text-rose-100',
                state === 'dim' && 'border-white/5 text-slate-500',
              )}
            >
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold', state === 'correct' ? 'bg-emerald-400 text-emerald-950' : state === 'wrong' ? 'bg-rose-500 text-white' : 'bg-white/10')}>
                {String.fromCharCode(65 + i)}
              </span>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="anim-fade mt-4">
          <div className={cn('rounded-2xl p-3.5 text-[13px] leading-relaxed', picked === q.correct ? 'bg-emerald-500/10 text-emerald-100' : 'bg-rose-500/10 text-rose-100')}>
            <b>{picked === q.correct ? 'Correct! ' : 'Not quite. '}</b>
            {q.explain}
          </div>
          <Button
            className="mt-3 w-full"
            onClick={() => {
              if (idx + 1 >= QUIZ.length) {
                setDone(true);
                setQuizBest(score);
              } else {
                setIdx(idx + 1);
                setPicked(null);
              }
            }}
          >
            {idx + 1 >= QUIZ.length ? 'See results' : 'Next question'} <ArrowRight size={15} />
          </Button>
        </div>
      )}
    </Card>
  );
}

export function Learn() {
  const [tab, setTab] = useState<Tab>('threats');
  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'threats', label: 'Threats', icon: Bug },
          { value: 'rules', label: 'Rules', icon: ListChecks },
          { value: 'glossary', label: 'Glossary', icon: BookOpen },
          { value: 'quiz', label: 'Quiz', icon: Trophy },
        ]}
      />
      {tab === 'threats' && (
        <Hint>Explore every major Bluetooth security threat explained in plain English. Tap any dot on the risk matrix or any item in the timeline.</Hint>
      )}
      {tab === 'threats' && <ThreatsTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'glossary' && <GlossaryTab />}
      {tab === 'quiz' && <QuizTab />}
    </div>
  );
}
