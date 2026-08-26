import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

type GlowAccent = "cyan" | "violet" | "amber" | "magenta" | "green";

const ACCENT_BORDERS: Record<GlowAccent, string> = {
  cyan: "border-[rgba(0,229,255,0.35)] shadow-[0_0_24px_rgba(0,229,255,0.12)]",
  violet: "border-[rgba(139,92,246,0.35)] shadow-[0_0_24px_rgba(139,92,246,0.12)]",
  amber: "border-[rgba(255,179,0,0.35)] shadow-[0_0_24px_rgba(255,179,0,0.12)]",
  magenta: "border-[rgba(255,61,242,0.35)] shadow-[0_0_24px_rgba(255,61,242,0.12)]",
  green: "border-[rgba(45,255,136,0.35)] shadow-[0_0_24px_rgba(45,255,136,0.12)]",
};

// ---------------------------------------------------------------------------
// Shared base props
// ---------------------------------------------------------------------------
interface PanelProps {
  id?: string;
  className?: string;
  children?: ReactNode;
  accent?: GlowAccent;
  reveal?: boolean;
  style?: React.CSSProperties;
  /** Additional HTML attributes — forwarded to the root element */
  htmlProps?: Record<string, any>;
}

// ============================================================================

export function GlassPanel({
  className,
  children,
  accent,
  reveal,
  style,
  htmlProps,
}: PanelProps) {
  const ref = useScrollReveal<HTMLDivElement>({ staggerIndex: 0 });

  return (
    <div
      ref={reveal ? ref : undefined}
      className={cn(
        "uf-panel",
        accent && ACCENT_BORDERS[accent],
        reveal && "uf-reveal",
        className,
      )}
      style={style}
      {...htmlProps}
    >
      {children}
    </div>
  );
}

// ============================================================================

interface HoloCardProps extends PanelProps {
  as?: "div" | "section" | "article" | "li";
  glow?: boolean;
  staggerIndex?: number;
}

export function HoloCard({
  as: As = "div",
  className,
  children,
  accent,
  glow = false,
  reveal,
  staggerIndex,
  style,
  htmlProps,
}: HoloCardProps) {
  const ref = useScrollReveal<HTMLElement>({ staggerIndex });

  return (
    <As
      ref={reveal ? ref : undefined}
      className={cn(
        "uf-card",
        glow && "uf-card--glow",
        accent && ACCENT_BORDERS[accent],
        reveal && "uf-reveal",
        className,
      )}
      style={style}
      {...(htmlProps as any)}
    >
      {children}
    </As>
  );
}

// ============================================================================

interface FeatureCardProps {
  className?: string;
  children: ReactNode;
  image?: string;
  overlay?: ReactNode;
  accent?: GlowAccent;
  reveal?: boolean;
}

export function FeatureCard({
  className,
  children,
  image,
  overlay,
  accent = "cyan",
  reveal,
}: FeatureCardProps) {
  const ref = useScrollReveal<HTMLDivElement>({ staggerIndex: 0 });

  return (
    <div
      ref={reveal ? ref : undefined}
      className={cn(
        "relative overflow-hidden rounded-[16px] border",
        ACCENT_BORDERS[accent],
        "bg-[rgba(16,24,39,0.55)]",
        reveal && "uf-reveal",
        className,
      )}
    >
      {image && (
        <div className="relative h-48 md:h-56 overflow-hidden">
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,8,22,0.8)] to-transparent" />
          {overlay && <div className="absolute inset-0">{overlay}</div>}
        </div>
      )}
      <div className="p-5 md:p-6">{children}</div>
    </div>
  );
}

// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: GlowAccent;
  className?: string;
}

export function StatCard({
  label,
  value,
  accent = "cyan",
  className,
}: StatCardProps) {
  const accentColor =
    accent === "cyan"
      ? "var(--uf-cyan)"
      : accent === "violet"
        ? "var(--uf-violet)"
        : accent === "amber"
          ? "var(--uf-amber)"
          : accent === "magenta"
            ? "var(--uf-magenta)"
            : "var(--uf-green)";

  return (
    <div
      className={cn(
        "rounded-md border p-3 bg-[rgba(16,24,39,0.55)]",
        className,
      )}
      style={{ borderColor: "rgba(0, 229, 255, 0.18)" }}
    >
      <span
        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]"
        style={{ color: accentColor }}
      >
        {label}
      </span>
      <p
        className="font-mono text-2xl font-semibold mt-1 tabular-nums"
        style={{ color: accentColor }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
