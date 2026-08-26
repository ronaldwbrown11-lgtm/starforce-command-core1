import { useMemo } from "react";
import { achievementToneColor, getAchievement } from "@/lib/achievements";

// Compact badge rack for bylines and comment headers — tiny glowing icon
// chips with tooltips, in place of the full medallions (which belong on the
// profile rack).
export function MiniBadgeRow({
  ids,
  max = 4,
  className,
}: {
  ids: string[];
  max?: number;
  className?: string;
}) {
  const items = useMemo(() => {
    const out: Array<{ id: string; label: string; color: string }> = [];
    for (const id of ids) {
      const entry = getAchievement(id);
      if (!entry) continue;
      out.push({
        id,
        label: entry.label,
        color: achievementToneColor(entry.tone),
      });
      if (out.length >= max) break;
    }
    return out;
  }, [ids, max]);

  if (!items.length) return null;

  return (
    <ul
      className={`flex items-center gap-1.5 list-none p-0 m-0 ${className ?? ""}`}
      aria-label="Achievement badges"
    >
      {items.map(({ id, label, color }) => {
        const Icon = getAchievement(id)!.icon;
        return (
          <li key={id}>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-[rgba(6,10,18,0.85)]"
              style={{
                borderColor: color,
                boxShadow: `0 0 8px ${color}66, inset 0 0 6px ${color}33`,
              }}
              title={label}
            >
              <Icon
                aria-hidden
                className="h-3.5 w-3.5"
                style={{ color, filter: `drop-shadow(0 0 5px ${color})` }}
              />
              <span className="sr-only">{label}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
