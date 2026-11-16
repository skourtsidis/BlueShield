import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, FlaskConical, Power, Sparkles } from 'lucide-react';
import { Button, Card, IconBox, ModeSwitch, Segmented, SectionTitle } from '../components/ui';
import { useStore } from '../store/useStore';
import { MODULES } from '../data/modules';
import { effectiveMode } from '../lib/mode';
import { moduleStatus, type CheckInput } from '../lib/checks';
import type { LocationCtx, Mode, ModuleId } from '../types';
import { cn } from '../utils/cn';

const LOCATIONS: { value: LocationCtx; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'public', label: 'Public' },
];

export function Protection() {
  const s = useStore();
  const [openId, setOpenId] = useState<ModuleId | null>(null);
  const input: CheckInput = {
    radioKnown: s.caps.native,
    radioOn: s.live.btEnabled === true,
    discoverable: s.discoverable,
    root: s.root.granted,
    device: s.device,
    paired: s.paired,
    pairings: s.pairings,
    nearby: s.nearby,
    scanning: s.live.scanning,
    packetsPerSec: s.timeline.length ? s.timeline[s.timeline.length - 1].packets : 0,
    dosThreshold: s.settings.dosThreshold,
  };

  return (
    <div className="space-y-4 px-4 pt-4">
      <Card className="p-4">
        <SectionTitle title="Master protection" subtitle="Switches every module at once" />
        <ModeSwitch value={s.master} onChange={s.setMaster} palette="protect" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => s.setAllModules('recommended')}>
            Recommended
          </Button>
          <Button size="sm" variant="secondary" icon={Check} onClick={() => s.setAllModules('on')}>
            All ON
          </Button>
          <Button size="sm" variant="danger" icon={Power} onClick={() => s.setAllModules('off')}>
            All OFF
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Where are you?" subtitle="AUTO modules become stricter in public places" />
        <Segmented<LocationCtx> value={s.location} options={LOCATIONS} onChange={(v) => s.setLocation(v)} />
      </Card>

      {MODULES.map((m) => {
        const mode: Mode = s.modules[m.id];
        const eff = effectiveMode(s.master, mode, s.location);
        const st = moduleStatus(m.id, input);
        const open = openId === m.id;
        const Icon = m.icon;
        return (
          <Card key={m.id} className="p-4">
            <div className="flex items-start gap-3">
              <IconBox icon={Icon} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">{m.attack}</div>
                <div className="text-xs text-slate-400">{m.short}</div>
              </div>
              <button
                type="button"
                aria-label="Show details"
                onClick={() => setOpenId(open ? null : m.id)}
                className="rounded-full p-1 text-slate-400 hover:bg-white/5"
              >
                {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>
            <div className="mt-3">
              <ModeSwitch size="sm" value={mode} onChange={(v) => s.setModule(m.id, v)} palette="protect" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div
                className={cn(
                  'text-xs font-semibold',
                  st.exposed === true ? 'text-rose-300' : st.exposed === false ? 'text-emerald-300' : 'text-slate-400',
                )}
              >
                {st.headline}
              </div>
              <Button size="sm" variant="secondary" icon={FlaskConical} onClick={() => s.runCheck(m.id)}>
                Check now
              </Button>
            </div>
            {open && (
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-slate-300">
                <p>
                  <b className="text-white">What it is:</b> {m.threat}
                </p>
                <p>
                  <b className="text-white">Analogy:</b> {m.analogy}
                </p>
                <p>
                  <b className="text-white">What this module does:</b> {m.does}
                </p>
                <p>
                  <b className="text-white">{mode.toUpperCase()} mode:</b> {m.modes[mode]}
                  {eff !== mode ? ` (effective ${eff.toUpperCase()} at ${s.location} location)` : ''}
                </p>
                <p className="text-slate-400">{st.detail}</p>
                <p>
                  <b className="text-white">Tip:</b> {m.tips[0]}
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
