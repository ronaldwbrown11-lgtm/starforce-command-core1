import { useRef } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { Starfield } from "./Starfield";
import { NeonButton } from "./NeonButton";

type CTA = { label: string; href: string; variant?: "default" | "primary" | "violet" | "ghost" };

export function PageHero({
  eyebrow,
  title,
  lead,
  primary,
  secondary,
  align = "left",
  withStarfield = true,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  primary?: CTA;
  secondary?: CTA;
  align?: "left" | "center";
  withStarfield?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Parallax: content drifts up slightly, opacity fades at edges
  const contentY = useTransform(scrollYProgress, [0, 0.4, 1], ["0%", "-8%", "-20%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0.85, 0.35]);
  // Background layers move faster than content
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "-35%"]);

  return (
    <section
      ref={ref}
      className={cn(
        "relative overflow-hidden",
        "py-20 md:py-28 lg:py-36 px-4 sm:px-6 lg:px-12",
        className,
      )}
      aria-labelledby="uf-hero-title"
    >
      {withStarfield ? <Starfield hue="mixed" density="medium" /> : null}
      <motion.div
        className="uf-parallax"
        aria-hidden="true"
        style={{ y: bgY }}
      />
      <a href="#uf-main" className="uf-skip-link">Skip to content</a>
      <motion.div
        className={cn(
          "relative z-10 max-w-4xl",
          align === "center" ? "mx-auto text-center" : "text-left",
        )}
        style={{ y: contentY, opacity: contentOpacity }}
      >
        {eyebrow ? <span className="uf-eyebrow">{eyebrow}</span> : null}
        <h1
          id="uf-hero-title"
          className="mt-3 mb-4 text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.1]"
        >
          {title}
        </h1>
        {lead ? (
          <p className="text-uf-muted text-base md:text-lg max-w-2xl mb-8">
            {lead}
          </p>
        ) : null}
        {(primary || secondary) && (
          <div
            className={cn(
              "flex flex-wrap gap-3",
              align === "center" ? "justify-center" : "justify-start",
            )}
          >
            {primary && (
              <Link to={primary.href}>
                <NeonButton variant={primary.variant ?? "primary"}>
                  {primary.label}
                </NeonButton>
              </Link>
            )}
            {secondary && (
              <NeonButton
                variant={secondary.variant ?? "ghost"}
                onClick={() => {
                  if (secondary.href.startsWith("#")) {
                    document
                      .getElementById(secondary.href.slice(1))
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    return;
                  }
                  navigate(secondary.href);
                }}
              >
                {secondary.label}
              </NeonButton>
            )}
          </div>
        )}
      </motion.div>
    </section>
  );
}
