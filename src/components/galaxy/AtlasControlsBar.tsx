import { useState } from "react";
import { ChevronDown, ChevronUp, Keyboard } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

// ---------------------------------------------------------------------------
// AtlasControlsBar — the Star Atlas keyboard + mouse legend.
//
// It lives in the console frame UNDER the 3D window rather than overlaid on
// the map, so it never covers the galaxy and can be set at a comfortable
// reading size. Every hint mirrors the real bindings:
//
//   CameraRig    ↑↓←→ / WASD slide · +− zoom · Shift+scroll slide
//                right-drag zoom · Page Up/Down zoom
//   OrbitControls left-drag orbit · middle-drag slide
//   canvas        Shift+arrows hop stars · Enter open · Esc cancel
// ---------------------------------------------------------------------------

type ControlGroup = {
  label: string;
  hints: { keys: string[]; action?: string }[];
};

export const ATLAS_CONTROL_GROUPS: ControlGroup[] = [
  {
    label: "Slide",
    hints: [
      { keys: ["↑", "↓", "←", "→"], action: "or W A S D" },
      { keys: ["Shift", "scroll"], action: "up / down" },
      { keys: ["middle-drag"] },
    ],
  },
  {
    label: "Zoom",
    hints: [
      { keys: ["+", "−"], action: "or Page Up / Down" },
      { keys: ["scroll"], action: "or pinch — aimed at the cursor" },
      { keys: ["right-drag"], action: "up / down" },
    ],
  },
  {
    label: "Look",
    hints: [
      { keys: ["left-drag"], action: "orbit the galaxy" },
      { keys: ["click"], action: "a label to fly there" },
      { keys: ["Shift", "←→"], action: "hop stars · Enter opens" },
    ],
  },
];

export function AtlasControlsBar() {
  const [open, setOpen] = useState(true);

  return (
    <div className="shrink-0 border-t border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? "Hide the control legend" : "Show the control legend"}
          className="uf-eyebrow flex cursor-pointer items-center gap-2 text-uf-cyan transition-colors hover:text-white"
        >
          <Keyboard className="h-4 w-4" aria-hidden />
          Controls
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>

        {open &&
          ATLAS_CONTROL_GROUPS.map((group) => (
            <div
              key={group.label}
              className="flex flex-wrap items-center gap-x-5 gap-y-3"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uf-cyan">
                {group.label}
              </span>
              {group.hints.map((hint) => (
                <span
                  key={`${group.label}:${hint.keys.join("+")}`}
                  className="flex items-center gap-2"
                >
                  <KbdGroup>
                    {hint.keys.map((k) => (
                      <Kbd
                        key={k}
                        className="h-6 min-w-6 rounded-sm border border-white/25 bg-white/10 px-1.5 font-mono text-[13px] font-semibold text-white shadow-none"
                      >
                        {k}
                      </Kbd>
                    ))}
                  </KbdGroup>
                  {hint.action ? (
                    <span className="text-sm leading-5 text-white/85">
                      {hint.action}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
