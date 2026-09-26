import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, StatusPill } from "@/components/uf";
import type { RegistryPilot, RegistryVessel } from "@/convex/wings";
import { ChevronDown, Loader2, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// VesselHonorStrip — the ASSIGNED PILOTS honor roll, main-site side.
//
// Reads the live ship-type list from the Fleet Registry (GET /api/vessels)
// and lazily loads each hull's permanent pilot roll (GET /api/vessels/:id/pilots)
// when its row is expanded. Assignments are written once at the Wings
// ceremony and cannot be edited — this strip renders the registry's record,
// oldest first.
// ---------------------------------------------------------------------------

export function VesselHonorStrip({ className }: { className?: string }) {
  const listVessels = useAction(api.wings.listVessels);
  const [vessels, setVessels] = useState<RegistryVessel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = () => {
    setError(null);
    listVessels({})
      .then((res) => {
        if (res.state === "ok") setVessels(res.vessels);
        else setError(res.message);
      })
      .catch(() => setError("The Fleet Registry is unreachable — try again shortly."));
  };

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HoloCard className={className}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="uf-eyebrow">Fleet registry · wings earned</span>
          <h2 className="text-xl font-semibold mt-1.5">Assigned pilots</h2>
          <p className="text-uf-muted text-sm mt-1">
            The permanent honor roll: every pilot who earned their wings and the
            hull they chose. Written once at the Wings ceremony — never edited.
          </p>
        </div>
        <StatusPill variant="gold">Registry of record</StatusPill>
      </header>

      {error ? (
        <div className="mt-5">
          <p className="text-sm text-[#ffcc00]">{error}</p>
          <button type="button" onClick={load} className="uf-btn uf-btn--ghost mt-3 text-sm cursor-pointer">
            Retry
          </button>
        </div>
      ) : vessels === null ? (
        <div className="flex items-center gap-3 mt-5 text-uf-muted text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the registry roster…
        </div>
      ) : vessels.length === 0 ? (
        <p className="text-uf-muted text-sm mt-5">
          The registry lists no ship types yet. Honor rolls will appear here as
          hulls are commissioned.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[color:var(--uf-border)] list-none p-0 m-0">
          {vessels.map((v) => (
            <VesselRow key={v.id} vessel={v} />
          ))}
        </ul>
      )}
    </HoloCard>
  );
}

function VesselRow({ vessel }: { vessel: RegistryVessel }) {
  const [open, setOpen] = useState(false);
  const pilots = useAction(api.wings.vesselPilots);
  const [roll, setRoll] = useState<RegistryPilot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && roll === null && error === null) {
      pilots({ vesselId: vessel.id })
        .then((res) => {
          if (res.state === "ok") setRoll(res.pilots);
          else setError(res.message);
        })
        .catch(() => setError("Could not reach the Fleet Registry."));
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 py-3 text-left cursor-pointer group"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-uf-muted transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block font-medium text-uf-text truncate group-hover:text-[#00e5ff] transition-colors">
            {vessel.designation}
            {vessel.name ? <span className="text-uf-muted font-normal"> — {vessel.name}</span> : null}
          </span>
          {vessel.shipClass ? (
            <span className="block text-xs text-uf-muted">{vessel.shipClass}</span>
          ) : null}
        </span>
        {vessel.badge ? (
          <span className="ml-auto hidden sm:inline text-[10px] uppercase tracking-[0.16em] text-uf-muted shrink-0">
            {vessel.badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="pb-4 pl-7">
          {error ? (
            <p className="text-sm text-[#ffcc00]">
              {error}{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  pilots({ vesselId: vessel.id })
                    .then((res) => {
                      if (res.state === "ok") setRoll(res.pilots);
                      else setError(res.message);
                    })
                    .catch(() => setError("Could not reach the Fleet Registry."));
                }}
                className="underline cursor-pointer"
              >
                Retry
              </button>
            </p>
          ) : roll === null ? (
            <div className="flex items-center gap-2 text-uf-muted text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the honor roll…
            </div>
          ) : roll.length === 0 ? (
            <p className="text-sm text-uf-muted flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> No pilots yet — the first wings
              earned for this hull will be recorded here.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
              {roll.map((p) => (
                <li
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,204,0,0.35)] bg-[rgba(255,204,0,0.06)] px-3 py-1 text-xs text-uf-text"
                  title={
                    p.assignedAt
                      ? `Assigned ${new Date(p.assignedAt).toLocaleDateString()}`
                      : undefined
                  }
                >
                  {p.memberName}
                  {p.note ? <span className="text-uf-muted">· {p.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}
