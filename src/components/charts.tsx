import { useId, type ReactNode } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, CartesianGrid, PieChart, Pie, Cell,
  BarChart, Bar, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Smartphone } from 'lucide-react';
import { cn } from '../utils/cn';
import { clamp } from '../lib/utils';
import type { NearbyDevice, TimelinePoint } from '../types';
import { useAnimatedNumber } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const useSafeId = () => useId().replace(/[^a-zA-Z0-9]/g, '');

export function ChartTip({ active, payload, label, unit = '', labelFormat }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b1324]/95 px-3 py-2 text-[11px] shadow-xl backdrop-blur">
      {label !== undefined && label !== null && label !== '' && <div className="mb-1 text-slate-400">{labelFormat ? labelFormat(label) : label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.payload?.color || p.color || p.stroke || p.fill }} />
          <span className="text-slate-300">{p.name}:</span>
          <b className="text-white">
            {typeof p.value === 'number' ? Math.round(p.value * 10) / 10 : p.value}
            {unit}
          </b>
        </div>
      ))}
    </div>
  );
}

export function ScoreGauge({ value, color, size = 190 }: { value: number; color: string; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * 0.75;
  const shown = useAnimatedNumber(value);
  const offset = dash * (1 - clamp(value, 0, 100) / 100);
  const gid = useSafeId();
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[135deg]">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g${gid})`}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 10px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[52px] font-extrabold leading-none tracking-tight text-white tabular-nums">{Math.round(shown)}</span>
        <span className="mt-1 text-xs font-medium text-slate-400">of 100</span>
      </div>
    </div>
  );
}

export function TrafficChart({ data, height = 170, threshold, forceThreshold }: { data: TimelinePoint[]; height?: number; threshold?: number; forceThreshold?: boolean }) {
  const gid = useSafeId();
  const last = data.length ? data[data.length - 1].t : Date.now();
  const rows = data.map((p) => ({ ...p, sec: Math.round((p.t - last) / 1000) }));
  const peak = rows.reduce((m, r) => Math.max(m, r.packets), 0);
  const maxY = Math.max(80, peak * 1.25, forceThreshold && threshold ? threshold * 1.15 : 0);
  return (
    <div style={{ height }} className="-mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={`p${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`b${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="sec" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => (v === 0 ? 'now' : `${v}s`)} minTickGap={36} axisLine={false} tickLine={false} />
          <YAxis domain={[0, Math.ceil(maxY / 50) * 50]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={(p: any) => <ChartTip {...p} unit=" /s" labelFormat={(l: number) => (l === 0 ? 'Now' : `${-l}s ago`)} />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          {threshold && threshold <= Math.ceil(maxY / 50) * 50 ? (
            <ReferenceLine y={threshold} stroke="#fb7185" strokeDasharray="5 4" label={{ value: `Limit ${threshold}`, fill: '#fda4af', fontSize: 10, position: 'insideTopLeft' }} />
          ) : null}
          <Area type="monotone" dataKey="packets" name="Incoming packets" stroke="#38bdf8" fill={`url(#p${gid})`} strokeWidth={2} isAnimationActive={false} dot={false} />
          <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#34d399" fill={`url(#b${gid})`} strokeWidth={2} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniArea({
  data, color = '#38bdf8', height = 70, domain, unit = '', name = 'Value', xFormat,
}: {
  data: { x: number; v: number }[];
  color?: string;
  height?: number;
  domain?: [number | 'auto', number | 'auto'];
  unit?: string;
  name?: string;
  xFormat?: (x: number) => string;
}) {
  const gid = useSafeId();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`m${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="x" hide />
          <YAxis hide domain={domain || ['auto', 'auto']} />
          <Tooltip content={(p: any) => <ChartTip {...p} unit={unit} labelFormat={xFormat} />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          <Area type="monotone" dataKey="v" name={name} stroke={color} fill={`url(#m${gid})`} strokeWidth={2} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, color = '#38bdf8', width = 84, height = 26 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const v = values.length >= 2 ? values : [0, 0];
  const max = Math.max(...v, 1);
  const min = Math.min(...v, 0);
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * width},${height - 2 - ((y - min) / (max - min || 1)) * (height - 4)}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export interface DonutDatum {
  id: string;
  name: string;
  value: number;
  color: string;
}
export function ThreatDonut({ data, height = 180, selected, onSelect, centerLabel = 'events' }: { data: DonutDatum[]; height?: number; selected?: string | null; onSelect?: (id: string | null) => void; centerLabel?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const rows = total ? data.filter((d) => d.value > 0) : [{ id: 'none', name: 'None', value: 1, color: '#1e293b' }];
  const sel = rows.find((r) => r.id === selected);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="64%"
            outerRadius="90%"
            paddingAngle={total ? 2.5 : 0}
            stroke="none"
            isAnimationActive={false}
            onClick={(_: any, i: number) => total && onSelect?.(rows[i].id === selected ? null : rows[i].id)}
          >
            {rows.map((d) => (
              <Cell key={d.id} fill={d.color} opacity={selected && selected !== d.id ? 0.3 : 1} style={{ cursor: total ? 'pointer' : 'default', outline: 'none' }} />
            ))}
          </Pie>
          {total > 0 && <Tooltip content={(p: any) => <ChartTip {...p} />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold text-white tabular-nums">{sel ? sel.value : total}</span>
        <span className="max-w-[90px] text-[10.5px] leading-tight text-slate-400">{sel ? sel.name : centerLabel}</span>
      </div>
    </div>
  );
}

export function EventsBar({ data, height = 150 }: { data: { label: string; blocked: number; warned: number; allowed: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="-mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={14} />
          <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={(p: any) => <ChartTip {...p} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="blocked" name="Blocked" stackId="a" fill="#34d399" isAnimationActive={false} />
          <Bar dataKey="warned" name="Warnings" stackId="a" fill="#fbbf24" isAnimationActive={false} />
          <Bar dataKey="allowed" name="Unblocked" stackId="a" fill="#fb7185" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KeyBars({ data, min, height = 150 }: { data: { i: number; bytes: number; device: string; accepted: boolean }[]; min: number; height?: number }) {
  const rows = data.map((d) => ({ ...d, color: d.bytes < 7 ? '#fb7185' : d.bytes < 16 ? '#fbbf24' : '#34d399' }));
  return (
    <div style={{ height }} className="-mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="i" hide />
          <YAxis domain={[0, 16]} ticks={[1, 7, 10, 16]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={(p: any) =>
              p.active && p.payload?.[0] ? (
                <div className="rounded-xl border border-white/10 bg-[#0b1324]/95 px-3 py-2 text-[11px]">
                  <div className="font-semibold text-white">{p.payload[0].payload.device}</div>
                  <div className="text-slate-300">
                    Key: <b>{p.payload[0].payload.bytes} bytes</b> ({p.payload[0].payload.bytes * 8}-bit)
                  </div>
                  <div className={p.payload[0].payload.accepted ? 'text-amber-300' : 'text-emerald-300'}>{p.payload[0].payload.accepted ? 'Allowed' : 'Rejected ✓'}</div>
                </div>
              ) : null
            }
          />
          <ReferenceLine y={min} stroke="#38bdf8" strokeDasharray="5 4" label={{ value: `Min ${min}B`, fill: '#7dd3fc', fontSize: 10, position: 'insideBottomLeft' }} />
          <Bar dataKey="bytes" name="Bytes" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.color} opacity={r.accepted ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StaleBars({ data, threshold, height }: { data: { name: string; days: number }[]; threshold: number; height?: number }) {
  const rows = data.map((d) => ({ ...d, color: d.days > threshold ? '#fb7185' : d.days > threshold * 0.6 ? '#fbbf24' : '#34d399' }));
  return (
    <div style={{ height: height ?? Math.max(120, rows.length * 30 + 30) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 18, right: 14, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={104} tick={{ fill: '#cbd5e1', fontSize: 10.5 }} axisLine={false} tickLine={false} />
          <Tooltip content={(p: any) => <ChartTip {...p} unit=" days" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine x={threshold} stroke="#fb7185" strokeDasharray="5 4" label={{ value: `${threshold}d`, fill: '#fda4af', fontSize: 10, position: 'top' }} />
          <Bar dataKey="days" name="Unused" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskScatter({ data, selected, onSelect, height = 250 }: { data: { id: string; name: string; likelihood: number; impact: number; color: string; summary: string }[]; selected?: string | null; onSelect?: (id: string) => void; height?: number }) {
  return (
    <div style={{ height }} className="-mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 12, left: -10, bottom: 18 }}>
          <ReferenceArea x1={5.5} x2={10.5} y1={5.5} y2={10.5} fill="#fb7185" fillOpacity={0.07} />
          <ReferenceArea x1={0} x2={5.5} y1={0} y2={5.5} fill="#34d399" fillOpacity={0.05} />
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" dataKey="likelihood" name="Likelihood" domain={[0, 10.5]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Likelihood →', fill: '#94a3b8', fontSize: 10, position: 'insideBottom', offset: -10 }} />
          <YAxis type="number" dataKey="impact" name="Impact" domain={[0, 10.5]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Impact →', fill: '#94a3b8', fontSize: 10, angle: -90, position: 'insideLeft', offset: 22 }} />
          <ZAxis range={[120, 120]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }}
            content={(p: any) =>
              p.active && p.payload?.[0] ? (
                <div className="max-w-[200px] rounded-xl border border-white/10 bg-[#0b1324]/95 px-3 py-2 text-[11px]">
                  <div className="font-semibold text-white">{p.payload[0].payload.name}</div>
                  <div className="text-slate-300">{p.payload[0].payload.summary}</div>
                  <div className="mt-1 text-slate-400">
                    Likelihood {p.payload[0].payload.likelihood}/10 · Impact {p.payload[0].payload.impact}/10
                  </div>
                </div>
              ) : null
            }
          />
          <Scatter
            data={data}
            isAnimationActive={false}
            onClick={(d: any) => d?.payload?.id && onSelect?.(d.payload.id)}
            shape={(props: any) => {
              const isSel = props.payload.id === selected;
              return (
                <g style={{ cursor: 'pointer' }}>
                  <circle cx={props.cx} cy={props.cy} r={isSel ? 10 : 7} fill={props.payload.color} fillOpacity={0.9} stroke={isSel ? '#fff' : 'rgba(0,0,0,0.4)'} strokeWidth={isSel ? 2 : 1} />
                  <text x={props.cx} y={props.cy - 12} textAnchor="middle" fill="#cbd5e1" fontSize={9}>
                    {props.payload.name.split(' ')[0]}
                  </text>
                </g>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

const BLIP: Record<string, string> = { safe: '#34d399', low: '#38bdf8', medium: '#fbbf24', high: '#fb7185' };

export function RadarView({ devices, selectedId, onSelect, active, center }: { devices: NearbyDevice[]; selectedId?: string | null; onSelect: (id: string) => void; active: boolean; center?: ReactNode }) {
  const size = 300;
  const R = size / 2;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[310px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="radarBg">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </radialGradient>
        </defs>
        <circle cx={R} cy={R} r={R - 2} fill="url(#radarBg)" stroke="rgba(56,189,248,0.3)" />
        {[0.28, 0.55, 0.8].map((f) => (
          <circle key={f} cx={R} cy={R} r={(R - 2) * f} fill="none" stroke="rgba(56,189,248,0.16)" strokeDasharray="3 5" />
        ))}
        <line x1={R} y1={4} x2={R} y2={size - 4} stroke="rgba(56,189,248,0.1)" />
        <line x1={4} y1={R} x2={size - 4} y2={R} stroke="rgba(56,189,248,0.1)" />
        <text x={R + 4} y={R - (R - 2) * 0.28 + 11} fill="rgba(148,163,184,0.7)" fontSize="9">~1m</text>
        <text x={R + 4} y={R - (R - 2) * 0.55 + 11} fill="rgba(148,163,184,0.7)" fontSize="9">~5m</text>
        <text x={R + 4} y={R - (R - 2) * 0.8 + 11} fill="rgba(148,163,184,0.7)" fontSize="9">~15m</text>
      </svg>
      {active && <div className="radar-sweep pointer-events-none absolute inset-[1%] rounded-full" />}
      {devices.map((d) => {
        const rr = clamp((-d.rssi - 32) / 66, 0.1, 0.95) * (R - 8);
        const a = (d.angle * Math.PI) / 180;
        const x = R + rr * Math.cos(a);
        const y = R + rr * Math.sin(a);
        const sel = d.id === selectedId;
        const col = BLIP[d.risk];
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            aria-label={d.name || d.label || 'Device'}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 p-2 transition-[left,top] duration-1000 ease-out"
            style={{ left: `${(x / size) * 100}%`, top: `${(y / size) * 100}%` }}
          >
            <span className="relative flex h-3 w-3 items-center justify-center">
              {(d.risk === 'high' || sel) && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: col }} />}
              <span className={cn('relative inline-flex rounded-full', sel ? 'h-3.5 w-3.5 ring-2 ring-white' : 'h-2.5 w-2.5')} style={{ background: col, boxShadow: `0 0 10px ${col}` }} />
            </span>
          </button>
        );
      })}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        {center ?? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/20 text-sky-200 ring-2 ring-sky-400/40">
            <Smartphone size={20} />
          </span>
        )}
      </div>
    </div>
  );
}

export function ProximityMeter({ rssi }: { rssi: number }) {
  const p = clamp((rssi + 95) / 60, 0, 1);
  const label = p > 0.8 ? 'Hot! Right next to you' : p > 0.6 ? 'Warm — very close' : p > 0.4 ? 'Lukewarm — getting closer' : p > 0.2 ? 'Cool — far away' : 'Freezing — very far';
  const color = p > 0.8 ? '#fb7185' : p > 0.6 ? '#fb923c' : p > 0.4 ? '#fbbf24' : p > 0.2 ? '#38bdf8' : '#64748b';
  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="pulse-ring absolute inset-0 rounded-full border-2" style={{ borderColor: color, animationDelay: `${i * 0.6}s`, animationDuration: `${2.4 - p * 1.6}s` }} />
        ))}
        <span className="relative flex items-center justify-center rounded-full transition-all duration-500" style={{ width: 70 + p * 80, height: 70 + p * 80, background: `${color}33`, boxShadow: `0 0 40px ${color}55` }}>
          <span className="text-3xl font-extrabold tabular-nums text-white">{Math.round(p * 100)}%</span>
        </span>
      </div>
      <div className="mt-2 text-base font-semibold" style={{ color }}>
        {label}
      </div>
      <div className="text-xs text-slate-400">Signal: {Math.round(rssi)} dBm</div>
    </div>
  );
}

export function RingProgress({ value, max, size = 64, color = '#38bdf8', children }: { value: number; max: number; size?: number; color?: string; children?: ReactNode }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - (max ? value / max : 0));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
