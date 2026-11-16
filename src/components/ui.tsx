import { useEffect, useRef, useState, type ReactNode, type HTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Info, X, Lightbulb, Power, Sparkles, Check, Headphones, Speaker, Watch, HeartPulse, Car, Laptop, Smartphone, Tv, Signal, Tag,
  Keyboard, Cpu, CircleHelp, Skull,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import type { DeviceType, EventAction, HelpContent, Mode, RiskLevel, Severity } from '../types';
import { SEVERITY_LABEL } from '../data/modules';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-3xl border border-white/[0.07] bg-surface/80 p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]', className)} {...rest}>
      {children}
    </div>
  );
}

export function InfoButton({ help, className }: { help: HelpContent; className?: string }) {
  const openHelp = useStore((s) => s.openHelp);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openHelp(help);
      }}
      aria-label={`Explanation: ${help.title}`}
      className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-sky-300 ring-1 ring-white/10 transition hover:bg-sky-500/20 active:scale-95', className)}
    >
      <Info size={15} />
    </button>
  );
}

export function SectionTitle({ title, subtitle, help, action, icon: Icon }: { title: string; subtitle?: string; help?: HelpContent; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
          <Icon size={17} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          {help && <InfoButton help={help} />}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  const beginner = useStore((s) => s.settings.beginnerMode);
  if (!beginner) return null;
  return (
    <div className={cn('flex gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-[12.5px] leading-relaxed text-amber-100/90', className)}>
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-300" />
      <div>{children}</div>
    </div>
  );
}

const PALETTES = {
  protect: {
    on: 'bg-emerald-400 shadow-emerald-500/40',
    auto: 'bg-sky-400 shadow-sky-500/40',
    off: 'bg-rose-500 shadow-rose-500/40',
    text: { on: 'text-emerald-950', auto: 'text-sky-950', off: 'text-white' },
  },
  radio: {
    on: 'bg-sky-400 shadow-sky-500/40',
    auto: 'bg-violet-400 shadow-violet-500/40',
    off: 'bg-slate-400 shadow-slate-500/30',
    text: { on: 'text-sky-950', auto: 'text-violet-950', off: 'text-slate-950' },
  },
} as const;

export function ModeSwitch({
  value, onChange, palette = 'protect', size = 'md', disabled, className, labels, disabledModes,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
  palette?: keyof typeof PALETTES;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  labels?: Partial<Record<Mode, string>>;
  /** Modes that are greyed out and cannot be selected (e.g. OFF/AUTO without root). */
  disabledModes?: Mode[];
}) {
  const order: Mode[] = ['off', 'auto', 'on'];
  const idx = order.indexOf(value);
  const P = PALETTES[palette];
  const icons = { off: Power, auto: Sparkles, on: Check };
  const h = size === 'lg' ? 'h-12 text-sm' : size === 'sm' ? 'h-8 text-[11px]' : 'h-10 text-xs';
  return (
    <div
      role="radiogroup"
      className={cn('relative grid grid-cols-3 rounded-full border border-white/10 bg-black/35 p-1 select-none', h, disabled && 'pointer-events-none opacity-50', size === 'sm' ? 'w-[150px]' : 'w-full', className)}
    >
      <span
        className={cn('absolute bottom-1 top-1 rounded-full shadow-lg transition-all duration-300 ease-out', P[value])}
        style={{ width: 'calc((100% - 0.5rem) / 3)', left: `calc(0.25rem + ${idx} * (100% - 0.5rem) / 3)` }}
      />
      {order.map((m) => {
        const I = icons[m];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            disabled={disabledModes?.includes(m)}
            onClick={() => onChange(m)}
            className={cn('relative z-10 flex items-center justify-center gap-1 font-extrabold tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40', value === m ? P.text[m] : 'text-slate-400 hover:text-slate-200')}
          >
            {size !== 'sm' && <I size={size === 'lg' ? 15 : 13} strokeWidth={2.6} />}
            {labels?.[m] ?? m.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200', checked ? 'bg-sky-500' : 'bg-white/15', disabled && 'opacity-40')}
    >
      <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-6' : 'translate-x-1')}>
        {checked && <Check size={12} className="text-sky-600" strokeWidth={3} />}
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({
  value, options, onChange, className, size = 'md',
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('flex gap-1 rounded-2xl border border-white/10 bg-black/30 p-1', className)}>
      {options.map((o) => {
        const I = o.icon;
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 font-semibold transition-all',
              size === 'sm' ? 'py-1.5 text-[11px]' : 'py-2 text-xs',
              active ? 'bg-sky-500/90 text-white shadow-md shadow-sky-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
            )}
          >
            {I && <I size={14} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value, min, max, step = 1, onChange, format, className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range flex-1"
        style={{ background: `linear-gradient(90deg, #38bdf8 ${pct}%, rgba(255,255,255,0.12) ${pct}%)` }}
      />
      <span className="min-w-[64px] rounded-lg bg-white/5 px-2 py-1 text-center text-xs font-semibold text-sky-200">{format ? format(value) : value}</span>
    </div>
  );
}

const SEV_STYLE: Record<Severity, string> = {
  info: 'bg-slate-500/15 text-slate-300 ring-slate-400/20',
  low: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
  medium: 'bg-amber-500/15 text-amber-300 ring-amber-400/20',
  high: 'bg-orange-500/15 text-orange-300 ring-orange-400/25',
  critical: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
};
export const SEV_COLOR: Record<Severity, string> = { info: '#94a3b8', low: '#34d399', medium: '#fbbf24', high: '#fb923c', critical: '#fb7185' };

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1', SEV_STYLE[severity], className)}>{SEVERITY_LABEL[severity]}</span>;
}

const ACTION_META: Record<EventAction, { label: string; cls: string }> = {
  blocked: { label: 'Blocked', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25' },
  'user-blocked': { label: 'Rejected by you', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25' },
  allowed: { label: 'Unblocked', cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30' },
  'user-allowed': { label: 'Accepted by you', cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30' },
  warned: { label: 'Warning', cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/25' },
  info: { label: 'Info', cls: 'bg-slate-500/15 text-slate-300 ring-slate-400/20' },
};
export function ActionBadge({ action }: { action: EventAction }) {
  const m = ACTION_META[action];
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1', m.cls)}>{m.label}</span>;
}
export const actionLabel = (a: EventAction) => ACTION_META[a].label;

const RISK_META: Record<RiskLevel, { label: string; cls: string; dot: string }> = {
  safe: { label: 'Safe', cls: 'bg-emerald-500/15 text-emerald-300', dot: 'bg-emerald-400' },
  low: { label: 'Low risk', cls: 'bg-sky-500/15 text-sky-300', dot: 'bg-sky-400' },
  medium: { label: 'Medium risk', cls: 'bg-amber-500/15 text-amber-300', dot: 'bg-amber-400' },
  high: { label: 'High risk', cls: 'bg-rose-500/15 text-rose-300', dot: 'bg-rose-500' },
};
export const riskDot = (r: RiskLevel) => RISK_META[r].dot;
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold', RISK_META[risk].cls)}>{RISK_META[risk].label}</span>;
}

export function LiveBadge({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300 ring-1 ring-emerald-400/25">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      {label}
    </span>
  );
}
export function SimBadge({ label = 'SIMULATION' }: { label?: string }) {
  return <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-violet-300 ring-1 ring-violet-400/25">{label}</span>;
}

export function IconBox({ icon: Icon, tone = 'sky', size = 'md', className }: { icon: LucideIcon; tone?: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate' | 'orange'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const tones = {
    sky: 'bg-sky-500/15 text-sky-300 ring-sky-400/20',
    emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
    amber: 'bg-amber-500/15 text-amber-300 ring-amber-400/20',
    rose: 'bg-rose-500/15 text-rose-300 ring-rose-400/25',
    violet: 'bg-violet-500/15 text-violet-300 ring-violet-400/20',
    slate: 'bg-white/5 text-slate-300 ring-white/10',
    orange: 'bg-orange-500/15 text-orange-300 ring-orange-400/20',
  };
  const s = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-xl' : 'h-10 w-10 rounded-2xl';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center ring-1', tones[tone], s, className)}>
      <Icon size={size === 'lg' ? 22 : size === 'sm' ? 15 : 18} />
    </span>
  );
}

export const severityTone = (s: Severity) => (s === 'critical' ? 'rose' : s === 'high' ? 'orange' : s === 'medium' ? 'amber' : s === 'low' ? 'emerald' : 'slate') as 'rose' | 'orange' | 'amber' | 'emerald' | 'slate';

export function ProgressBar({ value, max = 100, color = '#38bdf8', className }: { value: number; max?: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, sub, tone = 'sky', onClick }: { icon: LucideIcon; label: string; value: ReactNode; sub?: string; tone?: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet'; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-start gap-2 rounded-3xl border border-white/[0.07] bg-surface/80 p-3.5 text-left transition active:scale-[0.98] hover:bg-surface-2">
      <IconBox icon={Icon} tone={tone} size="sm" />
      <div>
        <div className="text-xl font-bold leading-none text-white">{value}</div>
        <div className="mt-1 text-[11.5px] leading-tight text-slate-400">{label}</div>
        {sub && <div className="mt-0.5 text-[10.5px] text-slate-500">{sub}</div>}
      </div>
    </button>
  );
}

export function BottomSheet({
  open, onClose, title, children, icon, tall, footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  tall?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('anim-sheet relative flex max-h-[90%] flex-col rounded-t-[28px] border-t border-white/10 bg-[#0e1731] shadow-2xl', tall && 'h-[90%]')}>
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-white/20" />
        </div>
        {title && (
          <div className="flex items-center gap-3 px-5 pb-3 pt-1">
            {icon}
            <h3 className="flex-1 text-[17px] font-semibold leading-snug text-white">{title}</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/5 p-2 text-slate-300 hover:bg-white/10">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
        {footer && <div className="border-t border-white/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Button({
  children, onClick, variant = 'primary', className, disabled, icon: Icon, size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  className?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
}) {
  const v = {
    primary: 'bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/25',
    secondary: 'bg-white/[0.07] text-slate-100 hover:bg-white/[0.12] ring-1 ring-white/10',
    danger: 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 ring-1 ring-rose-400/25',
    ghost: 'text-sky-300 hover:bg-sky-500/10',
    success: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.97] disabled:opacity-40', size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm', v, className)}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

const DEVICE_ICONS: Record<DeviceType, LucideIcon> = {
  headphones: Headphones, speaker: Speaker, watch: Watch, fitness: HeartPulse, car: Car, laptop: Laptop, phone: Smartphone, tv: Tv,
  beacon: Signal, tracker: Tag, keyboard: Keyboard, tool: Cpu, unknown: CircleHelp,
};
export const deviceIcon = (t: DeviceType, hack = false): LucideIcon => (hack ? Skull : DEVICE_ICONS[t] || CircleHelp);

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  headphones: 'Headphones', speaker: 'Speaker', watch: 'Smartwatch', fitness: 'Fitness tracker', car: 'Car', laptop: 'Computer', phone: 'Phone',
  tv: 'TV', beacon: 'Beacon', tracker: 'Tracker', keyboard: 'Keyboard', tool: 'Board / Tool', unknown: 'Unknown',
};

export function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return display;
}

export function SignalBars({ bars }: { bars: number }) {
  return (
    <span className="inline-flex items-end gap-[2px]" aria-label={`Signal ${bars}/4`}>
      {[1, 2, 3, 4].map((b) => (
        <span key={b} className={cn('w-[3px] rounded-sm', b <= bars ? 'bg-sky-300' : 'bg-white/15')} style={{ height: 3 + b * 3 }} />
      ))}
    </span>
  );
}

export function ListRow({ icon, title, subtitle, right, onClick, className }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void; className?: string }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick} className={cn('flex w-full items-center gap-3 py-3 text-left', onClick && 'transition active:opacity-70', className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-slate-100">{title}</div>
        {subtitle && <div className="mt-0.5 text-[12px] leading-snug text-slate-400">{subtitle}</div>}
      </div>
      {right}
    </Comp>
  );
}
