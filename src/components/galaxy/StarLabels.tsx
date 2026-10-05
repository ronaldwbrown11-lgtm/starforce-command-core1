import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { StarData } from "./galaxyData";
import { findLabelSlot, labelChipScale, type LabelRect } from "./placement";
import { isSectorStar } from "./sectorStars";
import { RotGroup, spinPoint, type SpinRef } from "./rotation";
interface Props {
  stars: StarData[]; starNames: Record<string, string>;
  selectedStarId: string | null; highlightedStarId: string | null;
  limit?: number; spinRef?: SpinRef; onSelectStar?: (star: StarData) => void;
}
// Label chips are world-anchored billboards centered on each star's true
// galactic position: the anchor projects star.position exactly (spin-aware),
// the chip is centered on that point, and labelChipScale grows/shrinks the
// chip with camera distance — so labels sit where the stars actually are and
// zoom with the galaxy. When a chip would cover an already-placed label it
// fans outward, and a screen-space leader line ties it back to the anchor.
// Half-extent of the leader overlay (covers the fan's 196px max radius).
const LEADER_PAD = 300;
export const StarLabels = memo(function StarLabels({ stars, starNames, selectedStarId, spinRef, onSelectStar }: Props) {
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const leaders = useRef(new Map<string, SVGSVGElement>());
  // Chip currently under the pointer — leader lines only show for it.
  const hovered = useRef<string | null>(null);
  const anchor = useRef(new THREE.Vector3());
  const projected = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    // Placement priority: the selected star, the capital, then the per-sector
    // reference stars (the relative-position points every sector needs), the
    // user's own lore stars, and finally the fixed catalog — brightest first
    // within each tier. Crowded views keep the labels that matter most.
    const rank = (s: StarData) =>
      s.id === selectedStarId ? 0 : s.capital ? 1 : isSectorStar(s.id) ? 2 : s.isCustom ? 3 : 4;
    const ordered = [...stars].sort((a, b) => rank(a) - rank(b) || a.magnitude - b.magnitude);
    // Pass A: project every label anchor — the star's exact position, rotated
    // with the galaxy — and show only what's on screen (chip + leader together).
    type Entry = { id: string; el: HTMLElement; ax: number; ay: number; scale: number };
    const entries: Entry[] = [];
    for (const star of ordered) {
      const el = labels.current.get(star.id); if (!el) continue;
      const world = spinPoint(star.position, spinRef?.current ?? 0);
      anchor.current.set(world[0], world[1], world[2]);
      projected.current.copy(anchor.current).project(camera);
      const onScreen = Math.abs(projected.current.x) < 1 && Math.abs(projected.current.y) < 1 && projected.current.z < 1;
      el.style.display = onScreen ? "block" : "none";
      if (!onScreen) {
        // Off-screen chips take their leader with them; on-screen leaders are
        // managed in pass C (stable display so the opacity fade can run).
        const offLeader = leaders.current.get(star.id);
        if (offLeader) offLeader.style.display = "none";
        continue;
      }
      const dist = camera.position.distanceTo(anchor.current);
      entries.push({
        id: star.id, el,
        ax: (projected.current.x * 0.5 + 0.5) * size.width,
        ay: (0.5 - projected.current.y * 0.5) * size.height,
        scale: labelChipScale(dist),
      });
    }
    // Pass B: read chip sizes once layout is settled (all writes are done).
    const sized = entries.map(e => ({ ...e, w: e.el.offsetWidth, h: e.el.offsetHeight }));
    // Pass C: fan overlapping chips around their anchor so EVERY star keeps
    // its label — the Sol cluster would otherwise collapse to one chip.
    // Overlap math uses the scaled (visual) size, and the transform scales
    // about the chip's top-left (transform-origin: 0 0) so the placed rect is
    // exactly what renders on screen.
    const placed: LabelRect[] = [];
    for (const e of sized) {
      const w = e.w * e.scale;
      const h = e.h * e.scale;
      const slot = findLabelSlot(e.ax, e.ay, w, h, placed);
      const leader = leaders.current.get(e.id);
      if (!slot) {
        e.el.style.display = "none";
        if (leader) leader.style.display = "none";
        continue;
      }
      e.el.style.transform = `translate(${slot.dx}px, ${slot.dy}px) scale(${e.scale})`;
      placed.push({ x: e.ax + slot.dx, y: e.ay + slot.dy, w, h });
      // Leader polish: the line from the star's true anchor to a displaced
      // chip only shows while that chip is hovered, keeping crowded views
      // clean (zero-length when centered — nothing to draw anyway).
      if (!leader) continue;
      const line = leader.firstElementChild as SVGLineElement | null;
      if (!line) continue;
      leader.style.display = "block";
      line.setAttribute("x2", String(LEADER_PAD + slot.dx + w / 2));
      line.setAttribute("y2", String(LEADER_PAD + slot.dy + h / 2));
      const fanned = Math.hypot(slot.dx + w / 2, slot.dy + h / 2) > 2;
      leader.style.opacity = fanned && hovered.current === e.id ? "1" : "0";
    }
  });
  const body = <group>{stars.map(star => (
    <Html key={star.id} position={star.position} zIndexRange={[10, 0]}>
      {/* Screen-space leader overlay: anchored at the star, extends ±PAD px,
          its line is updated each frame to reach the chip (zero-length when
          the chip sits centered on the anchor, which renders nothing). */}
      <svg
        ref={el => { if (el) leaders.current.set(star.id, el); else leaders.current.delete(star.id); }}
        width={LEADER_PAD * 2} height={LEADER_PAD * 2}
        style={{ position: "absolute", left: -LEADER_PAD, top: -LEADER_PAD, pointerEvents: "none", display: "none", opacity: 0, transition: "opacity 140ms ease", overflow: "visible" }}
        aria-hidden="true"
      >
        <line x1={LEADER_PAD} y1={LEADER_PAD} x2={LEADER_PAD} y2={LEADER_PAD} stroke="#cbd5e1" strokeWidth={1} strokeOpacity={0.5} />
      </svg>
      <button ref={el => { if (el) labels.current.set(star.id, el); else labels.current.delete(star.id); }} type="button" onClick={() => onSelectStar?.(star)} onMouseEnter={() => { hovered.current = star.id; }} onMouseLeave={() => { hovered.current = null; }} title={star.designation ?? star.defaultName} style={{ transformOrigin: "0 0" }} className={`whitespace-nowrap rounded border bg-slate-950/85 px-1.5 py-0.5 font-mono text-[10px] hover:border-amber-300 ${star.capital ? "border-amber-300/70 text-amber-200" : "border-white/20 text-slate-100"}`}>{star.capital ? "★ " : ""}{starNames[star.id] || star.defaultName}</button>
    </Html>
  ))}</group>;
  return spinRef ? <RotGroup spinRef={spinRef}>{body}</RotGroup> : body;
});
