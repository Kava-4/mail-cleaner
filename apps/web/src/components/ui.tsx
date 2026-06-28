import type { ReactNode } from "react";

const variants = {
  primary:
    "bg-zinc-200/90 text-zinc-950 hover:bg-white border border-white/20 shadow-lg shadow-black/20",
  danger:
    "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/25 backdrop-blur-sm",
  ghost:
    "border border-white/8 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] backdrop-blur-sm",
  subtle:
    "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 backdrop-blur-sm",
  accent:
    "border border-zinc-400/20 bg-zinc-400/10 text-zinc-200 hover:bg-zinc-400/15 backdrop-blur-sm",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
} as const;

export function Button({
  children,
  variant = "ghost",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm ${className}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="glass p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="glass-strong fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl p-4 md:inset-x-auto">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium text-zinc-200">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-zinc-300 transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="glass-strong fixed right-4 top-20 z-50 max-w-sm px-4 py-3 text-sm text-zinc-200">
      {message}
    </div>
  );
}
