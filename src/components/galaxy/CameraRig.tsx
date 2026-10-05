import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { anchorShiftForCursor } from "./placement";

// ---------------------------------------------------------------------------
// CameraRig — all camera motion in one place:
//  • scroll wheel + pinch-to-zoom (manual, works in iframes)
//  • right-drag up/down zoom (mouse movement)
//  • ↑ / ↓ arrow-key continuous zoom
//  • +/− button zoom via apiRef
//  • animated fly-to for star / quadrant / sector selection
// ---------------------------------------------------------------------------

export interface CameraApi {
  zoomIn: () => void;
  zoomOut: () => void;
  flyTo: (target: THREE.Vector3, distance: number) => void;
}

interface CameraRigProps {
  apiRef: React.RefObject<CameraApi | null>;
  minDistance?: number;
  maxDistance?: number;
}

interface ControlsLike {
  target: THREE.Vector3;
  update: () => void;
  enabled: boolean;
}

export const ZOOM_MIN = 0.0008;
export const ZOOM_MAX = 200;

export function CameraRig({
  apiRef,
  minDistance = ZOOM_MIN,
  maxDistance = ZOOM_MAX,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as
    | (ControlsLike & {
        mouseButtons?: { LEFT?: number; MIDDLE?: number; RIGHT?: number };
        enableZoom?: boolean;
      })
    | null;

  // Fly-to animation state
  const flyRef = useRef<{
    active: boolean;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
    duration: number;
  }>({
    active: false,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    t: 0,
    duration: 1,
  });

  // Arrow-key hold state (Shift+arrows are reserved for dot browsing)
  const keysRef = useRef({ up: false, down: false, left: false, right: false });

  /** Move camera along the view axis so distance to target becomes
   *  distance * factor (factor < 1 zooms in). When a cursor is given, the
   *  world point under it stays under it — zooming into the area you point at.
   *  Falls back to center zoom when the cursor ray misses the target plane. */
  const dolly = useCallback(
    (factor: number, cursor?: { cx: number; cy: number }) => {
      if (!controls) return;
      flyRef.current.active = false; // any manual zoom cancels a flight
      const dir = new THREE.Vector3()
        .copy(controls.target)
        .sub(camera.position);
      const distance = dir.length();
      if (distance < 1e-6) return;

      // Anchor: the world point under the cursor, on the target plane.
      let anchor: THREE.Vector3 | null = null;
      let ndcX = 0;
      let ndcY = 0;
      if (cursor) {
        const rect = gl.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          ndcX = ((cursor.cx - rect.left) / rect.width) * 2 - 1;
          ndcY = -((cursor.cy - rect.top) / rect.height) * 2 + 1;
          const cam = camera as THREE.PerspectiveCamera;
          const forward = dir.clone().normalize();
          const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(cam);
          const rayDir = far.sub(camera.position).normalize();
          const denom = rayDir.dot(forward);
          if (Math.abs(denom) > 1e-6) {
            const t =
              new THREE.Vector3()
                .subVectors(controls.target, camera.position)
                .dot(forward) / denom;
            if (t > 0) anchor = camera.position.clone().addScaledVector(rayDir, t);
          }
        }
      }

      dir.normalize();
      const newDistance = THREE.MathUtils.clamp(
        distance * factor,
        minDistance,
        maxDistance,
      );
      camera.position.copy(controls.target).addScaledVector(dir, -newDistance);
      camera.updateProjectionMatrix();
      if (anchor) {
        // Translate camera + target so the anchor lands back under the cursor.
        const shift = anchorShiftForCursor(
          camera as THREE.PerspectiveCamera,
          anchor,
          ndcX,
          ndcY,
        );
        camera.position.add(shift);
        controls.target.add(shift);
      }
      controls.update();
    },
    [camera, controls, gl, minDistance, maxDistance],
  );

  /** Slide camera + target along the view's right axis (map panning). */
  const pan = useCallback(
    (direction: 1 | -1, dt: number) => {
      if (!controls) return;
      const dist = camera.position.distanceTo(controls.target);
      const step = dist * 1.2 * dt * direction;
      const right = new THREE.Vector3().setFromMatrixColumn(
        camera.matrixWorld,
        0,
      );
      right.multiplyScalar(step);
      camera.position.add(right);
      controls.target.add(right);
      controls.update();
    },
    [camera, controls],
  );

  const zoomIn = useCallback(() => dolly(1 / 1.25), [dolly]);
  const zoomOut = useCallback(() => dolly(1.25), [dolly]);

  const flyTo = useCallback(
    (target: THREE.Vector3, distance: number) => {
      if (!controls) return;
      // Keep the current viewing direction, just re-target and set distance.
      const dir = new THREE.Vector3()
        .copy(camera.position)
        .sub(controls.target)
        .normalize();
      if (dir.lengthSq() < 1e-6) dir.set(0.4, 0.6, 1).normalize();
      const desired = new THREE.Vector3()
        .copy(target)
        .addScaledVector(dir, THREE.MathUtils.clamp(distance, minDistance, maxDistance));

      flyRef.current = {
        active: true,
        fromPos: camera.position.clone(),
        toPos: desired,
        fromTarget: controls.target.clone(),
        toTarget: target.clone(),
        t: 0,
        duration: 1.1,
      };
    },
    [camera, controls, minDistance, maxDistance],
  );

  // Expose API to buttons outside the canvas
  useEffect(() => {
    apiRef.current = { zoomIn, zoomOut, flyTo };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, zoomIn, zoomOut, flyTo]);

  // OrbitControls receives disabled zoom/right-button behavior declaratively.

  // Wheel + pinch + right-drag, attached directly to the canvas element
  useEffect(() => {
    const el = gl.domElement;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Wheel up (deltaY < 0) zooms in — anchored at the cursor position.
      dolly(Math.exp(e.deltaY * 0.002), { cx: e.clientX, cy: e.clientY });
    };

    // --- touch pinch + right-button drag via pointer events ---
    const pointers = new Map<number, { x: number; y: number; button: number }>();
    let lastPinchDist: number | null = null;
    let rightDragY: number | null = null;

    const onPointerDown = (e: PointerEvent) => {
      flyRef.current.active = false; // grabbing the camera cancels a flight
      pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        button: e.button,
      });
      if (e.pointerType === "mouse" && e.button === 2) {
        rightDragY = e.clientY;
        e.preventDefault();
      }
      if (e.pointerType === "touch") lastPinchDist = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const entry = pointers.get(e.pointerId);
      if (!entry) return;
      pointers.set(e.pointerId, {
        ...entry,
        x: e.clientX,
        y: e.clientY,
      });

      // Right-drag up/down zoom: dragging up zooms in (dy < 0 → factor < 1)
      if (rightDragY !== null && e.pointerType === "mouse") {
        const dy = e.clientY - rightDragY;
        rightDragY = e.clientY;
        dolly(Math.exp(dy * 0.006), { cx: e.clientX, cy: e.clientY });
        return;
      }

      // Pinch zoom (two touch points)
      if (e.pointerType === "touch" && pointers.size === 2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const [p1, p2] = [...pointers.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (lastPinchDist !== null && dist > 0) {
          dolly(lastPinchDist / dist, {
            cx: (p1.x + p2.x) / 2,
            cy: (p1.y + p2.y) / 2,
          });
        }
        lastPinchDist = dist;
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (e.pointerType === "touch" && pointers.size < 2) lastPinchDist = null;
      if (e.pointerType === "mouse" && e.button === 2) rightDragY = null;
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("pointermove", onPointerMove, true);
    el.addEventListener("pointerup", onPointerEnd, true);
    el.addEventListener("pointercancel", onPointerEnd, true);
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("pointermove", onPointerMove, true);
      el.removeEventListener("pointerup", onPointerEnd, true);
      el.removeEventListener("pointercancel", onPointerEnd, true);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl, dolly]);

  // ↑ / ↓ arrow-key zoom (hold to keep zooming). Ignored while typing.
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
      return el instanceof HTMLElement && el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.shiftKey) return; // Shift+arrows belong to dot browsing
      if (e.key === "ArrowUp") {
        keysRef.current.up = true;
        flyRef.current.active = false;
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        keysRef.current.down = true;
        flyRef.current.active = false;
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        keysRef.current.left = true;
        flyRef.current.active = false;
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        keysRef.current.right = true;
        flyRef.current.active = false;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") keysRef.current.up = false;
      else if (e.key === "ArrowDown") keysRef.current.down = false;
      else if (e.key === "ArrowLeft") keysRef.current.left = false;
      else if (e.key === "ArrowRight") keysRef.current.right = false;
    };
    const onBlur = () => {
      keysRef.current.up = false;
      keysRef.current.down = false;
      keysRef.current.left = false;
      keysRef.current.right = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Per-frame: arrow zoom/pan + fly-to interpolation
  useFrame((_, delta) => {
    const keys = keysRef.current;
    if (keys.up) dolly(Math.exp(-1.8 * delta));
    if (keys.down) dolly(Math.exp(1.8 * delta));
    // ← pans the view left, → pans it right (map-app convention).
    if (keys.left) pan(-1, delta);
    if (keys.right) pan(1, delta);

    const fly = flyRef.current;
    if (fly.active && controls) {
      fly.t = Math.min(1, fly.t + delta / fly.duration);
      // easeInOutCubic
      const k =
        fly.t < 0.5
          ? 4 * fly.t * fly.t * fly.t
          : 1 - Math.pow(-2 * fly.t + 2, 3) / 2;
      camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
      controls.target.lerpVectors(fly.fromTarget, fly.toTarget, k);
      controls.update();
      if (fly.t >= 1) fly.active = false;
    }
  });

  return null;
}
