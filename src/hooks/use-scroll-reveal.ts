import { useEffect, useRef, useState, createElement } from "react";
import type { ReactNode } from "react";

/**
 * Scroll-based reveal hook. Adds `uf-reveal--visible` when element enters
 * the viewport. Supports staggered delays via `staggerIndex`.
 *
 * Usage:
 * ```tsx
 * const ref = useScrollReveal<HTMLDivElement>({ staggerIndex: 1 });
 * <div ref={ref} className="uf-reveal uf-reveal-stagger-1" />
 * ```
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.1,
  rootMargin = "0px 0px -40px 0px",
  staggerIndex,
}: {
  threshold?: number;
  rootMargin?: string;
  staggerIndex?: number;
} = {}) {
  const ref = useRef<T>(null);
  const [, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (staggerIndex !== undefined && staggerIndex >= 0) {
      el.classList.add(`uf-reveal-stagger-${Math.min(staggerIndex + 1, 6)}`);
    }

    let observer: IntersectionObserver | null = null;
    let failTimer = 0;
    let revealed = false;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      setVisible(true);
      el.classList.add("uf-reveal--visible");
      observer?.disconnect();
      observer = null;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(failTimer);
    };

    const inViewport = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Matches the observer's `0px 0px -40px 0px` rootMargin.
      return rect.top < vh - 40 && rect.bottom > 0;
    };

    const onScroll = () => {
      if (inViewport()) reveal();
    };

    // Immediate check — elements already in the viewport reveal right away.
    // This covers cases where the IntersectionObserver callback never fires,
    // e.g. inside scaled/transformed preview iframes where the observer's
    // intersection math breaks down. Content must never stay invisible.
    if (inViewport()) {
      reveal();
      return;
    }

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) reveal();
        },
        { threshold, rootMargin },
      );
      observer.observe(el);
    }

    // Scroll/resize fallback in case the observer never fires.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // Safety net 1: if the element is in view but still hidden after 1.5s
    // (observer stalled, scroll events missed), force it visible.
    failTimer = window.setTimeout(() => {
      if (inViewport()) reveal();
    }, 1500);

    // Safety net 2: unconditional reveal after 6s. Content must never stay
    // hidden — scroll-triggered animation is a flourish, visibility is the
    // requirement. Most elements reveal via scroll/observer long before this.
    const hardNet = window.setTimeout(() => {
      reveal();
    }, 6000);
    const hardNetId = hardNet;

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(failTimer);
      window.clearTimeout(hardNetId);
    };
  }, [threshold, rootMargin, staggerIndex]);

  return ref;
}

// ---- Component helpers — use React.createElement to avoid JSX in TS files ------

interface RevealProps {
  children: ReactNode;
  className?: string;
  staggerIndex?: number;
  as?: keyof React.JSX.IntrinsicElements;
  [key: string]: unknown;
}

/**
 * Scroll-triggered fade-in block. Reveals content with a translateY fade-in
 * animation when it enters the viewport.
 */
export function ScrollReveal({
  children,
  className = "",
  staggerIndex,
  as: Tag = "div",
  ...rest
}: RevealProps) {
  const ref = useScrollReveal<HTMLElement>({ staggerIndex });
  return createElement(
    Tag,
    { ref, className: `uf-reveal ${className}`, ...rest },
    children,
  );
}

/**
 * Scroll-triggered scale-in block. Fades in with a scale(0.92) pop.
 */
export function ScaleReveal({
  children,
  className = "",
  staggerIndex,
  as: Tag = "div",
  ...rest
}: RevealProps) {
  const ref = useScrollReveal<HTMLElement>({ staggerIndex });
  return createElement(
    Tag,
    { ref, className: `uf-reveal-scale ${className}`, ...rest },
    children,
  );
}
