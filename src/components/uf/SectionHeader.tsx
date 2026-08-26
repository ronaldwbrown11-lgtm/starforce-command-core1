import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
  align = "left",
  icon,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
  /** Optional adornment rendered before the eyebrow. */
  icon?: ReactNode;
  /** Optional adornment rendered on the right side of the row. */
  action?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex items-end justify-between gap-4 mb-8",
        align === "center" ? "flex-col items-center text-center" : "flex-row",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          align === "center" ? "flex-col" : "flex-row",
        )}
      >
        {icon ? (
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.55)] text-uf-muted"
          >
            {icon}
          </span>
        ) : null}
        <div
          className={cn(
            "flex flex-col gap-1.5",
            align === "center" ? "items-center" : "items-start",
          )}
        >
          {eyebrow ? <span className="uf-eyebrow">{eyebrow}</span> : null}
          <h2 className="text-3xl md:text-4xl font-semibold">{title}</h2>
          {description ? (
            <p className="text-uf-muted max-w-2xl text-sm md:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
