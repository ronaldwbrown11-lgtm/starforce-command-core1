import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type ParallaxSpeed = "slow" | "medium" | "fast";

const SPEED_MAP: Record<ParallaxSpeed, number> = {
  slow: 0.08,
  medium: 0.16,
  fast: 0.28,
};

/**
 * Wraps children in a parallax container that shifts vertically
 * based on scroll position. Each section moves at its own speed.
 *
 * Usage:
 *   <ParallaxSection speed="slow">
 *     <div>This moves slowly</div>
 *   </ParallaxSection>
 */
export function ParallaxSection({
  children,
  className,
  speed = "medium",
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  speed?: ParallaxSpeed;
  direction?: "up" | "down";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const multiplier = SPEED_MAP[speed] * (direction === "down" ? -1 : 1);
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [`${multiplier * 60}%`, `${-multiplier * 60}%`],
  );
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.6, 1, 1, 0.6]);

  return (
    <motion.div
      ref={ref}
      className={cn("relative", className)}
      style={{ y, opacity }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A subtle float-in section: fades and slides up into view as it enters the viewport.
 * Pure CSS-free scroll reveal — good for card grids, feature blocks, CTA strips.
 */
export function RevealSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });

  const y = useTransform(scrollYProgress, [0, 0.3], [40, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.3], [0.97, 1]);

  return (
    <motion.div
      ref={ref}
      className={cn("relative", className)}
      style={{
        y,
        opacity,
        scale,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </motion.div>
  );
}
