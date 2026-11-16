import { useEffect, useState } from 'react';
import { Bluetooth, Eye, EyeOff, KeyRound, Lock, Pencil, Smartphone, Trash2 } from 'lucide-react';
import { BottomSheet, Button, Card, DEVICE_TYPE_LABEL, deviceIcon, Hint, IconBox, ListRow, SectionTitle, Toggle } from '../components/ui';
import { useStore } from '../store/useStore';
import { daysSince, suggestName } from '../lib/utils';
import { isNativeApp, native } from '../platform/native';
import type { KeyClass } from '../types';
import { cn } from '../utils/cn';

const KEY_LABEL: Record<KeyClass, string> = {
  legacy: 'Legacy PIN pairing (weak)',
  'ssp-unauth': 'Secure Simple Pairing without MITM protection (weak)',
  'ssp-auth': 'Secure Simple Pairing with MITM protection',
  'sc-unauth': 'Secure Connections without MITM protection',
  'sc-auth': 'Secure Connections with MITM protection (strongest)',
  unknown: 'Not analyzed yet',
};

export function Devices() {
  const s = useStore();
  const bt = s.caps.native;
  const [selected, setSelected] = useState<string | null>(null);
  const stale = s.paired.filter((p) => !p.connected && p.lastUsed > 0 && daysSince(p.lastUsed) > s.settings.staleDays);
  const sel = s.paired.find((p) => p.id === selected) ?? null;
  const weak = (s.pairings ?? []).filter((r) => r.keyClass === 'legacy' || r.keyClass === 'ssp-unauth');

  return (
    <div className="space-y-4 px-4 pt-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconBox icon={s.discoverable ? Eye : EyeOff} tone={s.discoverable ? 'amber' : 'slate'} />
            <div>
              <div className="font-semibold text-white">Discoverable</div>
              <div className="text-xs text-slate-400">{s.discoverable ? 'Visible to nearby devices' : 'Hidden from strangers'}</div>
            </div>
          </div>
          <Toggle checked={s.discoverable} onChange={s.setDiscoverable} disabled={!bt || !s.radioOn} label="Discoverable" />
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Phone name" subtitle={s.deviceName || 'Read from Android (APK only)'} icon={Smartphone} />
        <Hint>Your Bluetooth name is visible to everyone nearby. Avoid your first name and your exact model.</Hint>
        <Button className="mt-3 w-full" variant="secondary" icon={Pencil} disabled={!bt} onClick={() => s.openSheet('rename')}>
          Rename phone
        </Button>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Pair a new device" subtitle="Pairing happens in Android Bluetooth settings" icon={Bluetooth} />
        <Button className="w-full" icon={Bluetooth} disabled={!bt} onClick={() => s.openSheet('pair')}>
          Pairing guide
        </Button>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Paired devices" subtitle={`${s.paired.length} saved · ${s.paired.filter((p) => p.connected).length} connected`} icon={Smartphone} />
        {!bt && <Hint>Paired devices are read from Android in the BlueShield APK.</Hint>}
        {bt && !s.radioOn && <Hint>Turn Bluetooth on to read paired devices.</Hint>}
        <div className="space-y-2">
          {s.paired.map((p) => {
            const Icon = deviceIcon(p.type);
            return (
              <ListRow
                key={p.id}
                icon={<IconBox icon={Icon} size="sm" />}
                title={p.name}
                subtitle={`${DEVICE_TYPE_LABEL[p.type]} · ${p.transport.toUpperCase()} · ${p.mac}`}
                right={
                  <span className={cn('text-[11px] font-semibold', p.connected ? 'text-emerald-300' : 'text-slate-500')}>
                    {p.connected ? 'CONNECTED' : 'idle'}
                  </span>
                }
                onClick={() => setSelected(p.id === selected ? null : p.id)}
              />
            );
          })}
        </div>
        {sel && (
          <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-sm text-slate-300">
              Pairing security: <b className="text-white">{KEY_LABEL[sel.keyClass]}</b>
            </div>
            <div className="text-xs text-slate-500">
              Last connection seen by BlueShield: {sel.lastUsed ? new Date(sel.lastUsed).toLocaleString() : 'never tracked'}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="danger"
                icon={Trash2}
                disabled={!bt}
                onClick={() => {
                  if (window.confirm(`Forget "${sel.name}"? You will have to pair it again to use it.`)) s.removePaired(sel.id);
                }}
              >
                Forget device
              </Button>
              <Button size="sm" variant="secondary" icon={Bluetooth} disabled={!bt} onClick={() => s.togglePairedConnection(sel.id)}>
                Connect / disconnect
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Pairing key analysis" subtitle="How each device was paired (root only)" icon={KeyRound} />
        {!s.root.granted && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
            <Lock size={14} /> Greyed out: this analysis requires root access.
          </div>
        )}
        <Button
          className="w-full"
          variant="secondary"
          icon={KeyRound}
          disabled={!bt || !s.root.granted}
          onClick={() => void s.requestPairings()}
        >
          Analyze pairing keys
        </Button>
        {s.pairingsError && <div className="mt-2 text-xs text-amber-300">{s.pairingsError}</div>}
        {s.pairings && (
          <div className="mt-3 space-y-2">
            {s.pairings.map((r) => (
              <div key={r.address} className="rounded-xl bg-white/[0.04] p-3 text-xs">
                <div className="font-semibold text-white">{r.name || r.address}</div>
                <div className={cn(r.keyClass === 'legacy' || r.keyClass === 'ssp-unauth' ? 'text-amber-300' : 'text-emerald-300')}>
                  {KEY_LABEL[r.keyClass]}
                </div>
              </div>
            ))}
            {weak.length > 0 && (
              <Hint>Pair the weak devices again at home. The new key then gets man-in-the-middle protection.</Hint>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle
          title="Clean up old devices"
          subtitle={`Not connected for more than ${s.settings.staleDays} days (tracked by BlueShield)`}
          icon={Trash2}
        />
        <Button
          className="w-full"
          variant={stale.length ? 'danger' : 'secondary'}
          icon={Trash2}
          disabled={!stale.length || !bt}
          onClick={() => void s.removeStale()}
        >
          {stale.length ? `Forget ${stale.length} stale device${stale.length === 1 ? '' : 's'}` : 'No stale devices'}
        </Button>
      </Card>
    </div>
  );
}

export function PairSheet() {
  const s = useStore();
  return (
    <BottomSheet
      open={s.sheet === 'pair'}
      onClose={() => s.openSheet(null)}
      title="Pair a new device"
      icon={<Bluetooth size={20} className="text-sky-300" />}
    >
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">
        <p>1. Pair at home, not in cafés, stations or other public places. Pairing exchanges the keys that protect the connection.</p>
        <p>2. Put the accessory in pairing mode, then choose it in Android Bluetooth settings.</p>
        <p>3. Reject every pairing request that you did not start yourself.</p>
        <p>4. Afterwards, check its security class in Devices → Pairing key analysis (root).</p>
      </div>
      <Button
        className="mt-5 w-full"
        icon={Bluetooth}
        disabled={!isNativeApp()}
        onClick={() => {
          native.openBluetoothSettings().catch(() => undefined);
          s.openSheet(null);
        }}
      >
        Open Bluetooth settings
      </Button>
    </BottomSheet>
  );
}

export function RenameSheet() {
  const s = useStore();
  const [value, setValue] = useState(s.deviceName);
  useEffect(() => {
    if (s.sheet === 'rename') setValue(s.deviceName);
  }, [s.sheet, s.deviceName]);
  const trimmed = value.trim();
  return (
    <BottomSheet
      open={s.sheet === 'rename'}
      onClose={() => s.openSheet(null)}
      title="Rename your phone"
      icon={<Pencil size={20} className="text-sky-300" />}
    >
      <p className="mb-3 text-sm text-slate-300">
        Every nearby Bluetooth device can read this name. Use something generic, for example "Phone" or "Pixel".
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={32}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-sky-400"
      />
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={() => setValue(suggestName())}>
          Suggest a neutral name
        </Button>
      </div>
      <Button
        className="mt-4 w-full"
        variant="success"
        disabled={!trimmed}
        onClick={() => {
          s.setDeviceName(trimmed);
          s.openSheet(null);
        }}
      >
        Save name
      </Button>
    </BottomSheet>
  );
}
