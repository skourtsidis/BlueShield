import { useEffect, useMemo, useState } from 'react';
import { ScanSearch, CircleCheck, TriangleAlert, OctagonAlert, LoaderCircle, Wrench, PartyPopper, RotateCcw } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { analyzeName, daysSince, suggestName } from '../lib/utils';
import { useScore } from '../lib/score';
import type { Screen } from '../types';
import { BottomSheet, Button, IconBox, LiveBadge } from './ui';

interface Check {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  fix?: () => void;
  fixLabel?: string;
  nav?: Screen;
  live?: boolean;
}

function useChecks(): Check[] {
  const s = useStore();
  return useMemo(() => {
    const out: Check[] = [];
    out.push(
      s.radioMode === 'on'
        ? { id: 'radio', title: 'Bluetooth radio mode', status: 'warn', detail: 'Bluetooth is left permanently ON. Switching to AUTO turns it off automatically whenever idle.', fix: () => s.setRadioMode('auto'), fixLabel: 'Set to AUTO' }
        : { id: 'radio', title: 'Bluetooth radio mode', status: 'pass', detail: s.radioMode === 'off' ? 'Bluetooth OFF — maximum possible safety.' : 'AUTO: switches off automatically when idle.', live: s.live.btEnabled !== null },
    );
    out.push(
      s.discoverable
        ? { id: 'disc', title: 'Discoverable visibility', status: 'fail', detail: 'Your phone is visible to everyone nearby — exposed to Bluejacking.', fix: () => s.setDiscoverable(false), fixLabel: 'Turn off' }
        : { id: 'disc', title: 'Discoverable visibility', status: 'pass', detail: 'Hidden from nearby strangers.' },
    );
    const na = analyzeName(s.deviceName);
    out.push(
      na.level === 'safe'
        ? { id: 'name', title: 'Device name privacy', status: 'pass', detail: `“${s.deviceName}” — neutral, leaks no personal or model info.` }
        : { id: 'name', title: 'Device name privacy', status: na.level === 'danger' ? 'fail' : 'warn', detail: `“${s.deviceName}”: ${na.issues.join(' ')}`, fix: () => s.setDeviceName(suggestName()), fixLabel: 'Use neutral name' },
    );
    const stale = s.paired.filter((p) => daysSince(p.lastUsed) > s.settings.staleDays);
    out.push(
      stale.length
        ? { id: 'stale', title: 'Stale paired devices', status: stale.length > 1 ? 'fail' : 'warn', detail: `${stale.map((p) => p.name).join(', ')} — unused for over ${s.settings.staleDays} days (BIAS spoofing risk).`, fix: () => s.removeStale(), fixLabel: `Remove (${stale.length})` }
        : { id: 'stale', title: 'Stale paired devices', status: 'pass', detail: 'No forgotten devices in your paired list.' },
    );
    const sys = s.sysInfo;
    const checked = s.updatesCheckedAt && Date.now() - s.updatesCheckedAt < 30 * 86400000;
    const sysStatus: Check['status'] = sys?.support === 'fail' ? 'fail' : sys?.support === 'warn' || !checked ? 'warn' : 'pass';
    out.push({
      id: 'os',
      title: 'OS security updates',
      status: sysStatus,
      live: !!sys?.live,
      detail: `${sys ? `${sys.osName}${sys.version ? ' ' + sys.version : ''}${sys.model ? ' · ' + sys.model : ''}. ${sys.supportText}` : 'Reading system info…'}${checked ? ' Updates verified recently ✓' : ' You have not confirmed checking for OS updates in the past 30 days.'}`,
      fix: checked ? undefined : () => s.markUpdatesChecked(),
      fixLabel: 'I checked for updates',
    });
    out.push(
      s.modules.knob === 'off'
        ? { id: 'knob', title: 'Encryption key length (KNOB)', status: 'fail', detail: 'KNOB Key Protection is OFF — devices could negotiate a 1-byte key.', fix: () => { s.setModule('knob', 'on'); s.updateSettings({ minKeyBytes: 16 }); }, fixLabel: 'ON with 16 bytes' }
        : s.settings.minKeyBytes < 16
          ? { id: 'knob', title: 'Encryption key length (KNOB)', status: 'warn', detail: `Minimum key: ${s.settings.minKeyBytes} bytes. 16 bytes (128-bit) is recommended.`, fix: () => s.updateSettings({ minKeyBytes: 16 }), fixLabel: 'Set 16 bytes' }
          : { id: 'knob', title: 'Encryption key length (KNOB)', status: 'pass', detail: '16-byte (128-bit) minimum key enforced.' },
    );
    const unenc = s.paired.filter((p) => p.keyClass === 'legacy' || p.keyClass === 'ssp-unauth');
    out.push(
      unenc.length && s.modules.sniffing !== 'on'
        ? { id: 'enc', title: 'Unencrypted BLE links', status: 'warn', detail: `${unenc.map((p) => p.name).join(', ')}: uses a weak pairing key — exposed to sniffing.`, fix: () => s.setModule('sniffing', 'on'), fixLabel: 'Anti-Sniffing ON' }
        : { id: 'enc', title: 'Unencrypted BLE links', status: 'pass', detail: unenc.length ? 'Unencrypted accessories exist, but Anti-Sniffing is set to ON.' : 'No weak pairing keys found (pairing keys can only be verified with root access).' },
    );
    const off = Object.values(s.modules).filter((m) => m === 'off').length;
    out.push(
      s.master === 'off'
        ? { id: 'mods', title: 'Protection modules', status: 'fail', detail: 'Master protection is OFF — all shields are disabled.', fix: () => s.setMaster('on'), fixLabel: 'Enable master' }
        : off
          ? { id: 'mods', title: 'Protection modules', status: off > 2 ? 'fail' : 'warn', detail: `${off} protection module${off === 1 ? ' is' : 's are'} set to OFF.`, fix: () => s.setAllModules('recommended'), fixLabel: 'Apply recommended' }
          : { id: 'mods', title: 'Protection modules', status: 'pass', detail: 'All 10 modules are active (ON or AUTO).' },
    );
    const bad = [!s.settings.pairingOnlyTrusted && 'pair only in trusted places', !s.settings.autoRejectUnknown && 'auto-reject unknown requests'].filter(Boolean);
    out.push(
      bad.length
        ? { id: 'prac', title: 'Security best practices', status: 'warn', detail: `Not yet enabled: ${bad.join(' and ')}.`, fix: () => s.updateSettings({ pairingOnlyTrusted: true, autoRejectUnknown: true }), fixLabel: 'Enable both' }
        : { id: 'prac', title: 'Security best practices', status: 'pass', detail: 'Trusted-place pairing & auto-reject unknown prompts enabled.' },
    );
    const danger = s.nearby.filter((d) => d.risk === 'high');
    out.push(
      danger.length
        ? { id: 'near', title: 'Suspicious devices nearby', status: 'warn', detail: `${danger.length} high-risk nearby: ${danger.map((d) => d.name || d.label || 'unknown').join(', ')}.`, nav: 'radar', fixLabel: 'Inspect on Radar', live: s.live.scanning }
        : { id: 'near', title: 'Suspicious devices nearby', status: 'pass', detail: s.radioOn ? 'No high-risk devices detected around you.' : 'Bluetooth is off — invisible to nearby scanners.', live: s.live.scanning },
    );
    out.push(
      s.modules.dos === 'off'
        ? { id: 'dos', title: 'Anti-DoS & battery guard', status: 'warn', detail: 'Packet-flood protection is OFF.', fix: () => s.setModule('dos', 'auto'), fixLabel: 'Set to AUTO' }
        : { id: 'dos', title: 'Anti-DoS & battery guard', status: 'pass', detail: `Active. Battery: ${Math.round(s.battery.level)}%${s.battery.charging ? ' (charging)' : ''}.`, live: s.battery.source === 'live' },
    );
    return out;
  }, [s]);
}

const ICON = { pass: CircleCheck, warn: TriangleAlert, fail: OctagonAlert };
const COLOR = { pass: 'text-emerald-400', warn: 'text-amber-400', fail: 'text-rose-400' };

export function AuditSheet() {
  const open = useStore((s) => s.sheet === 'audit');
  return open ? <AuditInner /> : null;
}

function AuditInner() {
  const open = true;
  const openSheet = useStore((s) => s.openSheet);
  const go = useStore((s) => s.go);
  const toast = useStore((s) => s.toast);
  const checks = useChecks();
  const score = useScore();
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const done = step >= checks.length;

  useEffect(() => {
    if (open) setStep(0);
  }, [open, run]);
  useEffect(() => {
    if (!open || done) return;
    const t = setTimeout(() => setStep((x) => x + 1), 380);
    return () => clearTimeout(t);
  }, [open, step, done]);

  const counts = { pass: 0, warn: 0, fail: 0 };
  checks.forEach((c) => counts[c.status]++);
  const fixable = checks.filter((c) => c.status !== 'pass' && c.fix);

  return (
    <BottomSheet
      open={open}
      onClose={() => openSheet(null)}
      tall
      title="Security Audit"
      icon={<IconBox icon={ScanSearch} size="sm" />}
      footer={
        done ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={RotateCcw} onClick={() => setRun((r) => r + 1)}>
              Re-scan
            </Button>
            {fixable.length ? (
              <Button
                variant="success"
                icon={Wrench}
                className="flex-1"
                onClick={() => {
                  fixable.forEach((c) => c.fix?.());
                  toast(`Fixed ${fixable.length} security issue${fixable.length === 1 ? '' : 's'}`, 'success');
                }}
              >
                Fix all ({fixable.length})
              </Button>
            ) : (
              <Button className="flex-1" icon={PartyPopper} onClick={() => openSheet(null)}>
                All clear!
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        {!done ? (
          <div className="flex items-center gap-3">
            <LoaderCircle className="animate-spin text-sky-300" size={22} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Running checks… {Math.min(step + 1, checks.length)}/{checks.length}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-400 transition-all duration-300" style={{ width: `${(step / checks.length) * 100}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Security Score</div>
              <div className="text-3xl font-extrabold tabular-nums" style={{ color: score.color }}>
                {score.total}
                <span className="text-base font-medium text-slate-500">/100</span>
              </div>
            </div>
            <div className="flex gap-3 text-center text-xs">
              <div>
                <div className="text-lg font-bold text-emerald-400">{counts.pass}</div>OK
              </div>
              <div>
                <div className="text-lg font-bold text-amber-400">{counts.warn}</div>Warn
              </div>
              <div>
                <div className="text-lg font-bold text-rose-400">{counts.fail}</div>Risk
              </div>
            </div>
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {checks.map((c, i) => {
          const revealed = i < step;
          const current = i === step && !done;
          const I = ICON[c.status];
          return (
            <li key={c.id} className={cn('rounded-2xl border p-3 transition-all duration-300', revealed ? 'border-white/10 bg-white/[0.03]' : 'border-transparent opacity-40')}>
              <div className="flex items-start gap-2.5">
                {revealed ? <I size={19} className={cn('mt-0.5 shrink-0', COLOR[c.status])} /> : current ? <LoaderCircle size={19} className="mt-0.5 shrink-0 animate-spin text-sky-300" /> : <span className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/20" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-white">
                    {c.title} {revealed && c.live && <LiveBadge />}
                  </div>
                  {revealed && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{c.detail}</p>}
                  {revealed && c.status !== 'pass' && (c.fix || c.nav) && (
                    <Button
                      size="sm"
                      variant={c.status === 'fail' ? 'success' : 'secondary'}
                      className="mt-2"
                      icon={Wrench}
                      onClick={() => {
                        if (c.nav) {
                          openSheet(null);
                          go(c.nav);
                        } else c.fix?.();
                      }}
                    >
                      {c.fixLabel || 'Fix'}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
