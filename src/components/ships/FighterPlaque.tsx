import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard } from "@/components/uf";
import { fetchVesselImage } from "@/lib/fleetRegistry";
import type { Id } from "@/convex/_generated/dataModel";
import { Feather } from "lucide-react";

// ---------------------------------------------------------------------------
// FighterPlaque — the member dossier surface for the Wings honor: the pilot's
// OWN StarCraft fighter (type + auto hull number + chosen callsign) with the
// operator-uploaded per-type image (fallback: the Fleet Registry's own art).
// Text-first, matching the Wall of Honor plaques.
// ---------------------------------------------------------------------------

const RANK_ABBR: Record<string, string> = {
  Recruit: "RCT",
  Aspirant: "ASP",
  Pilot: "FLT",
  Commander: "CDR",
  Captain: "CPT",
  Admiral: "ADM",
};

export function FighterPlaque({ memberId }: { memberId: Id<"users"> | string }) {
  const fighter = useQuery(api.starfighters.getMemberFighter, {
    memberId: memberId as Id<"users">,
  });
  const typeImages = useQuery(api.starfighters.getTypeImageUrls, {});

  const [registryImage, setRegistryImage] = useState<string | null>(null);
  const requestedRef = useRef(false);

  const operatorImage =
    fighter?.vesselKey && typeImages ? typeImages[fighter.vesselKey] ?? null : null;

  useEffect(() => {
    if (!fighter?.vesselKey || operatorImage || requestedRef.current) return;
    requestedRef.current = true;
    fetchVesselImage(fighter.vesselKey)
      .then(setRegistryImage)
      .catch(() => undefined);
  }, [fighter?.vesselKey, operatorImage]);

  if (fighter === undefined) return null;
  if (fighter === null) return null;

  const image = operatorImage ?? registryImage ?? null;

  return (
    <HoloCard className="p-6 border-[rgba(255,204,0,0.3)]">
      <header className="flex items-center gap-2">
        <Feather className="h-4 w-4 text-[#ffcc00]" aria-hidden />
        <span className="uf-eyebrow">Wings · personal fighter</span>
        <span className="ml-auto font-mono text-[11px] tracking-[0.2em] text-uf-muted">
          {fighter.hullNumber}
        </span>
      </header>

      {image ? (
        <div className="mt-4 rounded-md border border-[rgba(203,213,225,0.18)] bg-[rgba(5,8,22,0.6)] p-2">
          <img
            src={image}
            alt={`${fighter.designation} schematic`}
            className="w-full h-40 object-contain"
            loading="lazy"
          />
        </div>
      ) : null}

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="text-xs uppercase tracking-[0.14em] text-uf-muted">Pilot</dt>
          <dd className="font-semibold text-uf-text">
            {fighter.memberName ?? "Pilot"}
            {fighter.pilotRank ? (
              <span className="ml-1.5 text-xs font-normal text-uf-muted">
                {RANK_ABBR[fighter.pilotRank] ?? fighter.pilotRank}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="text-xs uppercase tracking-[0.14em] text-uf-muted">StarCraft</dt>
          <dd className="text-uf-text text-right">
            {fighter.designation}
            {fighter.shipClass ? (
              <span className="block text-xs text-uf-muted">{fighter.shipClass}</span>
            ) : null}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="text-xs uppercase tracking-[0.14em] text-uf-muted">Callsign</dt>
          <dd className="font-mono tracking-[0.18em] text-[#ffcc00]">{fighter.callsign}</dd>
        </div>
      </dl>

      <p className="mt-4 text-[11px] text-uf-muted leading-5">
        Earned at the Wings ceremony. The assignment is permanent — the hull
        number is the pilot's for the life of the fleet.
      </p>
    </HoloCard>
  );
}
