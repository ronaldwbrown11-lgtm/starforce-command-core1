import * as THREE from "three";
import { spinPoint } from "./rotation";
import { isSectorStar } from "./sectorStars";

/** Pixel movement between pointerdown and pointerup above which a gesture is
 *  treated as a camera drag instead of a star placement. */
export const PLACE_DRAG_THRESHOLD = 6;

/** Convert a click on the canvas into a galaxy-local position on the galactic
 *  plane (y = 0), undoing the galaxy's current spin so the star lands exactly
 *  where the user clicked. Returns null when the view ray misses the plane
 *  (camera looking parallel to it) or the canvas has no size. */
export function clickToGalaxyLocal(
  camera: THREE.Camera,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  clientX: number,
  clientY: number,
  spinAngle: number,
): [number, number, number] | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    new THREE.Vector3(),
  );
  if (!hit) return null;
  // World → galaxy-local (inverse of spinPoint's rotation).
  const local = spinPoint([hit.x, hit.y, hit.z], -spinAngle);
  // Snap to 4 decimals and keep within the starLore validation bounds (±100)
  // so a click near the horizon still produces a saveable star.
  const clamp = (v: number) =>
    Math.max(-100, Math.min(100, Math.round(v * 1e4) / 1e4));
  return [clamp(local[0]), clamp(local[1]), clamp(local[2])];
}

/** The generated galaxy star field — parallel arrays; particle positions are
 *  galaxy-local, colors are premultiplied by per-star brightness. */
export interface GalaxyDotField {
  particles: Float32Array;
  particleColors: Float32Array;
  particleSizes: Float32Array;
}

/** A pickable background star dot. */
export interface GalaxyDot {
  position: [number, number, number];
  color: string;
  size: number;
}

/** Find the star dot nearest to a canvas click in screen space, within
 *  `maxPx` pixels. Positions are galaxy-local and get spun into world space
 *  first so the pick lines up with the rendered (rotated) field. */
export function pickGalaxyDot(
  camera: THREE.Camera,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  clientX: number,
  clientY: number,
  spinAngle: number,
  field: GalaxyDotField,
  maxPx = 16,
): GalaxyDot | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const projected = new THREE.Vector3();
  const { particles, particleSizes } = field;
  // Inlined spinPoint rotation — this is a hot loop at pointer-move rate, so
  // avoid allocating a tuple per star.
  const cos = Math.cos(spinAngle);
  const sin = Math.sin(spinAngle);
  let best = -1;
  let bestD2 = maxPx * maxPx;
  for (let i = 0; i < particleSizes.length; i++) {
    const wx = particles[i * 3];
    const wy = particles[i * 3 + 1];
    const wz = particles[i * 3 + 2];
    projected.set(wx * cos + wz * sin, wy, -wx * sin + wz * cos).project(camera);
    if (projected.z > 1) continue; // behind the camera
    const px = (projected.x * 0.5 + 0.5) * rect.width;
    const py = (-projected.y * 0.5 + 0.5) * rect.height;
    const dx = px - x;
    const dy = py - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  if (best < 0) return null;
  return dotAt(field, best);
}

/** Field colors are premultiplied by brightness — recover the hue. */
function dotAt(field: GalaxyDotField, index: number): GalaxyDot {
  const { particles, particleColors, particleSizes } = field;
  const r = particleColors[index * 3];
  const g = particleColors[index * 3 + 1];
  const b = particleColors[index * 3 + 2];
  const m = Math.max(r, g, b, 1e-4);
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v / m)) * 255)
      .toString(16)
      .padStart(2, "0");
  return {
    position: [
      particles[index * 3],
      particles[index * 3 + 1],
      particles[index * 3 + 2],
    ],
    color: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
    size: particleSizes[index],
  };
}

/** World translation that keeps `anchor` projecting under the given cursor
 *  NDC after the camera has already moved. Pure translation — orientation is
 *  unchanged — so this is exact for a pinhole camera. Used for cursor-anchored
 *  zoom: the point under the cursor before the dolly stays under it after. */
export function anchorShiftForCursor(
  camera: THREE.PerspectiveCamera,
  anchor: THREE.Vector3,
  ndcX: number,
  ndcY: number,
): THREE.Vector3 {
  camera.updateMatrixWorld();
  const vCam = anchor
    .clone()
    .applyMatrix4(new THREE.Matrix4().copy(camera.matrixWorld).invert());
  const d = -vCam.z; // anchor depth after the dolly
  if (d <= 0) return new THREE.Vector3();
  const tanH = Math.tan((camera.fov * Math.PI) / 360);
  const aspect = camera.aspect || 1;
  // Solve the translation that maps the anchor to the cursor's NDC.
  const tx = vCam.x - ndcX * tanH * aspect * d;
  const ty = vCam.y - ndcY * tanH * d;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  return right.multiplyScalar(tx).add(up.multiplyScalar(ty));
}

export type DotDirection = "up" | "down" | "left" | "right";

/** Keyboard navigation: nearest star dot in a screen direction, hopping from
 *  the currently selected dot (or the cursor when nothing is selected).
 *  Candidates must sit within a 45° cone around the direction and inside
 *  `maxPx` — so jumps stay local and predictable in the dense field. */
export function findNeighborDot(
  camera: THREE.Camera,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  cursorX: number,
  cursorY: number,
  spinAngle: number,
  field: GalaxyDotField,
  current: GalaxyDot | null,
  direction: DotDirection,
  maxPx = 400,
): GalaxyDot | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const dir: Record<DotDirection, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const [dirX, dirY] = dir[direction];

  // Origin: the selected dot's screen position, else the cursor.
  let originX = cursorX - rect.left;
  let originY = cursorY - rect.top;
  if (current) {
    const c = Math.cos(spinAngle);
    const s = Math.sin(spinAngle);
    const p = current.position;
    const v = new THREE.Vector3(
      p[0] * c + p[2] * s,
      p[1],
      -p[0] * s + p[2] * c,
    ).project(camera);
    if (v.z <= 1) {
      originX = (v.x * 0.5 + 0.5) * rect.width;
      originY = (-v.y * 0.5 + 0.5) * rect.height;
    }
  }

  const projected = new THREE.Vector3();
  const { particles, particleSizes } = field;
  const cos = Math.cos(spinAngle);
  const sin = Math.sin(spinAngle);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < particleSizes.length; i++) {
    const wx = particles[i * 3];
    const wy = particles[i * 3 + 1];
    const wz = particles[i * 3 + 2];
    projected.set(wx * cos + wz * sin, wy, -wx * sin + wz * cos).project(camera);
    if (projected.z > 1) continue; // behind the camera
    const px = (projected.x * 0.5 + 0.5) * rect.width;
    const py = (-projected.y * 0.5 + 0.5) * rect.height;
    const dx = px - originX;
    const dy = py - originY;
    const along = dx * dirX + dy * dirY;
    if (along <= 0) continue; // behind the origin in this direction
    const perp = Math.abs(dx * dirY - dy * dirX);
    if (perp > along) continue; // outside the 45° cone
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxPx) continue;
    if (current) {
      const p = current.position;
      if (
        Math.abs(wx - p[0]) < 1e-6 &&
        Math.abs(wy - p[1]) < 1e-6 &&
        Math.abs(wz - p[2]) < 1e-6
      )
        continue; // never jump to the dot we're starting from
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  if (best < 0) return null;
  return dotAt(field, best);
}

/** Axis-aligned screen rect used for label de-overlap bookkeeping. */
export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A warp-gate endpoint candidate (quadrant / sector / system / star). */
export interface WarpEndpointRef {
  id: string;
  kind: string;
  position: [number, number, number];
}

/** Endpoint-kind preference used when snapping a map pick: seeded sector
 *  reference stars first (the galaxy-wide anchors), then warp-gate nodes,
 *  then other stars, then systems, then sectors and quadrants. Added to the
 *  distance so nearby endpoints still win, but ties and near-ties go to the
 *  reference stars and gates. */
function snapPenalty(endpoint: WarpEndpointRef): number {
  if (isSectorStar(endpoint.id)) return 0;
  if (endpoint.kind === "Hub" || endpoint.kind === "Gate") return 0.1;
  if (endpoint.kind === "Star") return 0.2;
  if (endpoint.kind === "System") return 0.4;
  if (endpoint.kind === "Sector") return 1;
  return 1.6; // Quadrant
}

/** Snap a galaxy-local map pick to a warp-gate endpoint: the lowest
 *  distance + kind-penalty score wins, so clicking near a sector's reference
 *  star lands on it even when a system marker is a few steps closer. Returns
 *  null only when there are no endpoints at all. */
export function snapWarpEndpoint(
  local: [number, number, number],
  endpoints: WarpEndpointRef[],
): WarpEndpointRef | null {
  let best: WarpEndpointRef | null = null;
  let bestScore = Infinity;
  for (const endpoint of endpoints) {
    const score =
      Math.hypot(
        local[0] - endpoint.position[0],
        local[1] - endpoint.position[1],
        local[2] - endpoint.position[2],
      ) + snapPenalty(endpoint);
    if (score < bestScore) {
      bestScore = score;
      best = endpoint;
    }
  }
  return best;
}

/** Where to place a label chip so it doesn't cover an already-placed one:
 *  prefers sitting centered on its anchor (the chip is ON its star),
 *  otherwise fans out on rings around it (the star cluster at Sol would
 *  otherwise collapse every label onto one point). Returns the top-left
 *  offset from the anchor — the chip's visual rect is
 *  (anchor + offset, w, h) — or null when the neighborhood is full. */
export function findLabelSlot(
  anchorX: number,
  anchorY: number,
  w: number,
  h: number,
  placed: LabelRect[],
  maxRadius = 196,
): { dx: number; dy: number } | null {
  const PAD = 2;
  const overlaps = (x: number, y: number) =>
    placed.some(
      (r) =>
        x < r.x + r.w + PAD &&
        x + w + PAD > r.x &&
        y < r.y + r.h + PAD &&
        y + h + PAD > r.y,
    );

  // Preferred: centered on the anchor so the label sits where the star is.
  const cx = anchorX - w / 2;
  const cy = anchorY - h / 2;
  if (!overlaps(cx, cy)) return { dx: Math.round(cx - anchorX), dy: Math.round(cy - anchorY) };

  // Walk an outward spiral around the anchor, sampling every ~10px of path
  // so chips wrap tightly instead of wasting ring space. Radial pitch keeps
  // adjacent turns clear of each other.
  const pitch = h + 4;
  let angle = 0;
  let radius = 20;
  let guard = 0;
  while (radius <= maxRadius && guard++ < 4000) {
    const x = anchorX + Math.cos(angle) * radius - w / 2;
    const y = anchorY + Math.sin(angle) * radius - h / 2;
    if (!overlaps(x, y))
      return { dx: Math.round(x - anchorX), dy: Math.round(y - anchorY) };

    angle += 10 / radius; // ~10px along the path
    radius = 20 + (angle / (Math.PI * 2)) * pitch;
  }
  return null;
}

/** Camera distance at which label chips render at their natural size — the
 *  galaxy fly-to distance (46 units). */
export const LABEL_REF_DISTANCE = 46;

/** Visual scale for a label chip at a given camera distance. Chips track the
 *  camera distance 1:1 around the reference — zooming in at the galaxy level
 *  grows every label, zooming out shrinks it — clamped to [0.5, 2] so a full
 *  zoom-out stays legible and a star close-up doesn't cover the screen. */
export function labelChipScale(distance: number): number {
  const raw = LABEL_REF_DISTANCE / Math.max(distance, 1e-6);
  return Math.min(2, Math.max(0.5, raw));
}
