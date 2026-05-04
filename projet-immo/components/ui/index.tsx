'use client';
import { clsx } from 'clsx';
import { ReactNode } from 'react';

export function Button({
  children, onClick, type = 'button', variant = 'primary', disabled = false, className = '', fullWidth = false,
}: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean; className?: string; fullWidth?: boolean;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm';
  const variants = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    ghost: 'hover:bg-slate-100 text-slate-600',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={clsx(base, variants[variant], fullWidth && 'w-full', className)}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', padding = true }: { children: ReactNode; className?: string; padding?: boolean }) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-slate-200 shadow-sm', padding && 'p-6', className)}>
      {children}
    </div>
  );
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'green' | 'blue' | 'amber' | 'red' | 'violet' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-brand-100 text-brand-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  return <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', colors[color])}>{children}</span>;
}

export function ScoreBar({ score, colorThreshold = [40, 60] }: { score: number; colorThreshold?: [number, number] }) {
  const color = score >= colorThreshold[1] ? 'bg-green-500' : score >= colorThreshold[0] ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className={clsx('h-2 rounded-full transition-all duration-700', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function FactorRow({ label, impact, description }: { label: string; impact: number; description: string }) {
  const positive = impact > 0;
  const neutral = impact === 0;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className={clsx('text-xs font-bold min-w-[36px] text-right', positive ? 'text-green-600' : neutral ? 'text-slate-400' : 'text-red-500')}>
        {impact > 0 ? '+' : ''}{impact}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function SliderInput({
  label, value, min, max, step = 1, onChange, format, hint,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format: (v: number) => string; hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="font-mono text-sm font-bold text-slate-900">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ background: `linear-gradient(to right, #0ea5e9 ${pct}%, #e2e8f0 ${pct}%)` }}
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
