import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type StarfieldProps = {
  className?: string;
  density?: "low" | "medium" | "high";
  hue?: "cyan" | "violet" | "mixed";
  /** Paint the translucent cyan/violet gradient wash behind the stars. */
  wash?: boolean;
};

const DENSITY_MAP: Record<NonNullable<StarfieldProps["density"]>, number> = {
  low: 0.00006,
  medium: 0.00012,
  high: 0.0002,
};

/**
 * Animated starfield background. Two layers (slow/fast) for parallax.
 * Disabled when prefers-reduced-motion is set.
 */
export function Starfield({
  className,
  density = "medium",
  hue = "mixed",
  wash = true,
}: StarfieldProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Static frame only
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = w;
      canvas.height = h;
      if (wash) {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "rgba(0,229,255,0.10)");
        grad.addColorStop(1, "rgba(139,92,246,0.08)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      return;
    }

    let raf = 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      w = (parent?.clientWidth ?? window.innerWidth);
      h = (parent?.clientHeight ?? window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const total = Math.floor(w * h * DENSITY_MAP[density]);
    const stars = Array.from({ length: total }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      v: Math.random() * 0.4 + 0.1,
      o: Math.random() * 0.6 + 0.2,
      twinkle: Math.random() * 0.02 + 0.005,
      t: 0,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (wash) {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        if (hue === "cyan") {
          grad.addColorStop(0, "rgba(0,229,255,0.12)");
          grad.addColorStop(1, "rgba(11,18,32,0.0)");
        } else if (hue === "violet") {
          grad.addColorStop(0, "rgba(139,92,246,0.14)");
          grad.addColorStop(1, "rgba(11,18,32,0.0)");
        } else {
          grad.addColorStop(0, "rgba(0,229,255,0.08)");
          grad.addColorStop(1, "rgba(139,92,246,0.10)");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      for (const s of stars) {
        s.y += s.v;
        if (s.y > h) {
          s.y = -2;
          s.x = Math.random() * w;
        }
        s.t += s.twinkle;
        const a = s.o * (0.7 + Math.sin(s.t) * 0.3);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hue === "violet" ? "180,160,255" : "200,240,255"}, ${a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density, hue, wash]);

  return <canvas ref={ref} aria-hidden="true" className={cn("uf-starfield", className)} />;
}
