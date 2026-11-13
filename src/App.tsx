import { useEffect, useRef } from 'react';
import { ShieldCheck, Radar, GraduationCap, Activity, Package, Smartphone } from 'lucide-react';
import { useStore } from './store/useStore';
import { useEngine } from './hooks/useEngine';
import { BottomNav, HelpSheet, LocationSheet, Logo, RequestModal, ScoreSheet, Toasts, TopBar } from './components/shell';
import { AuditSheet } from './components/AuditSheet';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './screens/Dashboard';
import { RadarScreen } from './screens/RadarScreen';
import { Protection } from './screens/Protection';
import { Devices, PairSheet, RenameSheet } from './screens/Devices';
import { Learn } from './screens/Learn';
import { SettingsScreen } from './screens/Settings';
import { EventsScreen } from './screens/Events';

function DesktopPanel() {
  const features = [
    { I: ShieldCheck, t: '10 μονάδες προστασίας', d: 'Sniffing, Bluejacking, Bluesnarfing, Bluebugging, BlueBorne, KNOB, BIAS, BrakTooth, Tracking, DoS — με ON / OFF / AUTO.' },
    { I: Activity, t: 'Live γραφήματα', d: 'Κίνηση πακέτων, απειλές, μπαταρία, κλειδιά κρυπτογράφησης, χάρτης κινδύνου.' },
    { I: Radar, t: 'Ραντάρ & trackers', d: 'Πραγματική σάρωση BLE στο APK, ανίχνευση AirTag/SmartTag/Tile και «Εντοπισμός».' },
    { I: GraduationCap, t: 'Για αρχάριους', d: 'Εξηγήσεις με απλά λόγια, παρομοιώσεις, κανόνες, λεξικό και κουίζ.' },
    { I: Package, t: 'Έτοιμο για APK', d: 'Capacitor + native Bluetooth LE. Οδηγίες στο ANDROID_APK.md.' },
  ];
  return (
    <aside className="hidden max-w-sm lg:block">
      <div className="flex items-center gap-3">
        <Logo size={52} />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">BlueShield</h1>
          <p className="text-sm text-sky-300">Ασπίδα Bluetooth για Android</p>
        </div>
      </div>
      <p className="mt-5 text-[15px] leading-relaxed text-slate-300">
        Προστατεύει το κινητό σας από τους κινδύνους ασφαλείας του Bluetooth — και σας εξηγεί, με απλά λόγια, τι κάνει κάθε επιλογή.
      </p>
      <ul className="mt-6 space-y-4">
        {features.map(({ I, t, d }) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20">
              <I size={19} />
            </span>
            <div>
              <div className="font-semibold text-white">{t}</div>
              <div className="text-[13px] leading-snug text-slate-400">{d}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[12.5px] text-slate-400">
        <Smartphone size={16} className="shrink-0 text-sky-300" />
        Η προεπισκόπηση δίπλα είναι πλήρως διαδραστική — δοκιμάστε τα κουμπιά ON/OFF/AUTO!
      </div>
    </aside>
  );
}

export default function App() {
  useEngine();
  const screen = useStore((s) => s.screen);
  const onboarded = useStore((s) => s.onboarded);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [screen]);

  return (
    <div className="app-bg flex min-h-[100dvh] w-full items-center justify-center gap-14 md:p-6">
      <DesktopPanel />
      <div className="relative flex h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden bg-app md:h-[min(920px,calc(100dvh-3rem))] md:rounded-[2.75rem] md:border md:border-white/10 md:shadow-[0_40px_120px_-20px_rgba(14,165,233,0.35)]">
        <TopBar />
        <main ref={mainRef} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain pb-24">
          <div key={screen} className="anim-screen">
            {screen === 'home' && <Dashboard />}
            {screen === 'radar' && <RadarScreen />}
            {screen === 'protection' && <Protection />}
            {screen === 'devices' && <Devices />}
            {screen === 'learn' && <Learn />}
            {screen === 'settings' && <SettingsScreen />}
            {screen === 'events' && <EventsScreen />}
          </div>
        </main>
        <BottomNav />
        <HelpSheet />
        <LocationSheet />
        <ScoreSheet />
        <AuditSheet />
        <RenameSheet />
        <PairSheet />
        <RequestModal />
        <Toasts />
        {!onboarded && <Onboarding />}
      </div>
    </div>
  );
}
