import { useState } from 'react';
import { MapPin, Radar } from 'lucide-react';
import { Card, DEVICE_TYPE_LABEL, deviceIcon, Hint, IconBox, RiskBadge, SectionTitle, Segmented, Toggle } from '../components/ui';
import { ProximityMeter, Sparkline } from '../components/charts';
import { useStore } from '../store/useStore';
import { distanceLabel } from '../lib/utils';
import type { Mode, NearbyDevice } from '../types';
import { cn } from '../utils/cn';

const SCAN_MODES: { value: Mode; label: string }[] = [
  { value: 'on', label: 'Continuous' },
  { value: 'auto', label: 'Bursts (AUTO)' },
];

export function RadarScreen() {
  const s = useStore();
  const [selId, setSelId] = useState<string | null>(null);
  const list = [...s.nearby].sort((a, b) => b.rssi - a.rssi);
  const sel: NearbyDevice | undefined = list.find((d) => d.id === selId);
  const status = !s.caps.native
    ? 'Open the BlueShield Android app to scan real nearby devices.'
    : s.live.btEnabled === false
      ? 'Bluetooth is off. Turn it on to scan.'
      : s.live.error;

  return (
    <div className="space-y-4 px-4 pt-4">
      <Card className="p-4">
        <SectionTitle title="Live BLE scan" subtitle="Real advertisements from devices around you" icon={Radar} />
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-200">{s.live.scanning ? 'Scanning' : 'Stopped'}</span>
          <Toggle
            checked={s.live.scanning}
            onChange={(v) => void (v ? s.startLive() : s.stopLive())}
            disabled={!s.caps.native}
            label="Live BLE scan"
          />
        </div>
        <Segmented<Mode> className="mt-3" value={s.radarMode} options={SCAN_MODES} onChange={(m) => s.setRadarMode(m)} size="sm" />
        <Hint>Bursts (AUTO) scan for 12 seconds every 30 seconds to save battery.</Hint>
        {status && <div className="mt-2 text-xs text-amber-300">{status}</div>}
      </Card>

      <Card className="p-4">
        <SectionTitle title={`Nearby devices (${list.length})`} subtitle="Strongest signal first. Signal strength is not distance." />
        {list.length === 0 && (
          <Hint>{s.live.scanning ? 'No advertisements yet. Give it a few seconds.' : 'Start a live scan to see devices.'}</Hint>
        )}
        <div className="space-y-2">
          {list.map((d) => {
            const Icon = deviceIcon(d.type);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelId(d.id === selId ? null : d.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-left',
                  d.id === selId && 'border-sky-400/40 bg-sky-500/10',
                )}
              >
                <IconBox icon={Icon} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{d.label || d.name || 'Anonymous device'}</div>
                  <div className="truncate text-[11px] text-slate-400">
                    {d.manufacturer} · {DEVICE_TYPE_LABEL[d.type]} · {d.rssi} dBm
                  </div>
                </div>
                <RiskBadge risk={d.risk} />
              </button>
            );
          })}
        </div>
      </Card>

      {sel && (
        <Card className="space-y-3 p-4">
          <SectionTitle title={sel.label || sel.name || 'Anonymous device'} subtitle={`${sel.protocol.toUpperCase()} · ${sel.macType} address`} icon={MapPin} />
          <div className="text-sm text-slate-300">
            Address: <span className="font-mono text-white">{sel.mac}</span>
          </div>
          <div className="text-sm text-slate-300">
            Estimated: {distanceLabel(sel.rssi)} · last seen {Math.max(0, Math.round((Date.now() - sel.lastSeen) / 1000))}s ago
          </div>
          <div className="text-sm text-slate-300">Services: {sel.services.length ? sel.services.join(', ') : 'none advertised'}</div>
          <div className="text-xs text-slate-400">{sel.reason}</div>
          <ProximityMeter rssi={sel.rssi} />
          <Sparkline values={sel.rssiHistory} color="#38bdf8" width={300} height={48} />
          {sel.tags.includes('tracker') && (
            <Hint>Trackers travel with their owner. If this one keeps appearing near you, check your belongings.</Hint>
          )}
        </Card>
      )}
    </div>
  );
}
