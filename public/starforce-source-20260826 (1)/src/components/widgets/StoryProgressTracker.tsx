import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";

/**
 * Tracks how much of an article the reader has scrolled past,
 * debounces saves to Convex, exposes an accessible <progress> bar.
 */
export function StoryProgressTracker({
  storyId,
  targetRef,
  autoSaveMs = 5000,
}: {
  storyId: Id<"stories">;
  targetRef: React.RefObject<HTMLElement | null>;
  autoSaveMs?: number;
}) {
  const [pct, setPct] = useState(0);
  const [hidden, setHidden] = useState(false);
  const track = useMutation(api.social.trackStoryProgress);
  const existing = useQuery(api.social.getStoryProgress, { storyId });
  const lastSavedPct = useRef(0);
  const lastPostedAt = useRef(0);

  // Hydrate from server
  useEffect(() => {
    if (existing?.percent != null) {
      setPct((prev) => Math.max(prev, existing.percent));
      lastSavedPct.current = Math.max(lastSavedPct.current, existing.percent);
    }
  }, [existing?.percent]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // How much of the article has scrolled above the bottom of the viewport.
      const visibleFromBottom = Math.max(0, vh - rect.top);
      const next = Math.min(
        100,
        Math.max(0, Math.round((visibleFromBottom / Math.max(1, rect.height)) * 100)),
      );
      // Monotonic: never regress (covers "scrolling back up").
      const merged = Math.max(lastSavedPct.current, pct, next);
      if (merged !== pct) setPct(merged);

      const now = Date.now();
      const changed = merged - lastSavedPct.current;
      const due = now - lastPostedAt.current > autoSaveMs;
      if (!reduce && !hidden && due && changed >= 2) {
        lastSavedPct.current = merged;
        lastPostedAt.current = now;
        track({ storyId, percent: merged }).catch(() => {
          // Offline / not signed in — silently skip; will retry on next scroll.
        });
      }
    };

    if (reduce) {
      // One-shot snapshot for reduced-motion users. We deliberately don't wire scroll.
      compute();
      return;
    }

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    compute(); // initial
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, hidden, autoSaveMs, targetRef]);

  const label = pct >= 100 ? "Mission complete" : pct > 0 ? "Continue reading" : "Begin reading";
  const variant: "info" | "success" = pct >= 100 ? "success" : "info";

  return (
    <section
      aria-label="Story reading progress"
      className="uf-panel p-4"
      data-uf-widget="story-progress"
    >
      <div className="flex items-center justify-between mb-2 gap-3">
        <span className="uf-eyebrow">Reading progress</span>
        <StatusPill variant={variant} aria-live="polite">
          {label}
        </StatusPill>
      </div>
      <div
        className="uf-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Reading progress: ${pct}%`}
      >
        <div className="uf-progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-uf-muted mt-2">
        Auto-saves as you scroll. {hidden ? "Updates paused while tab is hidden." : null}
      </p>
    </section>
  );
}
