import { useEffect, useMemo, useState } from "react";

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total milliseconds remaining (0 when target passed). */
  remaining: number;
  expired: boolean;
}

/**
 * Ticking countdown to `target` (epoch ms). Returns all-zero parts once the
 * target passes. Pauses ticking under prefers-reduced-motion (the initial
 * snapshot still renders) so screen readers and reduced-motion users get a
 * stable value instead of a 1 Hz mutation stream.
 */
export function useCountdown(target: number | null): CountdownParts {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    // prefers-reduced-motion: refresh at 1/min instead of 1 Hz so the value
    // stays accurate without a constant mutation stream. Regular motion
    // keeps the second-level tick.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const step = mq.matches ? 60_000 : 1000;
    const t = window.setInterval(() => setNow(Date.now()), step);
    return () => window.clearInterval(t);
  }, [target]);

  const parts = useMemo(() => {
    const remaining = target ? Math.max(0, target - now) : 0;
    return {
      days: Math.floor(remaining / 86_400_000),
      hours: Math.floor((remaining % 86_400_000) / 3_600_000),
      minutes: Math.floor((remaining % 3_600_000) / 60_000),
      seconds: Math.floor((remaining % 60_000) / 1000),
      remaining,
      expired: !!target && target <= now,
    };
  }, [target, now]);

  return parts;
}

/** "3d 04h 12m 05s" style label — used for aria-live summaries. */
export function countdownLabel(p: CountdownParts): string {
  const units: Array<[number, string]> = [
    [p.days, "d"],
    [p.hours, "h"],
    [p.minutes, "m"],
    [p.seconds, "s"],
  ];
  const first = units.findIndex(([v]) => v > 0);
  const slice = first === -1 ? units.slice(-2) : units.slice(first);
  return slice.map(([v, u]) => `${v}${u}`).join(" ");
}

export function formatStardate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
