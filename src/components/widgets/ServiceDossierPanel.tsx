import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "react-router";
import {
  Anchor,
  Download,
  Lock,
  MapPin,
  PenLine,
  Rocket,
  Ship,
  Trash2,
} from "lucide-react";
import { HoloCard, NeonButton, StatusPill } from "../uf";
import { useAuth } from "@/hooks/use-auth";
import { hasTier, type TierId } from "@/lib/tiers";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Deep service record — ship assignment, tour history, narrative dossier.
// Data lives in the dedicated `serviceDossiers` database (deliberately
// separate from the lore personnel database). `editable` renders the
// owner-side editor; otherwise it's the public profile view. Dossier export
// is an Elite-tier perk and pays out as a JSON download.
// ---------------------------------------------------------------------------

const inputCls =
  "border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none";
const labelCls = "text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5";

function toDateInput(ts?: number | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ServiceDossierPanel({
  userId,
  editable = false,
}: {
  userId?: Id<"users">;
  editable?: boolean;
}) {
  const { user, isAuthenticated } = useAuth();
  const data = useQuery(
    editable ? api.serviceDossiers.myDossier : api.serviceDossiers.publicDossier,
    editable ? {} : userId ? { userId } : "skip",
  );

  const setShip = useMutation(api.serviceDossiers.updateShipAssignment);
  const addTour = useMutation(api.serviceDossiers.addTour);
  const removeTour = useMutation(api.serviceDossiers.removeTour);
  const setNarrative = useMutation(api.serviceDossiers.updateNarrative);
  const setVisibility = useMutation(api.serviceDossiers.setDossierVisibility);
  const [busy, setBusy] = useState(false);

  // ---- editor state ----
  const [editing, setEditing] = useState(false);
  const [shipDesignation, setShipDesignation] = useState("");
  const [shipName, setShipName] = useState("");
  const [shipRole, setShipRole] = useState("");
  const [division, setDivision] = useState("");
  const [narrative, setNarrativeDraft] = useState("");
  const [tour, setTour] = useState({
    vesselDesignation: "",
    vesselName: "",
    title: "",
    sector: "",
    startedAt: "",
    endedAt: "",
    summary: "",
  });

  if (data === undefined) {
    return (
      <HoloCard aria-label="Loading service record">
        <div className="uf-skeleton" style={{ height: 140 }} />
      </HoloCard>
    );
  }

  const isElite = hasTier(user?.tier as TierId | null | undefined, "elite");
  // publicVisible only exists on the owner view; the public view is always
  // visible by definition (the backend already filters hidden dossiers).
  const visibility = editable
    ? ((data as { publicVisible?: boolean } | null)?.publicVisible ?? true)
    : true;

  // Public profile with no dossier on file → nothing to show.
  if (!editable && data === null) return null;

  const startEdit = () => {
    setEditing(true);
    setShipDesignation(data?.shipDesignation ?? "");
    setShipName(data?.shipName ?? "");
    setShipRole(data?.shipRole ?? "");
    setDivision(data?.division ?? "");
    setNarrativeDraft(data?.narrative ?? "");
  };

  const saveShip = async () => {
    setBusy(true);
    try {
      await setShip({
        shipDesignation: shipDesignation || undefined,
        shipName: shipName || undefined,
        shipRole: shipRole || undefined,
        division: division || undefined,
      });
      toast.success("Ship assignment updated on your service record.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save assignment.");
    } finally {
      setBusy(false);
    }
  };

  const saveNarrative = async () => {
    setBusy(true);
    try {
      await setNarrative({ narrative });
      toast.success("Dossier narrative updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save narrative.");
    } finally {
      setBusy(false);
    }
  };

  const submitTour = async (e: React.FormEvent) => {
    e.preventDefault();
    const started = tour.startedAt
      ? new Date(`${tour.startedAt}T12:00:00`).getTime()
      : null;
    if (!started || !Number.isFinite(started)) {
      toast.error("Pick a tour start date.");
      return;
    }
    const ended = tour.endedAt
      ? new Date(`${tour.endedAt}T12:00:00`).getTime()
      : undefined;
    setBusy(true);
    try {
      await addTour({
        vesselDesignation: tour.vesselDesignation || undefined,
        vesselName: tour.vesselName || undefined,
        title: tour.title || undefined,
        sector: tour.sector || undefined,
        startedAt: started,
        endedAt: ended,
        summary: tour.summary || undefined,
      });
      setTour({
        vesselDesignation: "",
        vesselName: "",
        title: "",
        sector: "",
        startedAt: "",
        endedAt: "",
        summary: "",
      });
      toast.success("Tour logged to your service record.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log the tour.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveTour = async (id: string) => {
    setBusy(true);
    try {
      await removeTour({ tourId: id });
      toast.success("Tour removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the tour.");
    } finally {
      setBusy(false);
    }
  };

  const exportDossier = () => {
    if (!data || !isElite) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "star-force-base-1198:serviceDossier",
      pilot: {
        displayName: user?.displayName ?? null,
        rank: user?.rank ?? null,
        fleet: user?.fleet ?? null,
        tier: user?.tier ?? "free",
      },
      ship: {
        designation: data.shipDesignation,
        name: data.shipName,
        role: data.shipRole,
        division: data.division,
      },
      tours: data.tours,
      narrative: data.narrative,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-dossier-${(user?.displayName ?? "pilot").toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Dossier exported — keep it between you and the archive.");
  };

  const tours = data?.tours ?? [];

  return (
    <HoloCard accent="cyan" className="!border-[rgba(0,229,255,0.28)]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="uf-eyebrow flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5" aria-hidden />
            Deep service record
          </span>
          <h2 className="text-2xl font-semibold mt-1.5">Deployment dossier.</h2>
          <p className="text-uf-muted text-sm mt-1 max-w-[62ch]">
            {editable
              ? "Your ship, your tours, your narrative — kept in a dedicated service database, separate from the lore archives."
              : "Ship assignment and tour history from the member's personal service database."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && visibility ? (
            <StatusPill variant="success">Visible on profile</StatusPill>
          ) : editable ? (
            <StatusPill variant="default">Hidden from profile</StatusPill>
          ) : null}
          {editable ? (
            <NeonButton variant="ghost" onClick={() => setEditing((v) => !v)}>
              <PenLine className="h-4 w-4 mr-1" aria-hidden />
              {editing ? "Done editing" : "Edit record"}
            </NeonButton>
          ) : null}
        </div>
      </header>

      {editable && editing ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4 md:col-span-2">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Anchor className="h-4 w-4 text-uf-cyan" aria-hidden />
              Current ship assignment
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Vessel designation
                <input className={inputCls} value={shipDesignation} onChange={(e) => setShipDesignation(e.target.value)} placeholder="e.g. SFSBT 8001" maxLength={40} />
              </label>
              <label className={labelCls}>
                Vessel name
                <input className={inputCls} value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="e.g. OMEGA MAJESTY" maxLength={80} />
              </label>
              <label className={labelCls}>
                Post / role
                <input className={inputCls} value={shipRole} onChange={(e) => setShipRole(e.target.value)} placeholder="e.g. Helm Officer" maxLength={60} />
              </label>
              <label className={labelCls}>
                Division
                <input className={inputCls} value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. Tactical, Science" maxLength={60} />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <NeonButton variant="primary" loading={busy} onClick={saveShip}>
                Save assignment
              </NeonButton>
            </div>
          </div>

          <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4 md:col-span-2">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-uf-cyan" aria-hidden />
              Log a tour
            </h3>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitTour}>
              <label className={labelCls}>
                Vessel name
                <input className={inputCls} value={tour.vesselName} onChange={(e) => setTour({ ...tour, vesselName: e.target.value })} placeholder="Vessel flown on this tour" maxLength={80} />
              </label>
              <label className={labelCls}>
                Vessel designation
                <input className={inputCls} value={tour.vesselDesignation} onChange={(e) => setTour({ ...tour, vesselDesignation: e.target.value })} placeholder="Optional registry number" maxLength={80} />
              </label>
              <label className={labelCls}>
                Post / title
                <input className={inputCls} value={tour.title} onChange={(e) => setTour({ ...tour, title: e.target.value })} placeholder="e.g. Tactical Officer" maxLength={80} />
              </label>
              <label className={labelCls}>
                Sector
                <input className={inputCls} value={tour.sector} onChange={(e) => setTour({ ...tour, sector: e.target.value })} placeholder="e.g. Sol System-Gemini" maxLength={80} />
              </label>
              <label className={labelCls}>
                Start date
                <input type="date" className={inputCls} value={tour.startedAt} onChange={(e) => setTour({ ...tour, startedAt: e.target.value })} required />
              </label>
              <label className={labelCls}>
                End date <span className="text-uf-muted normal-case tracking-normal">(leave blank for active duty)</span>
                <input type="date" className={inputCls} value={tour.endedAt} onChange={(e) => setTour({ ...tour, endedAt: e.target.value })} />
              </label>
              <label className={`${labelCls} sm:col-span-2`}>
                Tour summary
                <textarea className={`${inputCls} resize-y`} rows={2} value={tour.summary} onChange={(e) => setTour({ ...tour, summary: e.target.value })} placeholder="What happened on this deployment?" maxLength={300} />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <NeonButton type="submit" variant="primary" loading={busy}>
                  Log tour
                </NeonButton>
              </div>
            </form>
          </div>

          <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4 md:col-span-2">
            <h3 className="text-sm font-semibold mb-3">Narrative</h3>
            <textarea
              className={`${inputCls} w-full resize-y`}
              rows={4}
              value={narrative}
              onChange={(e) => setNarrativeDraft(e.target.value)}
              placeholder="A short paragraph on your character's service — shown on your public dossier."
              maxLength={1200}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await setVisibility({ publicVisible: !visibility });
                    toast.success("Dossier visibility updated.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't update visibility.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="text-xs text-uf-cyan hover:underline cursor-pointer"
              >
                {visibility ? "Hide from profile" : "Show on profile"}
              </button>
              <NeonButton variant="ghost" loading={busy} onClick={saveNarrative}>
                Save narrative
              </NeonButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- Read view ---- */}
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4">
          <h3 className="uf-eyebrow mb-3">Current assignment</h3>
          {data?.shipName || data?.shipDesignation ? (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold flex items-center gap-2">
                <Ship className="h-5 w-5 text-uf-cyan" aria-hidden />
                {data.shipName ?? "Unnamed vessel"}
              </p>
              <p className="text-uf-muted text-xs font-mono">
                {data.shipDesignation ?? "No registry designation"}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {data.shipRole ? <StatusPill variant="info">{data.shipRole}</StatusPill> : null}
                {data.division ? <StatusPill variant="violet">{data.division}</StatusPill> : null}
              </div>
            </div>
          ) : (
            <p className="text-uf-muted text-sm">
              {editable ? "No assignment on file — edit your record to add one." : "No ship assignment on file."}
            </p>
          )}
          {editable && (
            <div className="mt-4 border-t border-[color:var(--uf-border)] pt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={exportDossier}
                disabled={!isElite}
                title={isElite ? "Download your dossier as JSON" : "Dossier export is an Elite tier perk"}
                className={
                  "inline-flex items-center gap-1.5 text-xs " +
                  (isElite ? "text-uf-cyan hover:underline cursor-pointer" : "text-uf-muted cursor-not-allowed")
                }
              >
                {isElite ? (
                  <Download className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                )}
                {isElite ? "Export dossier (JSON)" : "Export locked — Elite perk"}
              </button>
              {!isElite && isAuthenticated ? (
                <Link to="/membership" className="text-xs text-uf-gold underline underline-offset-2">
                  Unlock with Elite
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4">
          <h3 className="uf-eyebrow mb-3">Tour history</h3>
          {tours.length === 0 ? (
            <p className="text-uf-muted text-sm">
              {editable ? "No tours logged yet — every deployment starts somewhere." : "No tours on file."}
            </p>
          ) : (
            <ol className="relative flex flex-col gap-3 list-none p-0 m-0 before:content-[''] before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-[color:var(--uf-border)]">
              {tours.map((t) => (
                <li key={t.id} className="relative pl-7">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[5px] h-2.5 w-2.5 rounded-full bg-[var(--uf-cyan)] shadow-[0_0_8px_rgba(0,229,255,0.6)]"
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {t.vesselName ?? t.vesselDesignation ?? "Unlisted vessel"}
                      </p>
                      <p className="text-uf-muted text-xs mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {t.title ? <span>{t.title}</span> : null}
                        {t.sector ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" aria-hidden /> {t.sector}
                          </span>
                        ) : null}
                        <span>
                          {new Date(t.startedAt).toLocaleDateString()}
                          {t.endedAt ? ` → ${new Date(t.endedAt).toLocaleDateString()}` : " → present"}
                        </span>
                      </p>
                      {t.summary ? (
                        <p className="text-uf-muted text-xs mt-1 leading-5">{t.summary}</p>
                      ) : null}
                    </div>
                    {editable ? (
                      <button
                        type="button"
                        aria-label={`Remove tour ${t.vesselName ?? t.id}`}
                        onClick={() => void handleRemoveTour(t.id)}
                        className="text-uf-muted hover:text-uf-red transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {data?.narrative ? (
        <p className="text-uf-muted text-sm leading-6 mt-4 max-w-[72ch] border-t border-[color:var(--uf-border)] pt-4">
          {data.narrative}
        </p>
      ) : null}
    </HoloCard>
  );
}