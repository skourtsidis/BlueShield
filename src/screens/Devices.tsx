import { useState } from 'react';
import {
  Smartphone, Pencil, Shuffle, Link2, ChevronDown, Trash2, Eye, EyeOff, Contact, MessageSquare, FolderOpen, Phone, Ban, Plus, Settings2,
  CalendarClock, TriangleAlert, CircleCheck, OctagonAlert, MapPin, LockOpen, Bluetooth,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { analyzeName, daysSince, fmtCountdown, fmtDate, maskMac, suggestName, timeAgo } from '../lib/utils';
import { LOCATION_LABEL } from '../lib/mode';
import { nativeOpenSettings } from '../platform/ble';
import { useNow } from '../hooks/useNow';
import type { PairedDevice, Permissions } from '../types';
import { BottomSheet, Button, Card, DEVICE_TYPE_LABEL, deviceIcon, Hint, IconBox, LiveBadge, RiskBadge, SectionTitle, Segmented, Toggle } from '../components/ui';
import { StaleBars } from '../components/charts';

const LEVEL = {
  safe: { t: 'Privacy-safe name', c: 'bg-emerald-500/15 text-emerald-300', I: CircleCheck },
  medium: { t: 'Moderate leak', c: 'bg-amber-500/15 text-amber-300', I: TriangleAlert },
  danger: { t: 'Reveals too much', c: 'bg-rose-500/15 text-rose-300', I: OctagonAlert },
};

function ThisDevice() {
  const now = useNow(1000);
  const name = useStore((s) => s.deviceName);
  const sys = useStore((s) => s.sysInfo);
  const openSheet = useStore((s) => s.openSheet);
  const discoverable = useStore((s) => s.discoverable);
  const until = useStore((s) => s.discoverableUntil);
  const setDiscoverable = useStore((s) => s.setDiscoverable);
  const a = analyzeName(name);
  const L = LEVEL[a.level];
  return (
    <Card className="bg-gradient-to-br from-violet-500/[0.10] to-surface/80">
      <SectionTitle
        icon={Smartphone}
        title="This Phone"
        action={sys?.live ? <LiveBadge /> : undefined}
        help={{
          title: 'Your Device Name',
          body: 'Whenever Bluetooth is active, your broadcast device name can be seen by people nearby. Names like "George’s iPhone" or "Samsung S23" reveal both who you are and your exact phone model — telling attackers which model-specific exploits to try.\n\nPick a neutral alias instead, such as "Nova-7F3A".',
        }}
      />
      <div className="rounded-2xl bg-black/25 p-3.5">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Bluetooth Name</div>
        <div className="mt-0.5 text-lg font-bold text-white">{name}</div>
        <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', L.c)}>
          <L.I size={12} /> {L.t}
        </span>
        {a.issues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {a.issues.map((i) => (
              <li key={i} className="text-[12px] leading-snug text-slate-400">
                • {i}
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" className="mt-3" icon={Pencil} onClick={() => openSheet('rename')}>
          Rename device
        </Button>
      </div>
      {sys && (
        <p className="mt-2 text-[12px] text-slate-400">
          {sys.osName} {sys.version ?? ''} {sys.model ? `· ${sys.model}` : ''} · {sys.browser}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] p-3">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', discoverable ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-slate-400')}>
          {discoverable ? <Eye size={18} /> : <EyeOff size={18} />}
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-100">Discoverable visibility</div>
          <div className="text-xs text-slate-400">{discoverable && until ? `Visible — auto-hides in ${fmtCountdown(until - now)}` : 'Hidden from strangers'}</div>
        </div>
        <Toggle checked={discoverable} onChange={setDiscoverable} label="Discoverable" />
      </div>
    </Card>
  );
}

export function RenameSheet() {
  const open = useStore((s) => s.sheet === 'rename');
  const openSheet = useStore((s) => s.openSheet);
  return (
    <BottomSheet open={open} onClose={() => openSheet(null)} title="Change Device Name" icon={<IconBox icon={Pencil} size="sm" />}>
      <RenameContent onDone={() => openSheet(null)} />
    </BottomSheet>
  );
}

function RenameContent({ onDone }: { onDone: () => void }) {
  const current = useStore((s) => s.deviceName);
  const setDeviceName = useStore((s) => s.setDeviceName);
  const native = useStore((s) => s.caps.native);
  const [val, setVal] = useState(current);
  const [sugg, setSugg] = useState<string[]>(() => Array.from({ length: 4 }, suggestName));
  const a = analyzeName(val);
  const L = LEVEL[a.level];
  return (
    <div className="space-y-4">
      <div>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          maxLength={32}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[15px] text-white outline-none focus:border-sky-400/60"
          placeholder="e.g. Nova-7F3A"
        />
        <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', L.c)}>
          <L.I size={12} /> {L.t}
        </div>
        {a.issues.map((i) => (
          <p key={i} className="mt-1 text-[12px] text-slate-400">
            • {i}
          </p>
        ))}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Safe neutral suggestions</span>
          <button type="button" onClick={() => setSugg(Array.from({ length: 4 }, suggestName))} className="flex items-center gap-1 text-[12px] font-semibold text-sky-300">
            <Shuffle size={13} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sugg.map((s) => (
            <button key={s} type="button" onClick={() => setVal(s)} className={cn('rounded-xl border px-3 py-2 font-mono text-[13px] transition', val === s ? 'border-sky-400/60 bg-sky-500/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300')}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <Button
        className="w-full"
        onClick={() => {
          setDeviceName(val);
          onDone();
        }}
      >
        Save Name
      </Button>
      <div className="rounded-2xl bg-white/[0.04] p-3.5 text-[12.5px] leading-relaxed text-slate-300">
        <b className="text-white">Also update it in your phone’s OS Settings:</b>
        <ul className="mt-1.5 space-y-1 text-slate-400">
          <li>• Samsung: Settings → About phone → Edit</li>
          <li>• Pixel / Android: Settings → Connected devices → Connection preferences → Bluetooth → Device name</li>
          <li>• Xiaomi: Settings → About phone → Device name</li>
          <li>• iPhone: Settings → General → About → Name</li>
        </ul>
        {native && (
          <Button size="sm" variant="secondary" className="mt-3" icon={Settings2} onClick={() => void nativeOpenSettings()}>
            Open Bluetooth Settings
          </Button>
        )}
      </div>
    </div>
  );
}

export function PairSheet() {
  const open = useStore((s) => s.sheet === 'pair');
  const openSheet = useStore((s) => s.openSheet);
  const nearby = useStore((s) => s.nearby);
  const paired = useStore((s) => s.paired);
  const pairNew = useStore((s) => s.pairNew);
  const location = useStore((s) => s.location);
  const radioOn = useStore((s) => s.radioOn);
  const candidates = nearby.filter((d) => !paired.some((p) => p.name === d.name) && d.type !== 'beacon');
  return (
    <BottomSheet open={open} onClose={() => openSheet(null)} title="Pair New Device" icon={<IconBox icon={Link2} size="sm" />}>
      <div className="space-y-3">
        <div className={cn('flex items-start gap-2 rounded-2xl p-3 text-[12.5px] leading-snug', location === 'public' ? 'bg-amber-500/10 text-amber-100' : 'bg-emerald-500/10 text-emerald-100')}>
          <MapPin size={15} className="mt-0.5 shrink-0" />
          {location === 'public'
            ? 'You are in a public place. First-time pairing here is exposed to packet sniffing — BlueShield blocks it whenever Anti-Sniffing or "Pair only in trusted places" is active.'
            : `You are in a trusted place (${LOCATION_LABEL[location]}) — safe environment for pairing.`}
        </div>
        {!radioOn ? (
          <p className="py-6 text-center text-[13px] text-slate-400">Enable Bluetooth first.</p>
        ) : candidates.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">No nearby pairable devices found.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {candidates.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <IconBox icon={deviceIcon(d.type, d.tags.includes('hacktool'))} size="sm" tone={d.risk === 'high' ? 'rose' : 'slate'} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-slate-100">{d.name || d.label || 'Unknown device'}</div>
                  <RiskBadge risk={d.risk} />
                </div>
                <Button
                  size="sm"
                  variant={d.risk === 'high' ? 'danger' : 'secondary'}
                  onClick={() => {
                    if (pairNew(d.id)) openSheet(null);
                  }}
                >
                  Pair
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Hint>Only pair with accessories you recognize and physically hold. Never pair with bait-named or unfamiliar devices.</Hint>
      </div>
    </BottomSheet>
  );
}

const PERMS: { k: keyof Permissions; label: string; I: typeof Contact }[] = [
  { k: 'contacts', label: 'Contacts', I: Contact },
  { k: 'messages', label: 'Messages', I: MessageSquare },
  { k: 'calls', label: 'Calls & microphone', I: Phone },
  { k: 'files', label: 'Files', I: FolderOpen },
];

function PairedItem({ p }: { p: PairedDevice }) {
  const staleDays = useStore((s) => s.settings.staleDays);
  const toggleConn = useStore((s) => s.togglePairedConnection);
  const removePaired = useStore((s) => s.removePaired);
  const setPermission = useStore((s) => s.setPermission);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const days = daysSince(p.lastUsed);
  const stale = days > staleDays;
  const I = deviceIcon(p.type);
  return (
    <div className="py-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <span className="relative">
          <IconBox icon={I} tone={p.connected ? 'sky' : stale ? 'rose' : 'slate'} />
          {p.connected && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-surface" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-slate-100">{p.name}</div>
          <div className="truncate text-[11.5px] text-slate-400">
            {p.note ?? DEVICE_TYPE_LABEL[p.type]} · {p.connected ? 'in use now' : `used ${timeAgo(p.lastUsed)}`}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {stale && <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">Stale · {days}d</span>}
            {p.secure === 'legacy' && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Legacy pairing</span>}
            {!p.encrypted && (
              <span className="flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                <LockOpen size={9} /> Unencrypted
              </span>
            )}
            {p.keyBytes < 16 && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Key {p.keyBytes}B</span>}
          </div>
        </div>
        <ChevronDown size={18} className={cn('shrink-0 text-slate-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="anim-fade mt-3 space-y-3 rounded-2xl bg-black/20 p-3">
          <dl className="grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd className="font-mono text-slate-200">{maskMac(p.mac)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Paired on</dt>
              <dd className="text-slate-200">{fmtDate(p.pairedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Security</dt>
              <dd className={p.secure === 'sc' ? 'text-emerald-300' : 'text-amber-300'}>{p.secure === 'sc' ? 'Secure Connections' : 'Legacy (older)'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Encryption key</dt>
              <dd className={p.keyBytes >= 16 ? 'text-emerald-300' : 'text-amber-300'}>
                {p.keyBytes} bytes ({p.keyBytes * 8}-bit)
              </dd>
            </div>
          </dl>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Permissions</div>
            <div className="space-y-1.5">
              {PERMS.map(({ k, label, I: PI }) => (
                <div key={k} className="flex items-center gap-2">
                  <PI size={14} className="text-slate-400" />
                  <span className="flex-1 text-[12.5px] text-slate-200">{label}</span>
                  <Toggle checked={p.permissions[k]} onChange={(v) => setPermission(p.id, k, v)} label={label} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" icon={p.connected ? Ban : Link2} onClick={() => toggleConn(p.id)}>
              {p.connected ? 'Disconnect' : 'Connect'}
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={() => {
                if (confirm) removePaired(p.id);
                else {
                  setConfirm(true);
                  setTimeout(() => setConfirm(false), 3000);
                }
              }}
            >
              {confirm ? 'Confirm?' : 'Forget'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Devices() {
  const paired = useStore((s) => s.paired);
  const staleDays = useStore((s) => s.settings.staleDays);
  const updateSettings = useStore((s) => s.updateSettings);
  const removeStale = useStore((s) => s.removeStale);
  const blocked = useStore((s) => s.blocked);
  const unblock = useStore((s) => s.unblockDevice);
  const openSheet = useStore((s) => s.openSheet);
  const location = useStore((s) => s.location);
  const native = useStore((s) => s.caps.native);
  const bonded = useStore((s) => s.live.bonded);
  const stale = paired.filter((p) => daysSince(p.lastUsed) > staleDays);
  const sorted = [...paired].sort((a, b) => Number(b.connected) - Number(a.connected) || b.lastUsed - a.lastUsed);
  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <ThisDevice />

      <Card>
        <SectionTitle
          icon={Plus}
          title="Pair a New Device"
          subtitle={`Location: ${LOCATION_LABEL[location]} ${location === 'public' ? '(untrusted)' : '(trusted)'}`}
          help={{
            title: 'Safe Pairing',
            body: 'During first-time pairing, two devices exchange secret encryption keys. If an attacker is sniffing nearby at that exact moment, they can capture the key.\n\nPair new gear at home rather than in a café or subway. BlueShield checks your location and blocks pairing in public places whenever Anti-Sniffing is enabled.',
          }}
        />
        <Button className="w-full" icon={Bluetooth} onClick={() => openSheet('pair')}>
          Scan & Pair
        </Button>
      </Card>

      <Card className="py-2">
        <div className="pt-2">
          <SectionTitle
            icon={Link2}
            title={`Saved Devices (${paired.length})`}
            subtitle="Tap any device for security details and permissions"
            help={{
              title: 'Saved (Bonded) Devices',
              body: 'These are all the accessories your phone "trusts" and reconnects to automatically. Every saved entry is a trusted identity an attacker could spoof in a BIAS impersonation attack.\n\nForget devices you no longer use — especially rental cars and old headsets — and grant each device only the permissions it actually needs.',
            }}
          />
        </div>
        <div className="divide-y divide-white/[0.06]">
          {sorted.map((p) => (
            <PairedItem key={p.id} p={p} />
          ))}
          {paired.length === 0 && <p className="py-6 text-center text-[13px] text-slate-400">No saved Bluetooth devices.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon={CalendarClock}
          title="Days Since Last Use"
          subtitle="Red bars exceed your stale-device threshold"
          help={{ title: 'Stale Devices', body: 'Shows how many days each saved Bluetooth device has gone unused. Devices past the dashed red threshold should be forgotten to protect against BIAS/MAC-spoofing attacks.' }}
        />
        {paired.length > 0 && <StaleBars data={paired.map((p) => ({ name: p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name, days: daysSince(p.lastUsed) }))} threshold={staleDays} />}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] text-slate-400">Limit:</span>
          <Segmented<number>
            size="sm"
            className="flex-1"
            value={staleDays}
            onChange={(v) => updateSettings({ staleDays: v })}
            options={[
              { value: 30, label: '30d' },
              { value: 60, label: '60d' },
              { value: 90, label: '90d' },
              { value: 180, label: '180d' },
            ]}
          />
        </div>
        <Button className="mt-3 w-full" variant={stale.length ? 'danger' : 'secondary'} icon={Trash2} disabled={!stale.length} onClick={() => removeStale()}>
          {stale.length ? `Clean up stale devices (${stale.length})` : 'No stale devices'}
        </Button>
        <Hint className="mt-3">On your phone: Settings → Bluetooth → ⚙ next to the device → “Forget” / “Unpair” (iPhone: ⓘ → “Forget This Device”).</Hint>
      </Card>

      {native && (
        <Card>
          <SectionTitle icon={Bluetooth} title="System Bonded Devices" action={<LiveBadge />} subtitle="Reported directly by Android" />
          {bonded.length ? (
            <ul className="divide-y divide-white/[0.06]">
              {bonded.map((b) => (
                <li key={b.id} className="flex items-center gap-2 py-2 text-[13px]">
                  <Bluetooth size={15} className="text-sky-300" />
                  <span className="flex-1 truncate text-slate-200">{b.name}</span>
                  <span className="font-mono text-[11px] text-slate-500">{maskMac(b.id)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-400">No bonded devices found or permission not granted.</p>
          )}
          <Button size="sm" variant="secondary" className="mt-3" icon={Settings2} onClick={() => void nativeOpenSettings()}>
            Open Bluetooth Settings
          </Button>
        </Card>
      )}

      <Card>
        <SectionTitle icon={Ban} title={`Blocked Devices (${blocked.length})`} subtitle="Prompts from these addresses are rejected automatically" />
        {blocked.length === 0 ? (
          <p className="text-[13px] text-slate-400">You have not blocked any devices yet. You can block suspicious transmitters from the Radar screen.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {blocked.map((b) => (
              <li key={b.mac} className="flex items-center gap-3 py-2.5">
                <Ban size={16} className="text-rose-300" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-slate-100">{b.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {maskMac(b.mac)} · {timeAgo(b.at)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => unblock(b.mac)}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
