import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Soft panel shadow used across surfaces (mockup: 0 10px 27px rgba(7,26,51,.07)). */
export const softShadow = "shadow-[0_10px_27px_rgba(7,26,51,0.07)]";

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[18px] border border-line bg-card",
        softShadow,
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function PanelHead({
  title,
  subtitle,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 pb-3.5 pt-5">
      <div>
        <h2 className="font-serif text-[23px] leading-tight text-navy">{title}</h2>
        {subtitle && <div className="mt-1 text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {aside}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-brand-red/10 px-2.5 py-1.5 text-[10px] font-extrabold text-brand-red",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("text-[11px] font-black uppercase tracking-[0.18em] text-brand-red", className)}
    >
      {children}
    </div>
  );
}

export function MiniLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type Tone = "green" | "amber" | "blue" | "red" | "navy";
const toneClasses: Record<Tone, string> = {
  green: "bg-edge/10 text-edge",
  amber: "bg-brand-amber/10 text-brand-amber",
  blue: "bg-brand-blue/10 text-brand-blue",
  red: "bg-brand-red/10 text-brand-red",
  navy: "bg-navy/10 text-navy",
};

export function Tag({
  tone = "green",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[9px] font-black uppercase",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Grade({
  value,
  hot = false,
  className,
}: {
  value: ReactNode;
  hot?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-[58px] place-items-center rounded-[10px] px-2.5 py-2 font-black text-white",
        hot ? "bg-brand-red" : "bg-navy",
        className,
      )}
    >
      {value}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  noteTone = "green",
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  noteTone?: "green" | "muted";
}) {
  return (
    <article className={cn("rounded-[18px] border border-line bg-card p-4", softShadow)}>
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-serif text-[27px] font-black text-navy">{value}</div>
      {note && (
        <div
          className={cn(
            "mt-0.5 text-[11px] font-bold",
            noteTone === "green" ? "text-edge" : "text-muted-foreground",
          )}
        >
          {note}
        </div>
      )}
    </article>
  );
}

export function ScoreRing({ score, max = 250 }: { score: number; max?: number }) {
  const frac = Math.min(Math.max(score / max, 0), 1);
  const deg = frac * 360;
  return (
    <div
      className="relative mx-auto my-1 grid h-[124px] w-[124px] place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--brand-red) 0 ${deg}deg, color-mix(in oklch, var(--navy) 12%, transparent) ${deg}deg)`,
      }}
    >
      <div className="absolute h-[94px] w-[94px] rounded-full bg-card" />
      <strong className="relative z-10 font-serif text-[31px] text-navy">{score}</strong>
    </div>
  );
}

export function Explanation({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-r-[10px] border-l-[3px] border-gold bg-gold/10 px-3 py-2.5 text-[11px] leading-relaxed text-foreground/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  copy?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-1 font-serif text-[28px] text-navy">{title}</h2>
        {copy && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{copy}</p>}
      </div>
      {action}
    </div>
  );
}

/** Data row used in lineage / health / registry lists. */
export function DataRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-[11px] bg-soft px-2.5 py-2.5 text-[11px]">
      <b className="text-navy">{label}</b>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

export type BtnVariant = "primary" | "secondary" | "ghost";
const btnClasses: Record<BtnVariant, string> = {
  primary: "bg-brand-red text-white shadow-[0_8px_20px_rgba(201,31,55,0.24)]",
  secondary: "bg-navy/8 text-navy border border-line",
  ghost: "bg-card text-navy border border-line",
};

export const Btn = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }
>(function Btn({ variant = "primary", className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-extrabold transition hover:-translate-y-px hover:brightness-105 disabled:pointer-events-none disabled:opacity-60",
        btnClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Horizontal labeled bar (feature importance, distributions). */
export function BarRow({
  label,
  value,
  width,
  tone = "navy",
}: {
  label: ReactNode;
  value: ReactNode;
  width: number;
  tone?: "navy" | "red";
}) {
  return (
    <div className="grid grid-cols-[110px_1fr_46px] items-center gap-2.5 text-[10px]">
      <span className="text-foreground/80">{label}</span>
      <div className="h-[9px] overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--navy)_10%,transparent)]">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "navy"
              ? "bg-gradient-to-r from-navy to-brand-blue"
              : "bg-gradient-to-r from-brand-red to-gold",
          )}
          style={{ width: `${Math.min(Math.max(width, 0), 100)}%` }}
        />
      </div>
      <strong className="text-right text-navy">{value}</strong>
    </div>
  );
}
