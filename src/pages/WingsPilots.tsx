import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ShipSilhouette } from "@/components/ships/ShipSilhouette";
import {
  fetchVessels,
  fetchVesselPilots,
  type RegistryPilot,
  type RegistryVessel,
} from "@/lib/fleetRegistry";
import { Feather, Loader2, Trophy } from "lucide-react";

// ---------------------------------------------------------------------------
// /wings/pilots — the full ASSIGNED PILOTS honor roll.
//
// Built to scale: the registry's ship-type list is fetched once; each hull's
// permanent pilot roll loads lazily as its section scrolls into view, so the
// page stays fast whether there are 3 hulls with 1 pilot or 40 hulls with
// thousands. The first hull with pilots auto-expands so the page never opens
// empty. This is the celebratory counterpart to the compact strip on
// /fleet-registry — gold, silhouettes, and roll numbers, because earning
// wings is the one honor that is forever.
// ---------------------------------------------------------------------------

export default function WingsPilots() {
  usePageMeta({
    title: "Assigned Pilots — The Honor Roll — Star Force Base 1198",
    description:
      "The permanent honor roll of the Star Force: every pilot who earned their wings, and the hull they chose. Written once, never edited.",
  });

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
    <SiteShell>
      <PageHero
        eyebrow="The Permanent Honor"
        title="Assigned pilots."
        lead="Every name on this roll was written once — at the Wings ceremony, by the pilot themselves — and stands forever. No edits, no transfers, no revocations. That permanence is the reward."
        primary={{ label: "How wings are earned", href: "/awards#wings", variant: "primary" }}
        secondary={{ label: "The fleet registry", href: "/fleet-registry", variant: "ghost" }}
      />

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12 py-10">
        {error ? (
          <HoloCard className="p-8 text-center">
            <p className="text-sm text-[#ffcc00]">{error}</p>
            <button
              type="button"
              onClick={load}
              className="uf-btn uf-btn--ghost mt-4 text-sm cursor-pointer"
            >
              Retry
            </button>
          </HoloCard>
        ) : vessels === null ? (
          <div className="flex flex-col items-center py-24 text-uf-muted text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-[#ffcc00]" />
            <p className="mt-3">Reading the registry roster…</p>
          </div>
        ) : vessels.length === 0 ? (
          <HoloCard className="p-8 text-center">
            <Feather className="h-6 w-6 text-[#ffcc00] mx-auto" />
            <h2 className="mt-3 font-semibold">The roll awaits its first name.</h2>
            <p className="text-uf-muted text-sm mt-2">
              The registry lists no ship types yet. When hulls are commissioned
              and the first wings are earned, the roll begins here.
            </p>
          </HoloCard>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                {vessels.length} hulls on the registry
              </p>
              <StatusPill variant="gold">Registry of record</StatusPill>
            </div>
            {vessels.map((v) => (
              <HonorSection key={v.id} vessel={v} autoOpen={v.id === vessels[0].id} />
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// One hull's celebratory honor section. Roll loads when the section scrolls
// into view; `autoOpen` opens the first section with pilots immediately.
// ---------------------------------------------------------------------------

function HonorSection({
  vessel,
  autoOpen,
}: {
  vessel: RegistryVessel;
  autoOpen: boolean;
}) {
  const [roll, setRoll] = useState<RegistryPilot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const requestedRef = useRef(false);
  const autoOpenedRef = useRef(false);

  const requestRoll = () => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    fetchVesselPilots(vessel.id)
      .then(setRoll)
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : "Could not reach the Fleet Registry.",
        ),
      );
  };

  // Lazy load: fetch when the section first enters the viewport.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      requestRoll(); // no observer support — just load
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          requestRoll();
          obs.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vessel.id]);

  // Auto-open once loaded if this is the lead section (and it has names).
  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current) return;
    if (roll !== null) {
      autoOpenedRef.current = true;
      if (roll.length > 0) setOpen(true);
    }
  }, [autoOpen, roll]);

  return (
    <HoloCard className="p-0 overflow-hidden" glow={roll !== null && roll.length > 0}>
      <section ref={sectionRef} aria-label={`${vessel.designation} honor roll`}>
        <header className="flex flex-wrap items-center gap-4 p-6 border-b border-[color:var(--uf-border)]">
          <div
            className="h-16 w-28 shrink-0 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] flex items-center justify-center"
            style={{
              boxShadow:
                roll && roll.length > 0
                  ? "0 0 22px rgba(255,204,0,0.14)"
                  : undefined,
            }}
          >
            <ShipSilhouette
              shipClass={vessel.shipClass}
              className="h-10 w-24"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {vessel.designation}
              </h2>
              {vessel.name ? (
                <span className="text-sm text-uf-text/85">{vessel.name}</span>
              ) : null}
            </div>
            <p className="text-xs text-uf-muted mt-0.5">
              {vessel.shipClass ?? "Hull class unlisted"}
              {vessel.role ? ` · ${vessel.role}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {roll === null && !error ? (
              <span className="inline-flex items-center gap-2 text-xs text-uf-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading roll…
              </span>
            ) : roll ? (
              <span
                className={`uf-pill ${
                  roll.length > 0 ? "uf-pill--gold" : ""
                }`}
              >
                {roll.length === 0
                  ? "no pilots yet"
                  : `${roll.length} pilot${roll.length === 1 ? "" : "s"}`}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="block ml-auto mt-2 text-xs uppercase tracking-[0.16em] text-uf-cyan hover:text-uf-text cursor-pointer"
            >
              {open ? "Hide roll" : "View roll"}
            </button>
          </div>
        </header>

        {open ? (
          <div className="p-6">
            {error ? (
              <div className="text-center">
                <p className="text-sm text-[#ffcc00]">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    requestedRef.current = false;
                    setError(null);
                    requestRoll();
                  }}
                  className="uf-btn uf-btn--ghost mt-3 text-sm cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : roll === null ? (
              <div className="flex items-center justify-center gap-2 text-uf-muted text-sm py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the honor roll…
              </div>
            ) : roll.length === 0 ? (
              <p className="text-sm text-uf-muted text-center py-6">
                No pilots yet — the first wings earned for this hull will be
                written here, permanently.
              </p>
            ) : (
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
                {roll.map((p, i) => (
                  <li
                    key={p.id || `${p.memberId}-${p.memberName}`}
                    className="flex items-center gap-3 rounded-md border border-[rgba(255,204,0,0.28)] bg-[rgba(255,204,0,0.05)] px-4 py-3"
                  >
                    <span
                      className="uf-pill shrink-0"
                      title={p.assignedAt ? `Assigned ${new Date(p.assignedAt).toLocaleDateString()}` : undefined}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">
                        {p.memberName}
                      </span>
                      <span className="block text-[11px] text-uf-muted">
                        {p.assignedAt
                          ? new Date(p.assignedAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "date unrecorded"}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    {i === 0 && roll.length > 1 ? (
                      <Trophy
                        className="h-4 w-4 text-[#ffcc00] shrink-0 ml-auto"
                        aria-label="First to fly this hull"
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </section>
    </HoloCard>
  );
}
