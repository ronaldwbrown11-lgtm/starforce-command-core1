import { useMemo } from "react";
import { cn } from "@/lib/utils";

const FLEET_HUES = [
  "var(--uf-cyan)",
  "var(--uf-violet)",
  "var(--uf-gold)",
  "var(--uf-magenta)",
  "var(--uf-green)",
  "var(--uf-red)",
];

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function FleetAffiliation({
  fleet,
  compact = false,
  className,
}: {
  fleet: string;
  compact?: boolean;
  className?: string;
}) {
  const hue = useMemo(
    () => FLEET_HUES[hash(fleet) % FLEET_HUES.length],
    [fleet],
  );
  const initials = fleet
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2 py-0.5 text-xs",
        className,
      )}
      title={`Fleet affiliation: ${fleet}`}
      style={{ borderColor: hue, color: hue }}
    >
      <span
        aria-hidden
        className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[10px] font-semibold tracking-wider"
        style={{ background: hue, color: "#001018" }}
      >
        {initials || "—"}
      </span>
      {!compact ? <span>{fleet}</span> : null}
    </span>
  );
}
