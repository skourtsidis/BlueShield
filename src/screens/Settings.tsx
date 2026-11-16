import { Clock, RefreshCw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { Button, Card, Hint, SectionTitle, Slider, Toggle } from '../components/ui';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';

const ROW = 'flex items-center justify-between gap-3 py-1';

export function SettingsScreen() {
  const s = useStore();
  const st = s.settings;
  const native = s.caps.native;
  const perms = s.permissions;

  return (
    <div className="space-y-4 px-4 pt-4">
      <Card className="p-4">
        <SectionTitle title="Root access" subtitle="Needed for OFF, AUTO and pairing-key analysis" icon={ShieldCheck} />
        <div className={cn('rounded-xl p-3 text-sm', s.root.granted ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white/5 text-slate-300')}>
          {!s.root.checked
            ? 'Checking…'
            : s.root.granted
              ? 'Root access granted.'
              : 'Not rooted. Bluetooth OFF, AUTO and pairing-key analysis are greyed out.'}
        </div>
        <p className="mt-2 text-xs text-slate-500">{s.root.message}</p>
        <Button size="sm" variant="secondary" icon={RefreshCw} className="mt-3" onClick={() => void s.checkRoot()}>
          Check root again
        </Button>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Device details" subtitle="Read from Android" icon={Smartphone} />
        {s.device ? (
          <dl className="space-y-1 text-sm text-slate-300">
            <div>
              Model: <b className="text-white">{s.device.manufacturer} {s.device.model}</b>
            </div>
            <div>
              Android: <b className="text-white">{s.device.androidVersion} (API {s.device.sdkInt})</b>
            </div>
            <div>
              Security patch: <b className="text-white">{s.device.securityPatch || 'not reported'}</b>
            </div>
            <div>
              Bluetooth name: <b className="text-white">{s.deviceName || '—'}</b>
            </div>
          </dl>
        ) : (
          <Hint>{native ? 'Reading device details…' : 'Available only in the BlueShield Android app.'}</Hint>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Permissions" subtitle="Nearby devices (and location on Android 11 and older)" />
        <div className="text-sm text-slate-300">
          Nearby devices: <b className="text-white">{perms ? (perms.scan && perms.connect ? 'granted' : 'missing') : 'unknown'}</b> · Location:{' '}
          <b className="text-white">{perms ? (perms.location ? 'granted' : 'missing') : 'unknown'}</b>
        </div>
        <Button className="mt-3 w-full" variant="secondary" disabled={!native} onClick={() => void s.requestPermissions()}>
          Request permissions
        </Button>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Automations" subtitle="Root-only actions run while the app is open" icon={Clock} />
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-200">AUTO: turn Bluetooth off after {st.autoOffMinutes} min without a connection</div>
            <Slider value={st.autoOffMinutes} min={1} max={60} onChange={(v) => s.updateSettings({ autoOffMinutes: v })} format={(v) => `${v} min`} />
          </div>
          <div className={ROW}>
            <span className="text-sm text-slate-200">Night schedule (root)</span>
            <Toggle checked={st.nightEnabled} onChange={(v) => s.updateSettings({ nightEnabled: v })} label="Night schedule" />
          </div>
          {st.nightEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                From
                <input
                  type="time"
                  value={st.nightFrom}
                  onChange={(e) => s.updateSettings({ nightFrom: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                To
                <input
                  type="time"
                  value={st.nightTo}
                  onChange={(e) => s.updateSettings({ nightTo: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
              </label>
            </div>
          )}
          <div className={ROW}>
            <span className="text-sm text-slate-200">Turn off when leaving a trusted place (root, GPS)</span>
            <Toggle checked={st.offWhenLeaving} onChange={(v) => s.updateSettings({ offWhenLeaving: v })} label="Turn off when leaving" />
          </div>
          <div>
            <div className="text-sm text-slate-200">Discoverable time limit: {st.discoverableTimeout}s</div>
            <Slider
              value={st.discoverableTimeout}
              min={10}
              max={300}
              step={10}
              onChange={(v) => s.updateSettings({ discoverableTimeout: v })}
              format={(v) => `${v}s`}
            />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Detection thresholds" subtitle="When BlueShield raises an alert" />
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-200">Advertisement flood: more than {st.dosThreshold} per second</div>
            <Slider value={st.dosThreshold} min={50} max={1000} step={50} onChange={(v) => s.updateSettings({ dosThreshold: v })} />
          </div>
          <div>
            <div className="text-sm text-slate-200">Stale paired devices after {st.staleDays} days</div>
            <Slider value={st.staleDays} min={30} max={365} step={5} onChange={(v) => s.updateSettings({ staleDays: v })} format={(v) => `${v} d`} />
          </div>
          <div className={ROW}>
            <span className="text-sm text-slate-200">Vibrate on high-severity alerts</span>
            <Toggle checked={st.vibration} onChange={(v) => s.updateSettings({ vibration: v })} label="Vibration" />
          </div>
          <div className={ROW}>
            <span className="text-sm text-slate-200">Use GPS for trusted places</span>
            <Toggle checked={st.useGps} onChange={(v) => s.updateSettings({ useGps: v })} label="GPS places" />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <SectionTitle title="Data" subtitle="Stored only on this device" />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={Trash2} onClick={() => s.clearEvents()}>
            Clear event log
          </Button>
          <Button
            variant="danger"
            icon={RefreshCw}
            onClick={() => {
              if (window.confirm('Restore all BlueShield settings to their defaults?')) s.resetAll();
            }}
          >
            Reset settings
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="About and limits" subtitle="What BlueShield can and cannot do" />
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
          <li>Scan results are real Bluetooth advertisements. Signal strength is not an exact distance.</li>
          <li>Without root, Android does not let apps turn Bluetooth off or hide the phone. BlueShield opens the right settings instead.</li>
          <li>BlueShield cannot patch Android or your Bluetooth chipset. Install every system update.</li>
          <li>Automatic actions and scans run while the app is open. Android limits background Bluetooth work.</li>
        </ul>
      </Card>
    </div>
  );
}
