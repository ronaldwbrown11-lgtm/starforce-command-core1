import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { type AchievementCatalogEntry, getAchievement } from "@/lib/achievements";

// Prestige medallion styling — one palette per achievement tone.
// Each medallion is a dark glass disc wrapped in a conic-gradient ring,
// with HUD corner brackets, an inner radial "engine glow", and a neon
// drop-shadow on the icon for a high-end aerospace-badge look.
type ToneStyle = {
  ring: string; // conic gradient for the outer ring
  glow: string; // outer + inner shadow
  text: string; // icon + label color
  wash: string; // inner radial face wash
  accent: string; // HUD bracket color
};

const TONE_STYLE: Record<string, ToneStyle> = {
  cyan: {
    ring: "conic-gradient(from 210deg, #00e5ff, #2563eb 45%, #00e5ff 80%, #00e5ff)",
    glow: "0 0 22px rgba(0,229,255,0.35), inset 0 0 14px rgba(0,229,255,0.16)",
    text: "var(--uf-cyan)",
    wash: "radial-gradient(circle at 32% 28%, rgba(0,229,255,0.26), rgba(4,9,18,0.92) 68%)",
    accent: "var(--uf-cyan)",
  },
  violet: {
    ring: "conic-gradient(from 210deg, #8b5cf6, #d946ef 45%, #8b5cf6 80%, #8b5cf6)",
    glow: "0 0 22px rgba(139,92,246,0.38), inset 0 0 14px rgba(139,92,246,0.16)",
    text: "var(--uf-violet)",
    wash: "radial-gradient(circle at 32% 28%, rgba(139,92,246,0.28), rgba(10,6,20,0.92) 68%)",
    accent: "var(--uf-violet)",
  },
  gold: {
    ring: "conic-gradient(from 210deg, #e6a817, #ffb300 45%, #e6a817 80%, #e6a817)",
    glow: "0 0 22px rgba(230,168,23,0.42), inset 0 0 14px rgba(230,168,23,0.18)",
    text: "var(--uf-gold)",
    wash: "radial-gradient(circle at 32% 28%, rgba(230,168,23,0.28), rgba(16,10,2,0.94) 68%)",
    accent: "var(--uf-gold)",
  },
  green: {
    ring: "conic-gradient(from 210deg, #2dff88, #14b8a6 45%, #2dff88 80%, #2dff88)",
    glow: "0 0 22px rgba(45,255,136,0.35), inset 0 0 14px rgba(45,255,136,0.15)",
    text: "var(--uf-green)",
    wash: "radial-gradient(circle at 32% 28%, rgba(45,255,136,0.22), rgba(4,12,10,0.92) 68%)",
    accent: "var(--uf-green)",
  },
};

export function AchievementBadges({
  ids,
  displayName,
  max = 8,
  className,
}: {
  ids: string[];
  displayName?: string;
  max?: number;
  className?: string;
}) {
  const items = useMemo(() => {
    const out: Array<{ id: string; entry: AchievementCatalogEntry }> = [];
    for (const id of ids) {
      const entry = getAchievement(id);
      if (entry) out.push({ id, entry });
      if (out.length >= max) break;
    }
    return out;
  }, [ids, max]);

  if (!items.length) {
    return (
      <p className="text-uf-muted text-xs">
        No achievements earned yet — the rack is bare.
      </p>
    );
  }

  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-5 gap-y-7 list-none p-0 m-0",
        className,
      )}
      aria-label={
        displayName ? `Achievements for ${displayName}` : "Achievements"
      }
    >
      {items.map(({ id, entry }) => {
        const Icon = entry.icon;
        const style = TONE_STYLE[entry.tone] ?? TONE_STYLE.cyan;
        return (
          <li key={id}>
            <div
              className="group flex w-[100px] flex-col items-center gap-2.5"
              title={entry.description}
            >
              {/* Medallion + HUD corner brackets */}
              <div className="relative">
                {/* Corner brackets */}
                <span
                  aria-hidden
                  className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-[3px] transition-colors duration-300 group-hover:brightness-150"
                  style={{
                    borderTop: `2px solid ${style.accent}`,
                    borderLeft: `2px solid ${style.accent}`,
                    opacity: 0.85,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-[3px] transition-colors duration-300 group-hover:brightness-150"
                  style={{
                    borderTop: `2px solid ${style.accent}`,
                    borderRight: `2px solid ${style.accent}`,
                    opacity: 0.85,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-[3px] transition-colors duration-300 group-hover:brightness-150"
                  style={{
                    borderBottom: `2px solid ${style.accent}`,
                    borderLeft: `2px solid ${style.accent}`,
                    opacity: 0.85,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-[3px] transition-colors duration-300 group-hover:brightness-150"
                  style={{
                    borderBottom: `2px solid ${style.accent}`,
                    borderRight: `2px solid ${style.accent}`,
                    opacity: 0.85,
                  }}
                />

                {/* Ring + face */}
                <div
                  className="h-[84px] w-[84px] rounded-full p-[3px] transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-[1.05]"
                  style={{ background: style.ring, boxShadow: style.glow }}
                >
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[rgba(6,10,18,0.94)]">
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{ background: style.wash }}
                    />
                    <span
                      aria-hidden
                      className="absolute inset-[3px] rounded-full"
                      style={{
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)",
                      }}
                    />
                    <Icon
                      className="relative h-9 w-9 transition-transform duration-300 group-hover:scale-110"
                      style={{
                        color: style.text,
                        filter: `drop-shadow(0 0 10px ${style.text})`,
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>

              {/* Label */}
              <span
                className="text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.14em]"
                style={{ color: style.text }}
              >
                {entry.label}
              </span>
              <span className="sr-only">{entry.description}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
