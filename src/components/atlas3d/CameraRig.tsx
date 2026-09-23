import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AtlasFrame } from "./types";

// =========================================================================
// CameraRig — the camera is fully fixed (no auto-lerp, no drift). It frames
// the active level's AtlasFrame once per change, then the operator controls
// everything by hand: left-drag = orbit around the frame center, wheel =
// zoom toward the cursor, middle/right-drag = pan.
// =========================================================================

const MIN_DOLLY = 0.02;
const MAX_DOLLY = 3.2;

export function CameraRig({ frame }: { frame: AtlasFrame }) {
  const { gl, camera } = useThree();
  const dom = gl.domElement;

  // Frame state the camera orbits around.
  const center = useRef(new THREE.Vector3(...frame.center));
  const dist = useRef(frame.distance);
  // Spherical offset from the center: (theta around +Y, phi from +Y, zoom).
  const orbit = useRef({ theta: 0.62, phi: 1.02, zoom: 1 });
  // Pan offset in camera-plane units (fraction of the current dolly).
  const pan = useRef(new THREE.Vector2(0, 0));
  // Which frame change we last applied — re-frame on level/selection change.
  const applied = useRef<string>("");
  // Live drag state (kept in refs so pointer handlers never rebind).
  const drag = useRef<{ mode: null | "orbit" | "pan"; x: number; y: number }>({ mode: null, x: 0, y: 0 });

  // Re-frame whenever the level frame changes (level switch or drill).
  useEffect(() => {
    const key = `${frame.center.join(",")}|${frame.scale}`;
    if (applied.current === key) return;
    applied.current = key;
    center.current.set(...frame.center);
    dist.current = frame.distance;
    orbit.current = { theta: 0.62, phi: 1.02, zoom: 1 };
    pan.current.set(0, 0);
    applyCamera(camera, center.current, dist.current, orbit.current, pan.current);
  }, [frame, camera]);

  useEffect(() => {
    const el = dom;

    // ---------- pointer handlers ----------
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) drag.current = { mode: "orbit", x: e.clientX, y: e.clientY };
      else if (e.button === 1 || e.button === 2) drag.current = { mode: "pan", x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.mode) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (d.mode === "orbit") {
        orbit.current.theta -= dx * 0.006;
        orbit.current.phi = THREE.MathUtils.clamp(orbit.current.phi - dy * 0.005, 0.12, Math.PI - 0.12);
      } else {
        const s = dist.current * orbit.current.zoom * 0.0016;
        pan.current.x -= dx * s;
        pan.current.y += dy * s;
      }
      applyCamera(camera, center.current, dist.current, orbit.current, pan.current);
    };
    const endDrag = (e: PointerEvent) => {
      if (drag.current.mode) {
        drag.current.mode = null;
        el.releasePointerCapture(e.pointerId);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera as THREE.PerspectiveCamera);
      const ray = raycaster.ray;
      // Zoom toward the point under the cursor: move the center toward the
      // ray's closest point to the current center, then dolly.
      const closest = ray.closestPointToPoint(center.current, new THREE.Vector3());
      const dirToCursor = closest.clone().sub(center.current);
      const factor = Math.exp(e.deltaY * 0.0011);
      const newZoom = THREE.MathUtils.clamp(orbit.current.zoom * factor, MIN_DOLLY / dist.current, MAX_DOLLY / dist.current);
      const applied = newZoom / orbit.current.zoom;
      center.current.add(dirToCursor.multiplyScalar(Math.min(0.9, 1 - applied)));
      orbit.current.zoom = newZoom;
      applyCamera(camera, center.current, dist.current, orbit.current, pan.current);
    };
    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
    };
  }, [dom, camera]);

  // One rAF-driven apply loop in case a HUD interaction nudges the frame.
  useFrame(() => {
    applyCamera(camera, center.current, dist.current, orbit.current, pan.current);
  });

  return null;
}

function applyCamera(
  camera: THREE.Camera,
  center: THREE.Vector3,
  baseDist: number,
  orbit: { theta: number; phi: number; zoom: number },
  pan: THREE.Vector2,
) {
  const d = Math.max(baseDist * orbit.zoom, MIN_DOLLY);
  const sp = Math.sin(orbit.phi);
  camera.position.set(
    center.x + d * sp * Math.sin(orbit.theta) + pan.x,
    center.y + d * Math.cos(orbit.phi) + pan.y,
    center.z + d * sp * Math.cos(orbit.theta),
  );
  camera.lookAt(center);
}
