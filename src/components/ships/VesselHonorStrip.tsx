import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { HoloCard, StatusPill } from "@/components/uf";
import {
  fetchVessels,
  fetchVesselPilots,
  type RegistryPilot,
  type RegistryVessel,
} from "@/lib/fleetRegistry";
import { ChevronDown, Loader2, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// VesselHonorStrip — the ASSIGNED PILOTS honor roll (compact form, on the
// fleet registry page). Reads the live ship-type list from the Fleet
// Registry directly from the browser and lazily loads each hull's permanent
// pilot roll when its row is expanded. The pilot honor wall lives at /honor.
// ---------------------------------------------------------------------------

export function VesselHonorStrip({ className }: { className?: string }) {
  const [vessels, setVessels] = useState<RegistryVessel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = () => {
    setError(null);
    fetchVessels()
      .then(setVessels)
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? e.message
            : "The Fleet Registry is unreachable — try again shortly.",
        ),
      );
  };

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
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
        <>
          <ul className="mt-5 divide-y divide-[color:var(--uf-border)] list-none p-0 m-0">
            {vessels.slice(0, 8).map((v) => (
              <VesselRow key={v.id} vessel={v} />
            ))}
          </ul>
          {vessels.length > 8 ? (
            <p className="text-xs text-uf-muted mt-3">
              Showing the first 8 hulls — the full roll lives on the honor page.
            </p>
          ) : null}
          <div className="mt-5">
            <Link
              to="/honor"
              className="uf-btn uf-btn--gold inline-block text-sm"
            >
              Open the full honor roll
            </Link>
          </div>
        </>
      )}
    </HoloCard>
  );
}

function VesselRow({ vessel }: { vessel: RegistryVessel }) {
  const [open, setOpen] = useState(false);
  const [roll, setRoll] = useState<RegistryPilot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  function loadRoll() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setError(null);
    fetchVesselPilots(vessel.id)
      .then(setRoll)
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : "Could not reach the Fleet Registry.",
        ),
      )
      .finally(() => {
        loadingRef.current = false;
      });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && roll === null && error === null) loadRoll();
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
      </button>

      {open ? (
        <div className="pb-4 pl-7">
          {error ? (
            <p className="text-sm text-[#ffcc00]">
              {error}{" "}
              <button type="button" onClick={loadRoll} className="underline cursor-pointer">
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
                  key={p.id || `${p.memberId}-${p.memberName}`}
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
