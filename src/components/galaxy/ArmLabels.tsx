import { Html } from "@react-three/drei";
import { ARM_NAMES } from "./galaxyData";
import { RotGroup, type SpinRef } from "./rotation";

// ---------------------------------------------------------------------------
// ArmLabels — names the four spiral arms on the galaxy-level map. Labels sit
// on each arm's centerline, using the same logarithmic-spiral formula the
// star generator places the arms with, and rotate with the galaxy.
// ---------------------------------------------------------------------------

/** Mid-disk radius for an arm label (inside the star disk, off the core). */
const ARM_LABEL_RADIUS = 20;
const TOTAL_ARMS = 4;

function armLabelPosition(index: number): [number, number, number] {
  const angle =
    Math.log(1 + ARM_LABEL_RADIUS * 0.18) * 6 +
    (index / TOTAL_ARMS) * Math.PI * 2;
  return [
    Math.cos(angle) * ARM_LABEL_RADIUS,
    0,
    Math.sin(angle) * ARM_LABEL_RADIUS,
  ];
}

export function ArmLabels({ spinRef }: { spinRef: SpinRef }) {
  return (
    <RotGroup spinRef={spinRef}>
      {ARM_NAMES.map((arm) => (
        <Html
          key={arm.name}
          position={armLabelPosition(arm.index)}
          center
          zIndexRange={[6, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span
            className="block whitespace-nowrap rounded-full border bg-black/45 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] backdrop-blur-sm"
            style={{ color: arm.color, borderColor: `${arm.color}55` }}
          >
            {arm.name}
          </span>
        </Html>
      ))}
    </RotGroup>
  );
}
