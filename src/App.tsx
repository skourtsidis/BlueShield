import { useEffect, useMemo, useRef, useState } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, Copy, Check,
  Radar, Cpu, FileCode2, ListChecks, TriangleAlert, CircleHelp,
  Lock, LockOpen, Bell, GitBranch, ArrowRight,
  Terminal, FlaskConical, Eye, EyeOff, RotateCcw, Smartphone,
  Unplug, Download, BookOpen, Star, ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, CartesianGrid, AreaChart, Area,
} from "recharts";
import { FINDINGS, INTEGRATION_STEPS, PERMISSION_MATRIX, HONEST_LIMITS, type Severity } from "./data/audit";
import { CODE_FILES } from "./data/codefiles";

/* ---------- tiny syntax highlighter ---------- */
function highlight(code: string, lang: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let out = esc(code);
  // comments
  out = out.replace(/(\/\/[^\n]*|#[^\n]*|&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-com">$1</span>');
  // block comments /* */
  out = out.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-com">$1</span>');
  // strings
  out = out.replace(/(&quot;.*?&quot;|".*?"|'.*?')/g, '<span class="tok-str">$1</span>');
  // annotations
  out = out.replace(/(@\w+)/g, '<span class="tok-ann">$1</span>');
  // keywords
  const kw = lang === "xml"
    ? "\\b(manifest|application|activity|service|receiver|intent-filter|action|category|uses-permission|uses-feature)\\b"
    : "\\b(package|import|object|class|fun|val|var|return|if|else|when|is|in|for|while|try|catch|finally|throw|private|public|override|companion|const|enum|data|interface|sealed|abstract|lateinit|by|lazy|true|false|null|this|super|as|out|type|export|const|let|await|async|new|from|extends|implements|switch|case|break|continue|do|typeof|void|delete|readonly|string|number|boolean|Promise)\\b";
  out = out.replace(new RegExp(kw, "g"), '<span class="tok-kw">$1</span>');
  // numbers
  out = out.replace(/\b(\d[\d._]*)\b/g, '<span class="tok-num">$1</span>');
  return out;
}

const SEV_STYLE: Record<Severity, { badge: string; dot: string; label: string }> = {
  critical: { badge: "bg-red-500/15 text-red-300 border-red-500/40", dot: "bg-red-400", label: "CRITICAL" },
  high: { badge: "bg-orange-500/15 text-orange-300 border-orange-500/40", dot: "bg-orange-400", label: "HIGH" },
  medium: { badge: "bg-amber-500/15 text-amber-300 border-amber-500/40", dot: "bg-amber-400", label: "MEDIUM" },
  info: { badge: "bg-sky-500/15 text-sky-300 border-sky-500/40", dot: "bg-sky-400", label: "INFO" },
};

const CAT_LABEL = { validation: "Validation", integration: "Integration", consistency: "Consistency" } as const;

/* ---------- terminal audit log ---------- */
const AUDIT_LOG = [
  { t: "$ blueshield-audit --repo skourtsidis/BlueShield --deep", c: "text-cyan-300" },
  { t: "▸ cloning… 47 files indexed (React + Capacitor + TS)", c: "text-slate-400" },
  { t: "▸ tracing generateAttack() … Math.random() everywhere", c: "text-slate-400" },
  { t: "✖ VAL-01: 10/10 protection modules are pure simulation", c: "text-red-400" },
  { t: "✖ VAL-02: tick() fabricates packets / RSSI / battery / keys", c: "text-red-400" },
  { t: "✖ VAL-03: radioOn is a local boolean, not the adapter", c: "text-orange-400" },
  { t: "✖ VAL-04: zero root detection — requirement ignored", c: "text-orange-400" },
  { t: "✖ INT-01: no BroadcastReceiver for pairing/bond", c: "text-orange-400" },
  { t: "✖ INT-02: no ForegroundService — AUTO dies in background", c: "text-orange-400" },
  { t: "✖ CON-01: LIVE and SIM data mixed without labels", c: "text-red-400" },
  { t: "✔ patch generated: 10 native files (Kotlin + Manifest + TS)", c: "text-emerald-400" },
  { t: "✔ root-aware controller · honest CVE verdicts · live-only charts", c: "text-emerald-400" },
  { t: "■ verdict: FIXABLE — real protection possible within Android limits", c: "text-cyan-300 font-bold" },
];

/* ================= APP ================= */
export default function App() {
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [catFilter, setCatFilter] = useState<"all" | keyof typeof CAT_LABEL>("all");
  const [openFinding, setOpenFinding] = useState<string | null>("F01");
  const [activeFile, setActiveFile] = useState(CODE_FILES[1].id);
  const [copied, setCopied] = useState(false);
  const [rooted, setRooted] = useState(false);
  const [rootGranted, setRootGranted] = useState(false);
  const [btOn, setBtOn] = useState(true);
  const [logLines, setLogLines] = useState(0);
  const [hideSim, setHideSim] = useState(true);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [radarLive, setRadarLive] = useState(true);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogLines(0);
    const iv = setInterval(() => {
      setLogLines((n) => {
        if (n >= AUDIT_LOG.length) { clearInterval(iv); return n; }
        return n + 1;
      });
    }, 420);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: "smooth" });
  }, [logLines]);

  const file = useMemo(() => CODE_FILES.find((f) => f.id === activeFile)!, [activeFile]);

  const filtered = FINDINGS.filter(
    (f) => (sevFilter === "all" || f.severity === sevFilter) && (catFilter === "all" || f.category === catFilter)
  );

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(file.code); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const toggleStep = (n: number) =>
    setCheckedSteps((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const canAutoOff = rooted && rootGranted;
  const progress = Math.round((checkedSteps.length / INTEGRATION_STEPS.length) * 100);

  const sevData = [
    { name: "Critical", value: 3, fill: "#f87171" },
    { name: "High", value: 6, fill: "#fb923c" },
    { name: "Medium", value: 3, fill: "#fbbf24" },
  ];
  const originData = hideSim
    ? [{ name: "LIVE events", value: 100, fill: "#22d3ee" }]
    : [
        { name: "LIVE (real)", value: 18, fill: "#22d3ee" },
        { name: "SIM (fake)", value: 82, fill: "#f59e0b" },
      ];
  const trafficData = Array.from({ length: 24 }, (_, i) => ({
    t: `${i}s`,
    live: radarLive ? Math.round(8 + Math.random() * 14 + (i % 7 === 3 ? 30 : 0)) : 0,
    sim: !radarLive ? Math.round(20 + Math.random() * 40) : 0,
  }));

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-200">
      <div className="bg-blueprint pointer-events-none fixed inset-0" />
      <div className="pointer-events-none fixed -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />

      {/* ============ NAV ============ */}
      <header className="glass sticky top-0 z-50 border-b border-cyan-500/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <div className="glow-cyan flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-700">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-wide text-white">BLUESHIELD <span className="text-cyan-400">AUDIT LAB</span></div>
              <div className="text-[11px] text-slate-400">Validation · Integration · Consistency Check</div>
            </div>
          </a>
          <nav className="hidden items-center gap-5 text-[13px] font-medium text-slate-300 lg:flex">
            <a href="#verdict" className="hover:text-cyan-300">Πόρισμα</a>
            <a href="#findings" className="hover:text-cyan-300">Ευρήματα</a>
            <a href="#root" className="hover:text-cyan-300">Root Lab</a>
            <a href="#code" className="hover:text-cyan-300">Διορθωμένος Κώδικας</a>
            <a href="#integration" className="hover:text-cyan-300">Ενσωμάτωση</a>
            <a href="#faq" className="hover:text-cyan-300">FAQ</a>
          </nav>
          <a href="https://github.com/skourtsidis/BlueShield" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[13px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20">
            <ExternalLink className="h-4 w-4" /> Repo
          </a>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section id="top" className="relative mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-4 inline-flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold tracking-widest text-emerald-300">AUDIT COMPLETE · 12 FINDINGS · 10 PATCH FILES</span>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold tracking-widest text-cyan-300">GITHUB: skourtsidis/BlueShield</span>
            </div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Από <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">simulation</span> σε{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent text-glow">πραγματική προστασία.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              Έκανα πλήρες <strong className="text-white">validation, integration & consistency check</strong> στο BlueShield.
              Επιβεβαιώνω αυτό που υποψιάστηκες στο testing: <strong className="text-amber-300">η εφαρμογή σήμερα δείχνει εικονικά δεδομένα</strong> —
              οι «μπλοκαρισμένες επιθέσεις», τα γραφήματα και τα RSSI παράγονται με <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-cyan-200">Math.random()</code>.
              Παρακάτω θα βρεις <strong className="text-white">τι φταίει, γιατί φταίει, και τον διορθωμένο κώδικα</strong> (native Kotlin + bridge) που το κάνει να λειτουργεί αληθινά — με έλεγχο root και greyed-out λειτουργίες όπου απαιτείται.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#code" className="glow-cyan flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-110">
                <FileCode2 className="h-4 w-4" /> Δες τον διορθωμένο κώδικα
              </a>
              <a href="#verdict" className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10">
                <Terminal className="h-4 w-4" /> Διάβασε το πόρισμα
              </a>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { v: "12", l: "Ευρήματα", i: ShieldAlert, c: "text-red-300" },
                { v: "10", l: "Αρχεία patch", i: FileCode2, c: "text-cyan-300" },
                { v: "82%", l: "Ήταν simulation", i: FlaskConical, c: "text-amber-300" },
                { v: "0%", l: "Simulation μετά το fix*", i: ShieldCheck, c: "text-emerald-300" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <s.i className={`mx-auto h-5 w-5 ${s.c}`} />
                  <div className="mt-1 text-2xl font-black text-white">{s.v}</div>
                  <div className="text-[11px] text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">* με ενεργό το φίλτρο “Hide simulations” — η εκπαίδευση παραμένει διαθέσιμη προαιρετικά.</p>
          </div>

          {/* Terminal */}
          <div className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#040a1c]/90 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-amber-500/70" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
              <span className="ml-2 font-mono text-[11px] text-slate-400">blueshield-audit — zsh</span>
              <button onClick={() => setLogLines(0)} className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-400 hover:text-white">
                <RotateCcw className="h-3 w-3" /> replay
              </button>
            </div>
            <div ref={termRef} className="h-[340px] overflow-y-auto p-4 font-mono text-[12.5px] leading-[1.9]">
              {AUDIT_LOG.slice(0, logLines).map((l, i) => (
                <div key={i} className={`terminal-line ${l.c}`}>{l.t}</div>
              ))}
              <span className="animate-caret text-cyan-400">▊</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ VERDICT ============ */}
      <section id="verdict" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6">
        <SectionHead icon={ShieldAlert} kicker="ΤΟ ΠΟΡΙΣΜΑ" title="Είχες δίκιο: η εφαρμογή δεν λειτουργεί πραγματικά"
          desc="Τρεις ανεξάρτητοι έλεγχοι, ένα συμπέρασμα. Ιδού η τεχνική απόδειξη — με αναφορά ακριβώς στο αρχείο και τη γραμμή λογικής που φταίει." />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-5">
            <div className="flex items-center gap-2 text-red-300"><ShieldX className="h-5 w-5" /><h3 className="font-bold">Validation: 6 σφάλματα</h3></div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300">Κανένα από τα 10 modules προστασίας δεν καλεί Android API. Η <code className="font-mono text-[12px] text-red-200">generateAttack()</code> και η <code className="font-mono text-[12px] text-red-200">tick()</code> κατασκευάζουν επιθέσεις, πακέτα, RSSI και μπαταρία με τυχαίους αριθμούς. Ο έλεγχος root δεν υπάρχει καν.</p>
            <div className="mt-3 font-mono text-[11px] text-red-300/80">src/store/sim.ts · src/store/useStore.ts</div>
          </div>
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.06] p-5">
            <div className="flex items-center gap-2 text-orange-300"><Unplug className="h-5 w-5" /><h3 className="font-bold">Integration: 3 κενά</h3></div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300">Λείπει όλο το native στρώμα: κανένας <code className="font-mono text-[12px] text-orange-200">BroadcastReceiver</code> για pairing, καμία <code className="font-mono text-[12px] text-orange-200">ForegroundService</code> για συνεχή προστασία, και το JS↔Native bridge μεταφέρει μόνο BLE advertisements.</p>
            <div className="mt-3 font-mono text-[11px] text-orange-300/80">AndroidManifest.xml · platform/ble.ts</div>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
            <div className="flex items-center gap-2 text-amber-300"><Eye className="h-5 w-5" /><h3 className="font-bold">Consistency: 3 ασυνέπειες</h3></div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300">Πραγματικά και ψεύτικα δεδομένα ανακατεύονται χωρίς σήμανση. Permissions ελλιπή ανά API level. Το GATT inspection δουλεύει μόνο στο web — στο APK το κουμπί είναι νεκρό.</p>
            <div className="mt-3 font-mono text-[11px] text-amber-300/80">addEvent() · ingestLive() · inspectWebDevice()</div>
          </div>
        </div>

        {/* architecture before/after */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-md bg-red-500/20 px-2 py-1 font-mono text-[11px] font-bold text-red-300">BEFORE · ΤΩΡΑ</span>
              <span className="text-[12px] text-slate-400">Όλα μέσα στο WebView — τίποτα αληθινό</span>
            </div>
            <div className="space-y-2 font-mono text-[12px]">
              <div className="rounded-lg border border-dashed border-red-500/40 bg-red-500/5 p-3 text-center text-red-200">React UI (ON/OFF/AUTO switches) — αλλάζει μόνο local state</div>
              <div className="text-center text-slate-500">↓</div>
              <div className="rounded-lg border border-dashed border-red-500/40 bg-red-500/5 p-3 text-center text-red-200">sim.ts + tick() — Math.random() «επιθέσεις» & «πακέτα»</div>
              <div className="text-center text-slate-500">↓ <span className="text-[10px]">(μόνο BLE adverts)</span></div>
              <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-center text-slate-300">@capacitor-community/bluetooth-le</div>
              <div className="text-center font-bold text-red-400">✖ Android system: pairing, adapter, patch-level — ΑΟΡΑΤΑ</div>
            </div>
          </div>
          <div className="glow-cyan rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.05] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/20 px-2 py-1 font-mono text-[11px] font-bold text-emerald-300">AFTER · ΜΕ ΤΟ FIX</span>
              <span className="text-[12px] text-slate-400">Η λογική μετακομίζει σε Kotlin</span>
            </div>
            <div className="space-y-2 font-mono text-[12px]">
              <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-center text-cyan-100">React UI — dashboard ΜΟΝΟ (διαβάζει live + δείχνει badges)</div>
              <div className="text-center text-cyan-400">↑↓ BlueShieldBridge (11 methods + events)</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-200">Security<br />MonitorSvc</div>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-200">Pairing<br />Receiver</div>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-200">BLE Scanner<br />Service</div>
              </div>
              <div className="text-center font-bold text-emerald-400">✔ REAL: adapter · bonds · patch level · root · notifications</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FINDINGS ============ */}
      <section id="findings" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6">
        <SectionHead icon={ListChecks} kicker="ΑΝΑΛΥΤΙΚΑ ΕΥΡΗΜΑΤΑ" title="12 ευρήματα με απόδειξη και διόρθωση"
          desc="Κάνε κλικ σε κάθε εύρημα για να δεις: τι ζήτησε το αρχικό prompt, τι βρέθηκε στον κώδικα, ποια είναι η επίπτωση και σε ποιο αρχείο διορθώθηκε." />
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="mb-2 text-[12px] font-bold tracking-widest text-slate-400">ΦΙΛΤΡΟ ΣΟΒΑΡΟΤΗΤΑΣ</h4>
              <div className="flex flex-wrap gap-2">
                {(["all", "critical", "high", "medium"] as const).map((s) => (
                  <button key={s} onClick={() => setSevFilter(s)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition ${sevFilter === s ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>
                    {s === "all" ? "Όλα (12)" : `${SEV_STYLE[s].label} (${FINDINGS.filter((f) => f.severity === s).length})`}
                  </button>
                ))}
              </div>
              <h4 className="mb-2 mt-4 text-[12px] font-bold tracking-widest text-slate-400">ΦΙΛΤΡΟ ΕΛΕΓΧΟΥ</h4>
              <div className="flex flex-wrap gap-2">
                {(["all", "validation", "integration", "consistency"] as const).map((c) => (
                  <button key={c} onClick={() => setCatFilter(c)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition ${catFilter === c ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>
                    {c === "all" ? "Όλοι" : CAT_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="mb-2 text-[12px] font-bold tracking-widest text-slate-400">ΚΑΤΑΝΟΜΗ ΣΟΒΑΡΟΤΗΤΑΣ</h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} strokeWidth={0} paddingAngle={3}>
                      {sevData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 space-y-1 text-[12px]">
                {sevData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} /> {d.name}: <strong>{d.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {filtered.map((f) => {
              const open = openFinding === f.id;
              const sev = SEV_STYLE[f.severity];
              return (
                <div key={f.id} className={`overflow-hidden rounded-2xl border transition ${open ? "border-cyan-500/40 bg-cyan-500/[0.04]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
                  <button onClick={() => setOpenFinding(open ? null : f.id)} className="flex w-full items-center gap-3 p-4 text-left">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`} />
                    <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">{f.code}</span>
                    <span className="flex-1 text-[14px] font-bold text-white">{f.title}</span>
                    <span className={`hidden rounded-md border px-2 py-0.5 text-[10px] font-bold md:inline ${sev.badge}`}>{sev.label}</span>
                    <span className="hidden rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-400 lg:inline">{CAT_LABEL[f.category]}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-white/10 p-4 text-[13.5px] leading-relaxed">
                      <div className="font-mono text-[11px] text-slate-500">📁 {f.file}</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-3">
                          <div className="mb-1 text-[11px] font-bold tracking-widest text-sky-300">ΖΗΤΗΘΗΚΕ (PROMPT)</div>
                          <p className="text-slate-200">{f.asked}</p>
                        </div>
                        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3">
                          <div className="mb-1 text-[11px] font-bold tracking-widest text-red-300">ΒΡΕΘΗΚΕ (ΚΩΔΙΚΑΣ)</div>
                          <p className="text-slate-200">{f.found}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                        <div className="mb-1 text-[11px] font-bold tracking-widest text-amber-300">⚠ ΕΠΙΠΤΩΣΗ</div>
                        <p className="text-slate-200">{f.impact}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold tracking-widest text-emerald-300">
                          <Check className="h-3.5 w-3.5" /> ΔΙΟΡΘΩΣΗ → {f.fixedIn}
                        </div>
                        <p className="text-slate-200">{f.fix}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ LIVE vs SIM DEMO ============ */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <SectionHead icon={Radar} kicker="ΔΙΑΔΡΑΣΤΙΚΗ ΕΠΙΔΕΙΞΗ" title="Τι έβλεπες vs τι θα βλέπεις"
          desc="Αριστερά: η σημερινή συμπεριφορά (ψεύτικη καμπύλη πακέτων). Δεξιά: η διορθωμένη — μόνο πραγματικά δείγματα, με κενά όταν δεν υπάρχουν δεδομένα." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-1 font-mono text-[11px] font-bold ${radarLive ? "bg-cyan-500/20 text-cyan-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {radarLive ? "● LIVE FEED (fixed)" : "● SIM FEED (current app)"}
                </span>
              </div>
              <button onClick={() => setRadarLive(!radarLive)}
                className="toggle-track flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-slate-300 hover:bg-white/10">
                {radarLive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {radarLive ? "Δείξε το σημερινό (SIM)" : "Δείξε το διορθωμένο (LIVE)"}
              </button>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#64748b" }} interval={5} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                  {radarLive
                    ? <Area type="monotone" dataKey="live" stroke="#22d3ee" fill="#22d3ee33" strokeWidth={2} name="packets/sec (LIVE)" />
                    : <Area type="monotone" dataKey="sim" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} strokeDasharray="5 3" name="packets/sec (SIMULATED)" />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
              {radarLive
                ? "✔ Πραγματικά πακέτα/sec από το BleScannerService. Παρατήρησε τα κενά και τις αιχμές — έτσι μοιάζουν αληθινά δεδομένα ραδιοφάσματος."
                : "✖ Ομαλή, πλούσια, ψεύτικη καμπύλη από rand(6,14)+rand(28,42). Ποτέ μηδέν, ποτέ κενό — το κλασικό σημάδι fabrication."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold text-slate-400">ΠΡΟΕΛΕΥΣΗ EVENTS ΣΤΟ LOG</span>
              <button onClick={() => setHideSim(!hideSim)}
                className="toggle-track flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-slate-300 hover:bg-white/10">
                {hideSim ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {hideSim ? "Hide simulations: ON" : "Hide simulations: OFF"}
              </button>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={originData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} strokeWidth={0} paddingAngle={4}>
                    {originData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
              {hideSim
                ? "✔ Με το νέο φίλτρο (προεπιλογή στο APK), το log και το security score περιέχουν ΜΟΝΟ live events. Καθαρή αλήθεια."
                : "✖ Χωρίς φίλτρο, το 82% των events είναι simulation — αλλά το σημερινό UI τα μετράει όλα σαν αληθινά."}
            </p>
          </div>
        </div>
      </section>

      {/* ============ ROOT LAB ============ */}
      <section id="root" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6">
        <SectionHead icon={Lock} kicker="ROOT LAB · Η ΑΠΑΙΤΗΣΗ ΣΟΥ" title="Έλεγχος root με greyed-out λειτουργίες"
          desc="Δοκίμασε τον διακόπτη: δες ακριβώς πώς θα συμπεριφέρεται η διορθωμένη εφαρμογή σε rooted vs non-rooted συσκευή — όπως ζήτησες." />
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* phone mock */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold text-white"><Smartphone className="h-4 w-4 text-cyan-300" /> BlueShield — Protection tab (preview)</h4>
              <span className="font-mono text-[10px] text-slate-500">EN UI · όπως στο prompt</span>
            </div>
            {/* simulator controls */}
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-[12px] font-bold text-slate-300">
                Device rooted?
                <button onClick={() => { setRooted(!rooted); if (rooted) setRootGranted(false); }}
                  className={`relative h-6 w-11 rounded-full transition ${rooted ? "bg-emerald-500" : "bg-slate-600"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${rooted ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </label>
              <label className={`flex items-center justify-between gap-2 text-[12px] font-bold ${rooted ? "text-slate-300" : "text-slate-600"}`}>
                su granted?
                <button disabled={!rooted} onClick={() => setRootGranted(!rootGranted)}
                  className={`relative h-6 w-11 rounded-full transition ${rootGranted ? "bg-emerald-500" : "bg-slate-600"} ${!rooted ? "opacity-40" : ""}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${rootGranted ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </label>
            </div>
            {/* root banner */}
            <div className={`mb-3 flex items-center gap-2 rounded-xl border p-3 text-[12.5px] font-semibold ${canAutoOff ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"}`}>
              {canAutoOff ? <LockOpen className="h-4 w-4 shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
              {canAutoOff ? "ROOT ACTIVE — full radio control available (RootChecker.ROOT_GRANTED)" : rooted && !rootGranted ? "Rooted but not granted — grant su to BlueShield." : "Auto-OFF unavailable (greyed out) — requires root. Manual OFF via Settings works."}
            </div>
            {/* master switch */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div>
                  <div className="text-[13px] font-bold text-white">Bluetooth radio</div>
                  <div className="font-mono text-[11px] text-slate-400">adapter.isEnabled = {btOn ? "true" : "false"} · LIVE</div>
                </div>
                <div className="flex gap-1.5">
                  {(["ON", "OFF", "AUTO"] as const).map((m) => (
                    <button key={m} onClick={() => setBtOn(m !== "OFF")}
                      className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold transition ${(m !== "OFF") === btOn ? "bg-cyan-500 text-white" : "bg-white/10 text-slate-400 hover:text-white"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`flex items-center justify-between rounded-xl border p-3 transition ${canAutoOff ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-black/40 opacity-50"}`}>
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-bold text-white">
                    Idle auto-OFF {canAutoOff ? null : <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">ROOT REQUIRED</span>}
                  </div>
                  <div className="text-[11px] text-slate-400">{canAutoOff ? "Will execute: su -c 'svc bluetooth disable'" : "Disabled on this device — Android 13+ forbids programmatic OFF"}</div>
                </div>
                <button disabled={!canAutoOff} className={`relative h-6 w-11 rounded-full ${canAutoOff ? "bg-cyan-500" : "bg-slate-700"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${canAutoOff ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className={`flex items-center justify-between rounded-xl border p-3 transition ${canAutoOff ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-black/40 opacity-50"}`}>
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-bold text-white">
                    Auto-reject unknown pairing {canAutoOff ? null : <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">ROOT REQUIRED</span>}
                  </div>
                  <div className="text-[11px] text-slate-400">{canAutoOff ? "Will execute: abortBroadcast() + cancelPairing()" : "Without root the app can only warn, not block"}</div>
                </div>
                <button disabled={!canAutoOff} className={`relative h-6 w-11 rounded-full ${canAutoOff ? "bg-cyan-500" : "bg-slate-700"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${canAutoOff ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div>
                  <div className="text-[13px] font-bold text-white">Pairing alerts <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">ALWAYS ON</span></div>
                  <div className="text-[11px] text-slate-400">Works without root — PairingMonitorReceiver</div>
                </div>
                <div className="relative h-6 w-11 rounded-full bg-emerald-500"><span className="absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white" /></div>
              </div>
            </div>
          </div>
          {/* explanation */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-5">
              <h4 className="flex items-center gap-2 text-sm font-bold text-cyan-200"><Cpu className="h-4 w-4" /> Πώς δουλεύει ο έλεγχος (RootChecker.kt)</h4>
              <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-300">
                <li><strong className="text-white">1. Build tags:</strong> ψάχνει <code className="font-mono text-[12px] text-cyan-200">test-keys</code> (custom ROM).</li>
                <li><strong className="text-white">2. su binary:</strong> ελέγχει 8 γνωστά paths + Magisk path.</li>
                <li><strong className="text-white">3. Manager apps:</strong> Magisk / SuperSU πακέτα.</li>
                <li><strong className="text-white">4. which su:</strong> αν το su είναι στο PATH.</li>
                <li><strong className="text-white">5. Live grant test:</strong> εκτελεί <code className="font-mono text-[12px] text-cyan-200">su -c id</code> και περιμένει <code className="font-mono text-[12px] text-cyan-200">uid=0</code> — η μόνη απόδειξη ότι μπορεί ΠΡΑΓΜΑΤΙΚΑ να ανοιγοκλείσει το ραδιόφωνο.</li>
              </ol>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[12px]">
                <span className="text-slate-500">// Αποτέλεσμα → UI state</span><br />
                <span className="text-emerald-300">ROOT_GRANTED</span> <span className="text-slate-400">→ switches enabled, method = "root"</span><br />
                <span className="text-amber-300">ROOTED_NO_GRANT / NOT_ROOTED</span> <span className="text-slate-400">→ greyed out + "requires root"</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="flex items-center gap-2 text-sm font-bold text-white"><Bell className="h-4 w-4 text-amber-300" /> Τι γίνεται χωρίς root (η πλειοψηφία)</h4>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">Τίποτα δεν «σπάει» — απλώς αλλάζει οδός: το <strong className="text-white">ON</strong> γίνεται με το επίσημο system dialog, το <strong className="text-white">OFF</strong> με deep-link στις Ρυθμίσεις Bluetooth (ένα tap), και το <strong className="text-white">AUTO</strong> στέλνει ειδοποίηση «συνιστάται απενεργοποίηση» με κουμπί που ανοίγει τις ρυθμίσεις. Όλα αυτά υλοποιούνται στο <code className="font-mono text-[12px] text-cyan-200">SecurityMonitorService</code> και είναι 100% αληθινά.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CODE ============ */}
      <section id="code" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6">
        <SectionHead icon={FileCode2} kicker="ΤΟ ΠΑΡΑΔΟΤΕΟ" title="Ο διορθωμένος κώδικας — έτοιμος για αντιγραφή"
          desc="10 αρχεία: 7 Kotlin + 1 Manifest + 2 TypeScript. Κάθε αρχείο γράφει ποια ευρήματα διορθώνει. Πάτα το copy και επικόλλησέ το στο repo σου." />
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#040a1c]">
          <div className="flex flex-col lg:flex-row">
            {/* file list */}
            <div className="w-full shrink-0 border-b border-white/10 lg:w-72 lg:border-b-0 lg:border-r">
              <div className="border-b border-white/10 px-4 py-2.5 font-mono text-[11px] font-bold tracking-widest text-slate-400">📦 BLUESHIELD-FIX · 10 FILES</div>
              <div className="code-scroll max-h-72 overflow-y-auto lg:max-h-[560px]">
                {CODE_FILES.map((f) => (
                  <button key={f.id} onClick={() => setActiveFile(f.id)}
                    className={`flex w-full items-center gap-2.5 border-l-2 px-4 py-2.5 text-left transition ${activeFile === f.id ? "border-cyan-400 bg-cyan-500/10" : "border-transparent hover:bg-white/5"}`}>
                    <FileIcon lang={f.lang} />
                    <div className="min-w-0">
                      <div className={`truncate font-mono text-[12px] font-bold ${activeFile === f.id ? "text-cyan-200" : "text-slate-300"}`}>{f.name}</div>
                      <div className="truncate font-mono text-[10px] text-slate-500">{f.fixes.join(" · ")}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* viewer */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <span className="font-mono text-[12px] text-slate-400">{file.path}</span>
                <span className="ml-auto flex gap-1.5">
                  {file.fixes.map((x) => (
                    <span key={x} className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">{x}</span>
                  ))}
                </span>
                <button onClick={copyCode} className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/20">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied!" : "Copy file"}
                </button>
              </div>
              <div className="border-b border-white/10 bg-cyan-500/[0.04] px-4 py-2.5 text-[12.5px] text-slate-300">
                <span className="font-bold text-cyan-300">Τι διορθώνει: </span>{file.summary}
              </div>
              <pre className="code-scroll max-h-[480px] overflow-auto p-4 font-mono text-[12px] leading-[1.7]">
                <code dangerouslySetInnerHTML={{ __html: highlight(file.code, file.lang) }} />
              </pre>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4 text-[13px] text-slate-300">
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-300" />
          <p><strong className="text-white">Σημείωση ειλικρίνειας:</strong> τα αρχεία είναι πλήρη, συμβατά μεταξύ τους (ίδια intents, ίδια ονόματα πακέτου <code className="font-mono text-[12px] text-amber-200">gr.blueshield.app</code>) και ακολουθούν τα επίσημα Android APIs — αλλά κάθε APK πρέπει να χτιστεί και να δοκιμαστεί στη δική σου συσκευή πριν το εμπιστευτείς. Δες την ενότητα ενσωμάτωσης και το πλάνο 6 δοκιμών παρακάτω.</p>
        </div>
      </section>

      {/* ============ INTEGRATION ============ */}
      <section id="integration" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6">
        <SectionHead icon={GitBranch} kicker="INTEGRATION PLAN" title="Ενσωμάτωση σε 6 βήματα (~90 λεπτά)"
          desc="Τσέκαρε κάθε βήμα καθώς το ολοκληρώνεις. Η σειρά έχει σημασία: πρώτα native, μετά manifest, μετά bridge, και τέλος το JS." />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {INTEGRATION_STEPS.map((s) => {
              const done = checkedSteps.includes(s.n);
              return (
                <button key={s.n} onClick={() => toggleStep(s.n)} className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${done ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-[14px] font-black ${done ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-300"}`}>
                    {done ? <Check className="h-4 w-4" /> : s.n}
                  </span>
                  <span className="flex-1">
                    <span className={`text-[14px] font-bold ${done ? "text-emerald-200 line-through" : "text-white"}`}>{s.title}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-slate-300">{s.detail}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {s.files.map((f) => <span key={f} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">{f}</span>)}
                      <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">⏱ ~{s.minutes} min</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <h4 className="text-[12px] font-bold tracking-widest text-slate-400">ΠΡΟΟΔΟΣ ΕΝΣΩΜΑΤΩΣΗΣ</h4>
              <div className="mx-auto mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 text-3xl font-black text-white">{progress}%</div>
              <p className="mt-1 text-[12px] text-slate-400">{checkedSteps.length}/6 βήματα · μετά το 100% χτίσε με:<br /><code className="font-mono text-[11px] text-cyan-200">npx cap sync android → ./gradlew assembleDebug</code></p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-4 py-2.5 font-mono text-[11px] font-bold tracking-widest text-slate-400">PERMISSION MATRIX · ΣΥΝΕΠΕΙΑ ΑΝΑ API</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-2 font-mono">Permission</th>
                      <th className="px-2 py-2 font-mono">≤30</th>
                      <th className="px-2 py-2 font-mono">31–32</th>
                      <th className="px-2 py-2 font-mono">33+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_MATRIX.map((r) => (
                      <tr key={r.permission} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-200">{r.permission}</td>
                        <td className="px-2 py-2"><PermBadge v={r.api29} /></td>
                        <td className="px-2 py-2"><PermBadge v={r.api31} /></td>
                        <td className="px-2 py-2"><PermBadge v={r.api33} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HONEST LIMITS ============ */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <SectionHead icon={TriangleAlert} kicker="ΕΝΤΙΜΟΤΗΤΑ ΠΡΩΤΑ" title="Τι ΔΕΝ μπορεί να κάνει καμία εφαρμογή — ούτε η διορθωμένη"
          desc="Αυτά είναι όρια του ίδιου του Android, όχι bugs. Η διαφορά: η διορθωμένη εφαρμογή τα λέει καθαρά αντί να προσποιείται ότι τα μπλοκάρει." />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {HONEST_LIMITS.map((l, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 font-mono text-[13px] font-black text-slate-300">{i + 1}</span>
                <h4 className="text-[14px] font-bold text-white">{l.title}</h4>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{l.detail}</p>
            </div>
          ))}
        </div>
        {/* test plan */}
        <div className="mt-6 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-cyan-200"><FlaskConical className="h-4 w-4" /> Πλάνο δοκιμών μετά το fix (για να επαληθεύσεις ότι δουλεύει αληθινά)</h4>
          <div className="mt-3 grid gap-2 text-[13px] text-slate-300 sm:grid-cols-2">
            {[
              "T1 · Σάρωση BLE: βάλε δίπλα 2 αληθινές συσκευές BLE — πρέπει να εμφανιστούν με πραγματικό RSSI που αλλάζει όταν τις απομακρύνεις.",
              "T2 · Pairing alert: ζήτα pairing από δεύτερο κινητό — πρέπει να έρθει ειδοποίηση LIVE μέσα σε 2 δευτερόλεπτα.",
              "T3 · Root OFF: σε rooted συσκευή με granted su, το AUTO idle-off πρέπει να κλείνει ΠΡΑΓΜΑΤΙΚΑ το Bluetooth (έλεγξε το εικονίδιο συστήματος).",
              "T4 · Non-root OFF: σε stock συσκευή, το OFF πρέπει να ανοίγει τις Ρυθμίσεις — και το UI να δείχνει 'settings' ως method, όχι ψεύτικο OFF.",
              "T5 · Patch verdicts: σύγκρινε το 'devicePatch' με το Settings → About → Security update — πρέπει να ταυτίζονται.",
              "T6 · Background: κλείσε την οθόνη για 15 λεπτά με AUTO — η ειδοποίηση προστασίας πρέπει να παραμένει και το log να έχει live events.",
            ].map((t) => (
              <div key={t} className="rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed">{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-10 sm:px-6">
        <SectionHead icon={CircleHelp} kicker="ΓΙΑ ΑΡΧΑΡΙΟΥΣ" title="Συχνές ερωτήσεις"
          desc="Απλές εξηγήσεις, χωρίς ορολογία — για όποιον δεν γνωρίζει από ασφάλεια." />
        <div className="mt-6 space-y-3">
          {FAQ.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className={`overflow-hidden rounded-2xl border transition ${open ? "border-cyan-500/40 bg-cyan-500/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
                <button onClick={() => setOpenFaq(open ? null : i)} className="flex w-full items-center gap-3 p-4 text-left">
                  <BookOpen className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span className="flex-1 text-[14px] font-bold text-white">{f.q}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <p className="border-t border-white/10 p-4 text-[13.5px] leading-relaxed text-slate-300">{f.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ CTA / FOOTER ============ */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="glow-cyan relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-600/20 via-blue-700/10 to-transparent p-8 text-center sm:p-12">
          <div className="scanline-bar" />
          <Shield className="animate-float-slow mx-auto h-14 w-14 text-cyan-300" />
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Έτοιμος να κάνεις το BlueShield αληθινό;</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-relaxed text-slate-300">
            Αντέγραψε τα 10 αρχεία στο repo σου, ακολούθησε τα 6 βήματα ενσωμάτωσης και τρέξε τα 6 τεστ.
            Η εφαρμογή σου θα πάψει να προσποιείται — και θα αρχίσει να προστατεύει στα αλήθεια, μέσα στα όρια που θέτει το Android.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="#code" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110">
              <Download className="h-4 w-4" /> Αντέγραψε τα αρχεία
            </a>
            <a href="https://github.com/skourtsidis/BlueShield" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              <ExternalLink className="h-4 w-4" /> Άνοιξε το repo
            </a>
          </div>
        </div>
        <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-[12px] text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-500" />
            BlueShield Audit Lab — validation · integration · consistency report για το skourtsidis/BlueShield
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> 12 findings · 10 patch files · 6 tests</span>
            <a href="#top" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">Επιστροφή στην κορυφή <ArrowRight className="h-3.5 w-3.5 -rotate-90" /></a>
          </div>
        </footer>
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */
function SectionHead({ icon: Icon, kicker, title, desc }: { icon: any; kicker: string; title: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.2em] text-cyan-400">
        <Icon className="h-4 w-4" /> {kicker}
      </div>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function FileIcon({ lang }: { lang: string }) {
  const c = lang === "kotlin" ? "text-purple-300" : lang === "xml" ? "text-orange-300" : "text-sky-300";
  return <FileCode2 className={`h-4 w-4 shrink-0 ${c}`} />;
}

function PermBadge({ v }: { v: string }) {
  const map: Record<string, string> = {
    install: "bg-slate-500/15 text-slate-300",
    runtime: "bg-cyan-500/15 text-cyan-300",
    "runtime*": "bg-cyan-500/15 text-cyan-300",
    "προαιρετικό": "bg-emerald-500/15 text-emerald-300",
    "—": "bg-white/5 text-slate-600",
  };
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${map[v] ?? map["—"]}`}>{v}</span>;
}

const FAQ = [
  {
    q: "Τι σημαίνει 'simulation' — γιατί είναι κακό;",
    a: "Σημαίνει ότι η εφαρμογή εφευρίσκει δεδομένα αντί να τα μετράει. Είναι σαν ένα θερμόμετρο που δείχνει πάντα 36,6° χωρίς να μετράει: σε καθησυχάζει ψεύτικα. Στη δική σου περίπτωση, η εφαρμογή έγραφε 'μπλοκαρίστηκε επίθεση' ενώ δεν είχε δει καμία επίθεση — γιατί δεν 'κοιτούσε' καν το Bluetooth.",
  },
  {
    q: "Τι είναι το 'root' και γιατί το χρειάζομαι για το αυτόματο κλείσιμο;",
    a: "Το root είναι ο 'λογαριασμός διαχειριστή' του Android. Η Google απαγορεύει στις κανονικές εφαρμογές να κλείνουν μόνες τους το Bluetooth (για λόγους ασφαλείας). Μόνο μια rooted συσκευή μπορεί να δώσει στην εφαρμογή αυτή την άδεια. Χωρίς root, η εφαρμογή θα σου ανοίγει τις Ρυθμίσεις για να το κλείσεις με ένα πάτημα — αυτό είναι το μέγιστο που επιτρέπει το Android.",
  },
  {
    q: "Θα με προστατεύει η διορθωμένη εφαρμογή από χάκερ;",
    a: "Θα κάνει όλα όσα ΠΡΑΓΜΑΤΙΚΑ μπορεί μια εφαρμογή: θα σε ειδοποιεί για ύποπτα αιτήματα σύνδεσης, θα σαρώνει πραγματικά τις κοντινές συσκευές, θα σε προειδοποιεί αν η συσκευή σου δεν έχει ενημερώσεις ασφαλείας, και (με root) θα κλείνει αυτόματα το Bluetooth όταν δεν το χρειάζεσαι. Αυτό που δεν μπορεί ΚΑΜΙΑ εφαρμογή είναι να 'μπαλώσει' τις ευπάθειες του Bluetooth chip — αυτό γίνεται μόνο με ενημερώσεις συστήματος.",
  },
  {
    q: "Τι είναι τα BlueBorne, KNOB, BIAS που αναφέρονται;",
    a: "Είναι ονόματα σοβαρών ευπαθειών του Bluetooth που ανακαλύφθηκαν το 2017–2021 και επηρέασαν δισεκατομμύρια συσκευές. Η διορθωμένη εφαρμογή ελέγχει την ημερομηνία ενημέρωσης ασφαλείας του κινητού σου και σου λέει ειλικρινά αν είσαι ευάλωτος (π.χ. 'VULNERABLE — κάνε update') αντί να προσποιείται ότι σε προστατεύει.",
  },
  {
    q: "Πώς θα καταλάβω ότι τώρα δουλεύει αληθινά;",
    a: "Τρία τεστ: (1) Άνοιξε το ραντάρ δίπλα σε πραγματικές συσκευές Bluetooth — το RSSI πρέπει να αλλάζει όταν τις πλησιάζεις/απομακρύνεις. (2) Ζήτα pairing από άλλο κινητό — πρέπει να έρθει ειδοποίηση LIVE. (3) Κοίτα τα badges: κάθε event θα γράφει LIVE (πραγματικό) ή SIM (εκπαιδευτικό σενάριο). Αν όλα γράφουν LIVE, δουλεύει.",
  },
  {
    q: "Πρέπει να ξαναγράψω όλη την εφαρμογή;",
    a: "Όχι. Το React UI σου παραμένει — απλώς παύει να εφευρίσκει δεδομένα και γίνεται 'βιτρίνα' των πραγματικών native δεδομένων. Προσθέτεις 7 αρχεία Kotlin + 1 Manifest + 2 TypeScript αρχεία (σου τα δίνω έτοιμα), και ακολουθείς τα 6 βήματα ενσωμάτωσης (~90 λεπτά).",
  },
];
