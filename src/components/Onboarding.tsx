import { useState } from 'react';
import { ArrowRight, ArrowLeft, GraduationCap, Microscope, CircleCheck, CircleX, ShieldCheck, Radio, Bug, Footprints, Zap } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import type { Mode } from '../types';
import { Logo } from './shell';
import { Button, ModeSwitch } from './ui';

const MODE_TEXT: Record<Mode, { title: string; text: string }> = {
  on: { title: 'ON — Always active', text: 'Runs continuously at maximum strength. Highest protection, occasionally stricter.' },
  auto: { title: 'AUTO — Smart balance', text: 'Adapts automatically based on your location and threat severity. Recommended for beginners.' },
  off: { title: 'OFF — Disabled', text: 'Turns the feature off. For protection modules it means "no shield". For the Bluetooth radio itself it means "powered off" — the safest state of all!' },
};

export function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState<Mode>('auto');
  const [beginner, setBeginner] = useState(true);
  const last = 3;

  return (
    <div className="absolute inset-0 z-[90] flex flex-col bg-[#070c1a]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.18),transparent_60%)]" />
      <div className="relative flex-1 overflow-y-auto px-6 pb-4 pt-[max(28px,env(safe-area-inset-top))]">
        {step === 0 && (
          <div className="anim-fade flex flex-col items-center text-center">
            <div className="relative mt-6">
              <span className="pulse-ring absolute inset-0 rounded-full border-2 border-sky-400/40" />
              <span className="pulse-ring absolute inset-0 rounded-full border-2 border-sky-400/40" style={{ animationDelay: '0.8s' }} />
              <div className="relative rounded-full bg-sky-500/10 p-6">
                <Logo size={92} />
              </div>
            </div>
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight text-white">Welcome to BlueShield</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
              Your phone’s shield against Bluetooth security threats — explained in plain English, no technical background required.
            </p>
            <div className="mt-7 grid w-full grid-cols-2 gap-2.5 text-left">
              {[
                { I: Radio, t: 'Eavesdropping', d: 'Sniffing & weak keys' },
                { I: Bug, t: 'Exploits', d: 'BlueBorne, Bluebugging & more' },
                { I: Footprints, t: 'Tracking', d: 'Hidden tags & beacons' },
                { I: Zap, t: 'DoS Floods', d: 'Freezes & battery drain' },
              ].map(({ I, t, d }) => (
                <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <I size={18} className="text-sky-300" />
                  <div className="mt-1.5 text-sm font-semibold text-white">{t}</div>
                  <div className="text-[11.5px] text-slate-400">{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="anim-fade">
            <div className="mt-4 text-xs font-bold uppercase tracking-widest text-sky-300">Step 2 of 4</div>
            <h2 className="mt-2 text-2xl font-extrabold text-white">The ON / OFF / AUTO switches</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-300">
              Throughout the app you will see this three-state switch. Give it a tap:
            </p>
            <div className="mt-6">
              <ModeSwitch value={demo} onChange={setDemo} size="lg" />
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className={cn('text-lg font-bold', demo === 'on' ? 'text-emerald-300' : demo === 'auto' ? 'text-sky-300' : 'text-rose-300')}>{MODE_TEXT[demo].title}</div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-300">{MODE_TEXT[demo].text}</p>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
              Next to every setting you will find an <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-sky-300">i</span> button — tap it anytime for a plain-language explanation.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="anim-fade">
            <div className="mt-4 text-xs font-bold uppercase tracking-widest text-sky-300">Step 3 of 4</div>
            <h2 className="mt-2 text-2xl font-extrabold text-white">How familiar are you with security?</h2>
            <p className="mt-2 text-[14.5px] text-slate-300">You can switch this anytime in Settings.</p>
            <div className="mt-6 space-y-3">
              {[
                { v: true, I: GraduationCap, t: 'I’m a beginner', d: 'Show helpful tips, everyday analogies, and plain-English guidance on every screen.' },
                { v: false, I: Microscope, t: 'I know security', d: 'Expand technical details (CVEs, Bluetooth protocols) automatically with fewer hints.' },
              ].map(({ v, I, t, d }) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBeginner(v)}
                  className={cn('flex w-full items-start gap-3 rounded-3xl border p-4 text-left transition', beginner === v ? 'border-sky-400/60 bg-sky-500/10' : 'border-white/10 bg-white/[0.03]')}
                >
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', beginner === v ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300')}>
                    <I size={22} />
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{t}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-slate-400">{d}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="anim-fade">
            <div className="mt-4 text-xs font-bold uppercase tracking-widest text-sky-300">Step 4 of 4</div>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Full transparency: what the app does</h2>
            <ul className="mt-5 space-y-2.5">
              {[
                'Real BLE device scanning and tracker detection (AirTag, SmartTag, Tile) — in the Android APK.',
                'Real Bluetooth state, bonded devices, Android OS version, and battery monitoring.',
                'Live BLE GATT privacy-leak inspection (Chrome with Web Bluetooth).',
                'Live checks of your real Bluetooth state, nearby devices and security patch level, explained in plain English.',
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-[13.5px] leading-snug text-slate-200">
                  <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                  {t}
                </li>
              ))}
              <li className="flex gap-2.5 text-[13.5px] leading-snug text-slate-300">
                <CircleX size={18} className="mt-0.5 shrink-0 text-amber-400" />
                No non-root Android app can intercept raw Bluetooth stack packets or forcibly turn Bluetooth off on Android 13+. BlueShield alerts you, guides you, and opens the right system settings.
              </li>
            </ul>
            <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-[12.5px] leading-relaxed text-violet-100">
              Items badged <b>LIVE</b> come directly from your device hardware. Items badged <b>SIMULATION</b> are safe educational scenarios (you can toggle them off in Settings).
            </div>
          </div>
        )}
      </div>

      <div className="relative flex items-center gap-3 px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-7 bg-sky-400' : 'w-1.5 bg-white/20')} />
          ))}
        </div>
        {step > 0 && (
          <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < last ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Next <ArrowRight size={16} />
          </Button>
        ) : (
          <Button variant="success" icon={ShieldCheck} onClick={() => complete(beginner)}>
            Get Started
          </Button>
        )}
      </div>
    </div>
  );
}
