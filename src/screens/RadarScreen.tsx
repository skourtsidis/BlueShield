import { useEffect, useMemo, useState } from 'react';
import {
  Radar, BluetoothOff, Crosshair, Ban, UserCheck, TriangleAlert, ScanSearch, RadioTower, Microscope, CircleCheck, OctagonAlert, Info,
  CircleMinus, Footprints, Lock, LockOpen, ArrowDownUp,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { clamp, distanceLabel, signalBars, timeAgo } from '../lib/utils';
import { inspectWebDevice, type InspectResult } from '../platform/ble';
import { vibrate } from '../platform/system';
import { useNow } from '../hooks/useNow';
import type { NearbyDevice, RiskLevel } from '../types';
import {
  BottomSheet, Button, Card, DEVICE_TYPE_LABEL, deviceIcon, Hint, IconBox, InfoButton, LiveBadge, ModeSwitch, RiskBadge, riskDot, SectionTitle,
  SignalBars, SimBadge, Toggle,
} from '../components/ui';
import { MiniArea, ProximityMeter, RadarView } from '../components/charts';

type Filter = 'all' | 'suspicious' | 'trackers' | 'beacons' | 'mine';
const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, safe: 3 };
const riskTone = (r: RiskLevel) => (r === 'high' ? 'rose' : r === 'medium' ? 'amber' : r === 'low' ? 'sky' : 'emerald') as 'rose' | 'amber' | 'sky' | 'emerald';
const MAC_LABEL = { public: 'Public (static)', random: 'Random static', rpa: 'Resolvable Private (RPA) — rotates regularly' };

function LiveScanCard({ onInspect }: { onInspect: () => void }) {
  const caps = useStore((s) => s.caps);
  const live = useStore((s) => s.live);
  const count = useStore((s) => s.nearby.filter((d) => d.source === 'live').length);
  const startLive = useStore((s) => s.startLive);
  const stopLive = useStore((s) => s.stopLive);
  const canScan = caps.native || caps.leScan;
  return (
    <Card>
      <SectionTitle
        icon={RadioTower}
        title="Live BLE Scanner"
        subtitle={canScan ? 'Uses your device’s real Bluetooth radio' : 'Available in the Android APK'}
        action={live.scanning ? <LiveBadge /> : undefined}
        help={{
          title: 'Live BLE Scanning',
          body: 'Listens to real Bluetooth Low Energy advertisements around you and classifies each transmitter: device category, manufacturer, signal strength, and whether it matches a tracker (AirTag, SmartTag, Tile, Find My Device) or indoor beacon.\n\nWorks natively in the Android APK. On Chrome for Android it requires enabling Chrome’s experimental Web Platform flag.',
          more: 'APK: @capacitor-community/bluetooth-le (BluetoothLeScanner, SCAN_MODE_LOW_LATENCY, allowDuplicates). Web: navigator.bluetooth.requestLEScan() — chrome://flags/#enable-experimental-web-platform-features. Tracker signatures match Apple Company ID 0x004C/type 0x12 (Find My), service UUID 0xFD5A (SmartTag), 0xFEED/0xFEEC (Tile), and 0xFEAA frame 0x40/0x41 (Google FMDN).',
        }}
      />
      {canScan ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
          <div className="flex-1 text-[13px] text-slate-300">
            {live.scanning ? (
              <>
                Scanning… <b className="text-white">{count}</b> real device{count === 1 ? '' : 's'}
              </>
            ) : (
              'Inactive — showing interactive simulation'
            )}
            {caps.native && live.btEnabled !== null && <div className="text-[11.5px] text-slate-500">System Bluetooth: {live.btEnabled ? 'Enabled' : 'Disabled'}</div>}
          </div>
          <Toggle checked={live.scanning} onChange={(v) => void (v ? startLive() : stopLive())} label="Live BLE scan" />
        </div>
      ) : (
        <p className="rounded-2xl bg-white/[0.04] p-3 text-[12.5px] leading-relaxed text-slate-400">
          This browser does not allow continuous background BLE scanning. Install the Android APK (see Settings → About) for real nearby device and tracker detection. Until then, the radar runs an educational simulation.
        </p>
      )}
      {live.error && <p className="mt-2 text-[12px] text-amber-300">{live.error}</p>}
      {caps.webBluetooth && (
        <Button variant="secondary" icon={Microscope} className="mt-3 w-full" onClick={onInspect}>
          Inspect a real BLE device (GATT)
        </Button>
      )}
    </Card>
  );
}

function InspectorSheet({ result, onClose }: { result: InspectResult | null; onClose: () => void }) {
  const leaks = result?.items.filter((i) => i.status === 'leak').length ?? 0;
  const META = {
    leak: { I: OctagonAlert, c: 'text-rose-400', l: 'Leaking' },
    protected: { I: CircleCheck, c: 'text-emerald-400', l: 'Protected' },
    info: { I: Info, c: 'text-sky-300', l: 'Info' },
    absent: { I: CircleMinus, c: 'text-slate-500', l: 'Not present' },
  };
  return (
    <BottomSheet open={!!result} onClose={onClose} title={result ? `Inspection: ${result.name}` : ''} icon={<IconBox icon={Microscope} size="sm" />}>
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LiveBadge label="LIVE CHECK" />
          </div>
          <div className={cn('rounded-2xl border p-3.5 text-[13px] leading-relaxed', leaks ? 'border-rose-400/25 bg-rose-500/10 text-rose-100' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100')}>
            {leaks
              ? `This device exposes ${leaks} field${leaks === 1 ? '' : 's'} to anyone nearby without pairing. Attackers can use exposed fields for tracking (fingerprinting) or looking up firmware vulnerabilities.`
              : 'This device does not expose sensitive fields without pairing. Good security posture!'}
          </div>
          {result.error && <p className="text-[12.5px] text-amber-300">{result.error}</p>}
          <ul className="divide-y divide-white/[0.06] rounded-2xl bg-white/[0.03] px-3">
            {result.items.map((it) => {
              const m = META[it.status];
              return (
                <li key={it.label} className="flex items-start gap-2.5 py-2.5">
                  <m.I size={17} className={cn('mt-0.5 shrink-0', m.c)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-medium text-slate-100">{it.label}</span>
                      <span className={cn('text-[11px] font-semibold', m.c)}>{m.l}</span>
                    </div>
                    <div className="truncate font-mono text-[12px] text-slate-300">{it.value}</div>
                    <div className="text-[11.5px] leading-snug text-slate-500">{it.note}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          {result.services.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Discovered GATT Services</div>
              <div className="flex flex-wrap gap-1.5">
                {result.services.map((s) => (
                  <span key={s} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11.5px] text-slate-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Hint>If this is your own accessory and it leaks info unauthenticated, check its companion app for firmware updates or prefer accessories that require bonding before GATT reads.</Hint>
        </div>
      )}
    </BottomSheet>
  );
}

function DeviceSheet() {
  const id = useStore((s) => s.selectedDevice);
  const d = useStore((s) => s.nearby.find((x) => x.id === s.selectedDevice));
  const selectDevice = useStore((s) => s.selectDevice);
  const blocked = useStore((s) => s.blocked);
  const trustedMacs = useStore((s) => s.trustedMacs);
  const blockDevice = useStore((s) => s.blockDevice);
  const unblockDevice = useStore((s) => s.unblockDevice);
  const trustDevice = useStore((s) => s.trustDevice);
  const vib = useStore((s) => s.settings.vibration);
  const [find, setFind] = useState(false);
  useEffect(() => setFind(false), [id]);
  const bucket = d ? Math.round(d.rssi / 4) : 0;
  useEffect(() => {
    if (!find || !d || !vib) return;
    const p = clamp((d.rssi + 95) / 60, 0, 1);
    const iv = setInterval(() => vibrate(35 + p * 40), 1700 - p * 1400);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, bucket, vib]);
  const isBlocked = d ? blocked.some((b) => b.mac === d.mac) : false;
  const isTrusted = d ? trustedMacs.includes(d.mac) : false;
  const name = d ? d.name || d.label || 'Unknown device' : '';
  return (
    <BottomSheet
      open={!!d}
      onClose={() => selectDevice(null)}
      title={name}
      icon={d ? <IconBox icon={deviceIcon(d.type, d.tags.includes('hacktool'))} tone={riskTone(d.risk)} size="sm" /> : undefined}
    >
      {d && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <RiskBadge risk={d.risk} />
            {d.source === 'live' ? <LiveBadge /> : <SimBadge />}
            {d.tags.includes('tracker') && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-rose-300">Tracker</span>}
            {d.tags.includes('beacon') && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-sky-300">Beacon</span>}
            {isBlocked && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-rose-300">Blocked</span>}
            {isTrusted && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">Trusted</span>}
          </div>

          {find ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <ProximityMeter rssi={d.rssi} />
              <p className="mt-2 text-center text-[12.5px] leading-relaxed text-slate-400">
                Walk slowly in different directions. As you get closer, the percentage climbs and vibration pulses speed up. Check bags, coat pockets, and under seats.
              </p>
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setFind(false)}>
                Stop locating
              </Button>
            </div>
          ) : (
            <>
              <div className={cn('rounded-2xl border p-3.5 text-[13px] leading-relaxed', d.risk === 'high' ? 'border-rose-400/25 bg-rose-500/10 text-rose-100' : d.risk === 'medium' ? 'border-amber-400/25 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/[0.04] text-slate-200')}>
                <b>Why this rating?</b> {d.reason}
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-3">
                <div className="mb-1 flex items-center justify-between text-[12px] text-slate-400">
                  <span>Live signal strength</span>
                  <span className="font-semibold tabular-nums text-sky-200">{Math.round(d.rssi)} dBm</span>
                </div>
                <MiniArea data={d.rssiHistory.map((v, i) => ({ x: i, v }))} domain={[-100, -30]} unit=" dBm" name="Signal" height={80} xFormat={() => ''} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
                {[
                  ['Type', DEVICE_TYPE_LABEL[d.type]],
                  ['Manufacturer', d.manufacturer],
                  ['Protocol', d.protocol === 'ble' ? 'Bluetooth Low Energy' : 'Bluetooth Classic'],
                  ['Est. distance', distanceLabel(d.rssi)],
                  ['First seen', timeAgo(d.firstSeen)],
                  ['Encryption', d.encrypted === null ? 'Unknown' : d.encrypted ? 'Yes ✓' : 'None ⚠'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white/[0.04] p-2.5">
                    <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">{k}</dt>
                    <dd className="mt-0.5 font-medium text-slate-100">{v}</dd>
                  </div>
                ))}
                <div className="col-span-2 rounded-xl bg-white/[0.04] p-2.5">
                  <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">Address</dt>
                  <dd className="mt-0.5 font-mono text-[12px] text-slate-100">{d.mac}</dd>
                  <dd className="text-[11.5px] text-slate-400">{MAC_LABEL[d.macType]}</dd>
                </div>
                {d.services.length > 0 && (
                  <div className="col-span-2 rounded-xl bg-white/[0.04] p-2.5">
                    <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">Advertised Services</dt>
                    <dd className="mt-0.5 text-slate-200">{d.services.join(' · ')}</dd>
                  </div>
                )}
              </dl>
              <Hint>
                {d.macType === 'rpa'
                  ? 'This device regularly rotates its Bluetooth address (MAC Randomization) to protect its owner’s privacy. That is completely normal.'
                  : 'A static address means this device can be recognized wherever it goes. Modern phones use randomized addresses instead.'}
              </Hint>
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="secondary" icon={Crosshair} onClick={() => setFind(true)}>
                  Locate
                </Button>
                {isBlocked ? (
                  <Button size="sm" variant="secondary" icon={LockOpen} onClick={() => unblockDevice(d.mac)}>
                    Unblock
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" icon={Ban} onClick={() => blockDevice(d.mac, name)}>
                    Block
                  </Button>
                )}
                <Button size="sm" variant={isTrusted ? 'success' : 'secondary'} icon={UserCheck} onClick={() => trustDevice(d.mac)}>
                  {isTrusted ? 'Trusted' : 'Trust?'}
                </Button>
              </div>
              <p className="text-[11.5px] leading-snug text-slate-500">
                “Block” adds the device to BlueShield’s blocklist: incoming prompts from it are rejected and you will be alerted if it reappears.
              </p>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

export function RadarScreen() {
  const now = useNow(1000);
  const nearby = useStore((s) => s.nearby);
  const radarMode = useStore((s) => s.radarMode);
  const setRadarMode = useStore((s) => s.setRadarMode);
  const radioOn = useStore((s) => s.radioOn);
  const liveScanning = useStore((s) => s.live.scanning);
  const simulation = useStore((s) => s.settings.simulation);
  const selectedDevice = useStore((s) => s.selectedDevice);
  const selectDevice = useStore((s) => s.selectDevice);
  const paired = useStore((s) => s.paired);
  const blocked = useStore((s) => s.blocked);
  const trustedMacs = useStore((s) => s.trustedMacs);
  const macRotations = useStore((s) => s.macRotations);
  const toast = useStore((s) => s.toast);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'risk' | 'signal'>('risk');
  const [inspect, setInspect] = useState<InspectResult | null>(null);

  const mine = (d: NearbyDevice) => paired.some((p) => p.name === d.name) || trustedMacs.includes(d.mac);
  const list = useMemo(() => {
    const f = nearby.filter((d) => {
      if (filter === 'suspicious') return d.risk === 'high' || d.risk === 'medium';
      if (filter === 'trackers') return d.tags.includes('tracker');
      if (filter === 'beacons') return d.tags.includes('beacon');
      if (filter === 'mine') return mine(d);
      return true;
    });
    return [...f].sort((a, b) => (sort === 'risk' ? RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.rssi - a.rssi : b.rssi - a.rssi));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby, filter, sort, paired, trustedMacs]);

  const follower = nearby.find((d) => d.follow || (d.source === 'live' && d.tags.includes('tracker') && now - d.firstSeen > 10 * 60000));
  const sec = Math.floor(now / 1000) % 30;
  const scanning = radioOn && (liveScanning || radarMode === 'on' || (radarMode === 'auto' && sec < 12));
  const counts = {
    high: nearby.filter((d) => d.risk === 'high').length,
    trackers: nearby.filter((d) => d.tags.includes('tracker')).length,
    beacons: nearby.filter((d) => d.tags.includes('beacon')).length,
  };

  const runInspect = async () => {
    try {
      setInspect(await inspectWebDevice());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(/cancel|NotFoundError/i.test(msg) ? 'Device selection cancelled.' : msg, 'warning');
    }
  };

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      {follower && (
        <div className="anim-fade flex items-start gap-3 rounded-3xl border border-rose-400/30 bg-rose-500/[0.12] p-4">
          <IconBox icon={Footprints} tone="rose" />
          <div className="flex-1">
            <div className="font-semibold text-rose-100">Possible tracker following you!</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-rose-100/80">
              “{follower.label || follower.name}” has stayed close to you for {Math.round((now - follower.firstSeen) / 60000)} minutes.
            </p>
            <Button size="sm" variant="danger" className="mt-2" icon={Crosshair} onClick={() => selectDevice(follower.id)}>
              Locate now
            </Button>
          </div>
        </div>
      )}

      <Card className="relative overflow-hidden">
        <SectionTitle
          icon={Radar}
          title="Nearby Bluetooth Radar"
          subtitle={radioOn ? `${nearby.length} device${nearby.length === 1 ? '' : 's'} in range` : 'Bluetooth is off'}
          action={liveScanning ? <LiveBadge /> : simulation ? <SimBadge /> : undefined}
          help={{
            title: 'Bluetooth Radar',
            body: 'Plots nearby Bluetooth transmitters around you. You are at the center — dots closer to the center have a stronger signal and are physically closer.\n\nColors: green = safe, blue = low risk, yellow = medium, red = high risk (e.g. hacking multi-tools or an unknown tracker following you).\n\nTap any dot on the radar or any device in the list below for live signal graphs and actions.',
            tips: ['Distance is an estimate: walls and human bodies attenuate 2.4 GHz radio signals.', 'Anonymous phones using RPA addresses are normal — they protect their owners’ privacy.'],
          }}
        />
        <div className="relative">
          <RadarView
            devices={radioOn ? list : []}
            selectedId={selectedDevice}
            onSelect={selectDevice}
            active={scanning}
            center={
              radioOn ? undefined : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-slate-400 ring-2 ring-white/10">
                  <BluetoothOff size={22} />
                </span>
              )
            }
          />
          {!radioOn && (
            <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-black/60 p-3 text-center text-[12.5px] leading-snug text-slate-200 backdrop-blur">
              Bluetooth is off: scanning is paused — and nobody can detect your phone over Bluetooth either. 🛡️
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-center gap-3 text-[10.5px] text-slate-400">
          {(['safe', 'low', 'medium', 'high'] as RiskLevel[]).map((r) => (
            <span key={r} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', riskDot(r))} />
              {{ safe: 'Safe', low: 'Low', medium: 'Medium', high: 'High' }[r]}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-200">Scan Mode</span>
          <InfoButton
            help={{
              title: 'Radar Scan Mode',
              body: '• ON: continuous scanning — updates every second, uses slightly more battery.\n• AUTO: scans 12 seconds out of every 30 — reliable detection while saving battery.\n• OFF: pauses scanning and freezes the current list.',
            }}
          />
          <span className="ml-auto text-[11.5px] text-slate-400">
            {!radioOn ? '—' : scanning ? 'Scanning…' : radarMode === 'auto' ? `Next sweep in ${30 - sec}s` : 'Paused'}
          </span>
        </div>
        <ModeSwitch className="mt-2" value={radarMode} onChange={setRadarMode} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-rose-500/10 py-2">
            <div className="text-lg font-bold text-rose-300">{counts.high}</div>
            <div className="text-[10.5px] text-slate-400">High risk</div>
          </div>
          <div className="rounded-2xl bg-amber-500/10 py-2">
            <div className="text-lg font-bold text-amber-300">{counts.trackers}</div>
            <div className="text-[10.5px] text-slate-400">Trackers</div>
          </div>
          <div className="rounded-2xl bg-sky-500/10 py-2">
            <div className="text-lg font-bold text-sky-300">{counts.beacons}</div>
            <div className="text-[10.5px] text-slate-400">Beacons</div>
          </div>
        </div>
        {macRotations > 0 && !liveScanning && <p className="mt-2 text-center text-[11px] text-slate-500">Observed MAC randomizations nearby: {macRotations}</p>}
      </Card>

      <LiveScanCard onInspect={() => void runInspect()} />

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max items-center gap-1.5">
          {(
            [
              { value: 'all', label: 'All', n: nearby.length },
              { value: 'suspicious', label: 'Suspicious', n: nearby.filter((d) => d.risk === 'high' || d.risk === 'medium').length },
              { value: 'trackers', label: 'Trackers', n: counts.trackers },
              { value: 'beacons', label: 'Beacons', n: counts.beacons },
              { value: 'mine', label: 'Mine', n: nearby.filter(mine).length },
            ] as { value: Filter; label: string; n: number }[]
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn('flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition', filter === f.value ? 'bg-sky-500 text-white' : 'bg-white/[0.06] text-slate-300 hover:bg-white/10')}
            >
              {f.label}
              <span className={cn('rounded-full px-1.5 text-[10.5px]', filter === f.value ? 'bg-white/25' : 'bg-white/10 text-slate-400')}>{f.n}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSort((s) => (s === 'risk' ? 'signal' : 'risk'))}
            className="ml-1 flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-slate-300"
            aria-label="Sort order"
          >
            <ArrowDownUp size={13} />
            {sort === 'risk' ? 'Risk' : 'Signal'}
          </button>
        </div>
      </div>

      <Card className="py-1">
        {list.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-slate-400">
            {!radioOn ? 'Bluetooth is turned off.' : !simulation && !liveScanning ? 'Simulation is turned off. Enable Live BLE Scan above.' : 'No devices in this category.'}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {list.map((d) => {
              const isMine = mine(d);
              const isBlocked = blocked.some((b) => b.mac === d.mac);
              return (
                <button key={d.id} type="button" onClick={() => selectDevice(d.id)} className="flex w-full items-center gap-3 py-3 text-left transition active:opacity-70">
                  <span className="relative">
                    <IconBox icon={deviceIcon(d.type, d.tags.includes('hacktool'))} tone={riskTone(d.risk)} />
                    <span className={cn('absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-surface', riskDot(d.risk))} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-medium text-slate-100">{d.name || d.label || 'Unknown device'}</span>
                      {isMine && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-300">YOURS</span>}
                      {isBlocked && <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-300">BLOCKED</span>}
                    </div>
                    <div className="truncate text-[11.5px] text-slate-400">
                      {DEVICE_TYPE_LABEL[d.type]} · {d.manufacturer} · {d.protocol === 'ble' ? 'BLE' : 'Classic'}
                      {d.encrypted === false && (
                        <span className="text-amber-300">
                          {' '}
                          · <LockOpen size={10} className="inline" /> unencrypted
                        </span>
                      )}
                      {d.encrypted === true && (
                        <span className="text-emerald-300">
                          {' '}
                          · <Lock size={10} className="inline" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <RiskBadge risk={d.risk} />
                      {d.follow && (
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-300">
                          <TriangleAlert size={11} /> following you
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <SignalBars bars={signalBars(d.rssi)} />
                    <div className="mt-1 text-[11px] tabular-nums text-slate-400">{Math.round(d.rssi)} dBm</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
      <Hint>
        Tip: tap <ScanSearch size={13} className="inline" /> any suspicious device and choose “Locate” to hunt it down using a hot-and-cold signal meter.
      </Hint>
      <DeviceSheet />
      <InspectorSheet result={inspect} onClose={() => setInspect(null)} />
    </div>
  );
}
