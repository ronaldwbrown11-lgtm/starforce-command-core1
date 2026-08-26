import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { VOICE } from "@/lib/voice";

/**
 * Subtle corner badge anchored to the operator dashboard bottom-right.
 * Reads `FleetStatus` live for the current overall state. Reduced-motion friendly.
 */
export function EasterEggBadge() {
  const status = useQuery(api.operator.systemHealth);
  const [tick, setTick] = useState(false);
  useEffect(() => {
    setTick(true);
    const id = window.setTimeout(() => setTick(false), 800);
    return () => window.clearTimeout(id);
  }, [status?.overall]);

  const overall = status?.overall ?? "syncing";
  const variant = overall === "operational"
    ? "ok"
    : overall === "degraded"
      ? "warning"
      : overall === "down"
        ? "danger"
        : "syncing";

  const color =
    variant === "ok"
      ? "var(--uf-green)"
      : variant === "warning"
        ? "var(--uf-gold)"
        : variant === "danger"
          ? "var(--uf-red)"
          : "var(--uf-cyan)";

  return (
    <div
      role="status"
      aria-live="polite"
      className="easter-egg-badge"
      data-uf-widget="easter-egg-badge"
      style={{
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        zIndex: 50,
      }}
    >
      <span
        className="uf-panel"
        style={{
          padding: "0.5rem 0.75rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.75rem",
          borderRadius: "999px",
          color,
          boxShadow: tick ? `0 0 18px ${color}` : undefined,
          transition: "box-shadow 240ms var(--uf-ease-out)",
        }}
        title={overall}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
        <span style={{ fontFamily: "var(--uf-font-display)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
          {VOICE.easterEgg}
        </span>
        <span style={{ color }}>·</span>
        <span style={{ color: "var(--uf-muted)" }}>{overall}</span>
      </span>
    </div>
  );
}
