import { Activity, Bluetooth, BluetoothOff, Eye, EyeOff, Radar, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Button, Card, Hint, IconBox, ModeSwitch, SectionTitle, StatTile, Toggle } from '../components/ui';
import { ScoreGauge, TrafficChart } from '../components/charts';
import { useStore } from '../store/useStore';
import { useScore } from '../lib/score';
import type { Mode } from '../types';
import { cn } from '../utils/cn';

export function Dashboard() {
  const s = useStore();
  const score = useScore();
  const native = s.caps.native;
  const rootOk = s.root.granted;
  const locked: Mode[] = rootOk ? [] : ['off', 'auto'];
  const connected = s.paired.filter((p) => p.connected).length;
  const packets = s.timeline.length ? s.timeline[s.timeline.length - 1].packets : 0;
  const btLabel = !native ? 'Android app only' : s.live.btEnabled === null ? 'Checking…' : s.radioOn ? 'ON' : 'OFF';
  const until = s.discoverable && s.discoverableUntil ? Math.max(0, Math.round((s.discoverableUntil - Date.now()) / 1000)) : null;
  const patch = s.device?.securityPatch || '';
  const patchAgeDays = patch ? Math.floor((Date.now() - Date.parse(patch)) / 86400000) : null;

  return (
    <div className="space-y-5 px-4 pt-4">
      <Card className={cn('p-5', s.radioOn && 'bg-gradient-to-br from-sky-500/[0.12] to-transparent')}>
        <div className="flex items-center gap-4">
          <IconBox icon={s.radioOn ? Bluetooth : BluetoothOff} />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-slate-400">Bluetooth radio</div>
            <div className="text-2xl font-bold text-white">{btLabel}</div>
            <div className="text-xs text-slate-400">
              {!native
                ? 'Open the BlueShield Android app to control Bluetooth.'
                : s.radioOn
                  ? 'Bluetooth is on and reachable by nearby devices.'
                  : 'Bluetooth is off: no Bluetooth attack can reach this phone.'}
            </div>
          </div>
        </div>
        <ModeSwitch
          className="mt-4"
          value={s.radioMode}
          onChange={s.setRadioMode}
          palette="radio"
          size="lg"
          disabled={!native}
          disabledModes={locked}
          labels={rootOk ? undefined : { off: 'OFF 🔒', auto: 'AUTO 🔒' }}
        />
        <Hint>
          ON keeps Bluetooth available. OFF and AUTO turn the radio off by themselves, which needs root access.
          {!rootOk && ' On this device they are greyed out.'}
        </Hint>
        {native && !s.radioOn && (
          <Button className="mt-3 w-full" icon={Bluetooth} onClick={() => s.wakeRadio()}>
            Turn Bluetooth on
          </Button>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Root access" icon={ShieldCheck} subtitle="Required for OFF, AUTO and pairing-key analysis" />
        <div className={cn('rounded-xl p-3 text-sm', rootOk ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white/5 text-slate-300')}>
          {!s.root.checked
            ? 'Checking root access…'
            : rootOk
              ? 'Root detected: OFF and AUTO are available.'
              : 'Not rooted: Bluetooth OFF and AUTO are unavailable (greyed out) on this device.'}
        </div>
        <div className="mt-2 text-[12px] text-slate-500">{s.root.message}</div>
        <Button size="sm" variant="secondary" icon={RefreshCw} className="mt-3" onClick={() => void s.checkRoot()}>
          Check again
        </Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconBox icon={s.discoverable ? Eye : EyeOff} tone={s.discoverable ? 'amber' : 'slate'} />
            <div>
              <div className="font-semibold text-white">Discoverable</div>
              <div className="text-xs text-slate-400">
                {s.discoverable
                  ? until !== null
                    ? `Visible — hides in about ${until}s`
                    : 'Visible to nearby devices'
                  : 'Hidden from strangers (recommended)'}
              </div>
            </div>
          </div>
          <Toggle checked={s.discoverable} onChange={s.setDiscoverable} disabled={!native || !s.radioOn} label="Discoverable" />
        </div>
      </Card>

      <Card className="flex items-center gap-4 p-4">
        <ScoreGauge value={score.total} color={score.color} size={130} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-slate-400">Security score</div>
          <div className="text-lg font-semibold text-white">{score.level}</div>
          <Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => s.openSheet('score')}>
            How is this calculated?
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={Radar} label="Nearby" value={s.live.scanning ? s.nearby.length : '—'} sub={s.live.scanning ? 'live BLE scan' : 'scan is off'} tone="sky" onClick={() => s.go('radar')} />
        <StatTile icon={Smartphone} label="Paired" value={s.paired.length} sub={`${connected} connected`} tone="emerald" onClick={() => s.go('devices')} />
        <StatTile icon={Activity} label="Traffic" value={`${packets}/s`} sub="BLE advertisements" tone="amber" />
        <StatTile icon={ShieldCheck} label="Patch" value={patch || '—'} sub={patchAgeDays !== null ? `${patchAgeDays} days old` : 'APK only'} tone="sky" />
      </div>

      <Card className="p-4">
        <SectionTitle title="Live Bluetooth traffic" subtitle="Advertisements heard per second (real BLE scan)" icon={Activity} />
        {s.live.scanning ? (
          <TrafficChart data={s.timeline} threshold={s.settings.dosThreshold} height={150} />
        ) : (
          <Hint>Start a live scan in Radar to see real Bluetooth traffic.</Hint>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" icon={ShieldCheck} onClick={() => s.openSheet('audit')}>
          Full audit
        </Button>
        <Button variant="secondary" icon={Radar} onClick={() => s.go('radar')}>
          Nearby devices
        </Button>
      </div>
    </div>
  );
}
