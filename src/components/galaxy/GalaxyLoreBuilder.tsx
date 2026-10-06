import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Check, Compass, Crosshair, ExternalLink, MapPinned, Send, ShieldCheck, Sparkles } from "lucide-react";

type PlacedPin = { position: [number, number, number]; sectorId: string } | null;
type BuilderPreview = { position: [number, number, number]; name: string; color: string } | null;

type Source = "freehand" | "mission" | "contest";
type ProposalForm = {
  sectorId: string;
  name: string;
  description: string;
  color: string;
  category: string;
  faction: string;
  posX: number;
  posY: number;
  posZ: number;
};
const EMPTY: ProposalForm = { sectorId: "", name: "", description: "", color: "#67e8f9", category: "mystery", faction: "", posX: 0, posY: 0, posZ: 0 };
const fieldClass = "w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(8,16,31,0.82)] px-3 py-2.5 text-sm text-uf-text outline-none transition focus:border-[color:var(--uf-cyan)] focus:ring-2 focus:ring-cyan-400/10";

function sourceLabel(source: string) {
  if (source === "mission") return "Mission field report";
  if (source === "contest") return "Contest entry";
  return "Free charting";
}
function statusStyle(status: string) {
  if (status === "approved") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  if (status === "rejected") return "border-rose-300/30 bg-rose-300/10 text-rose-200";
  return "border-amber-200/30 bg-amber-200/10 text-amber-100";
}

/** Native Star Atlas authoring station: pin the shared 3D chart, write its lore dossier, and submit to canon review. */
export function GalaxyLoreBuilder({
  placedPin,
  onRequestPlacement,
  onCancelPlacement,
  onDraftChange,
}: {
  placedPin: PlacedPin;
  onRequestPlacement: () => void;
  onCancelPlacement: () => void;
  onDraftChange: (preview: BuilderPreview) => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const atlas = useQuery(api.galaxyMap.list);
  const mine = useQuery(api.galaxyBuilder.myProposals, isAuthenticated ? {} : "skip");
  const submit = useMutation(api.galaxyBuilder.submit);
  const [searchParams] = useSearchParams();
  const rawSource = searchParams.get("source");
  const source: Source = rawSource === "mission" || rawSource === "contest" ? rawSource : "freehand";
  const contextSlug = searchParams.get("context") ?? undefined;
  const contextTitle = searchParams.get("title") ?? undefined;
  const contextLocation = searchParams.get("location") ?? undefined;
  const [form, setForm] = useState<ProposalForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [mapTouched, setMapTouched] = useState(false);
  useEffect(() => {
    if (!placedPin) return;
    setForm((old) => ({ ...old, sectorId: placedPin.sectorId || old.sectorId, posX: placedPin.position[0], posY: placedPin.position[1], posZ: placedPin.position[2] }));
    setMapTouched(true);
  }, [placedPin]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const review = useMutation(api.galaxyBuilder.review);
  const canReview = !!user && (user.role === "admin" || ["operator", "senior_operator", "story_editor", "lore_archivist"].includes(String(user.opRole ?? "")));
  const queue = useQuery(api.galaxyBuilder.reviewQueue, canReview ? { status: "pending" } : "skip");
  const sectors = atlas?.sectors ?? [];
  const selectedSector = sectors.find((sector) => sector.id === form.sectorId);
  const quadrant = sectors.find((sector) => sector.id === form.sectorId)?.quadrantId;
  const quadrantName = atlas?.quadrants.find((row) => row.id === quadrant)?.name;
  const proposals = useMemo(() => mine ?? [], [mine]);

  const update = <K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) => setForm((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    onDraftChange(mapTouched ? { position: [form.posX, form.posY, form.posZ], name: form.name || "Proposed discovery", color: form.color } : null);
  }, [form.color, form.name, form.posX, form.posY, form.posZ, mapTouched, onDraftChange]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.sectorId) return toast.error("Choose the sector for this discovery.");
    setBusy(true);
    try {
      await submit({
        sectorId: form.sectorId as Id<"sectors">,
        name: form.name,
        description: form.description,
        color: form.color,
        posX: form.posX,
        posY: form.posY,
        posZ: form.posZ,
        category: form.category || undefined,
        faction: form.faction || undefined,
        source,
        contextSlug,
        contextTitle,
      });
      toast.success("Discovery transmitted to the Atlas review queue.");
      setForm(EMPTY);
      setMapTouched(false);
      onCancelPlacement();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't transmit this discovery.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewProposal(id: Id<"galaxyProposals">, action: "approve" | "reject") {
    try {
      await review({ id, action, note: reviewNotes[id] });
      toast.success(action === "approve" ? "Discovery published to the shared Star Atlas." : "Proposal returned to its author.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review action failed.");
    }
  }

  return (
    <section id="builder" className="uf-section mx-auto max-w-[1500px] scroll-mt-24 px-4 sm:px-6 lg:px-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="uf-eyebrow text-uf-cyan">Star Atlas · Lore workshop</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Galaxy Lore Builder</h2>
          <p className="mt-3 text-sm leading-relaxed text-uf-muted sm:text-base">Chart a new system in the shared galaxy, write its field dossier, and send the complete discovery into the canon review pipeline. Approved discoveries become live stars and lore on this atlas.</p>
        </div>
        <Link to="/creator" className="uf-btn uf-btn--ghost"><Sparkles className="mr-2 h-4 w-4" aria-hidden />Creator Hub</Link>
      </header>

      {(source !== "freehand" || contextTitle || contextLocation) && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm">
          <Compass className="h-4 w-4 shrink-0 text-uf-cyan" aria-hidden />
          <span className="text-uf-muted">{sourceLabel(source)}{contextTitle ? " · " : ""}<strong className="text-uf-text">{contextTitle}</strong>{contextLocation ? ` · ${contextLocation}` : ""}</span>
          <Link to={source === "mission" ? `/missions/${contextSlug}` : source === "contest" ? `/contests/${contextSlug}` : "/creator"} className="ml-auto text-xs text-uf-cyan hover:underline">Return to {source === "mission" ? "mission" : source === "contest" ? "contest" : "Creator Hub"}</Link>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(350px,0.85fr)]">
        <HoloCard accent="cyan" className="!p-0 overflow-hidden">
          <div className="border-b border-[color:var(--uf-border)] px-5 py-4">
            <p className="uf-eyebrow">01 · Chart the discovery</p>
            <h3 className="mt-1 text-xl font-semibold">Pin it to the galaxy</h3>
            <p className="mt-1 text-xs text-uf-muted">Use the shared Star Atlas above to place this discovery. Its marker, sector geometry, stars, and camera are the same ones used by every chart visitor.</p>
          </div>
          <div className="p-4 sm:p-5">
            <label className="mb-3 block text-xs uppercase tracking-[0.14em] text-uf-muted">Destination sector
              <select className={`${fieldClass} mt-1.5`} value={form.sectorId} onChange={(event) => update("sectorId", event.target.value)} required>
                <option value="">Select a sector…</option>
                {atlas?.quadrants.map((quad) => <optgroup key={quad.id} label={quad.name}>{sectors.filter((sector) => sector.quadrantId === quad.id).map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</optgroup>)}
              </select>
            </label>
            <div className="rounded-lg border border-cyan-100/15 bg-[#050b16] p-4 sm:p-5">
              {mapTouched ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-medium text-cyan-50">Discovery pinned to the shared atlas</p><p className="mt-1 text-xs text-uf-muted">{selectedSector?.name ?? "Select a destination sector"} · {form.posX.toFixed(2)}, {form.posY.toFixed(2)}, {form.posZ.toFixed(2)}</p></div>
                  <button type="button" onClick={onRequestPlacement} className="inline-flex items-center gap-2 rounded-md border border-cyan-200/35 bg-slate-950/90 px-3 py-2 text-xs text-cyan-100 hover:border-cyan-100/70"><Crosshair className="h-4 w-4" aria-hidden /> Reposition on atlas</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-medium text-cyan-50">Choose a real chart coordinate</p><p className="mt-1 text-xs text-uf-muted">Orbit or zoom the shared 3D atlas above, then place a pin on its galactic plane.</p></div>
                  <button type="button" onClick={onRequestPlacement} className="inline-flex items-center gap-2 rounded-md border border-cyan-200/35 bg-slate-950/90 px-3 py-2 text-xs text-cyan-100 hover:border-cyan-100/70"><Crosshair className="h-4 w-4" aria-hidden /> Pin on shared atlas</button>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["posX", "posY", "posZ"] as const).map((axis) => <label key={axis} className="text-[10px] uppercase tracking-[0.14em] text-uf-muted">{axis.slice(-1)} coordinate<input className={`${fieldClass} mt-1`} type="number" step="0.1" min="-100" max="100" value={form[axis]} onChange={(event) => { update(axis, Number(event.target.value)); setMapTouched(true); }} /></label>)}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-[color:var(--uf-border)] bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-uf-muted">Selected chart cell</p><p className="mt-1 text-sm font-medium">{selectedSector?.name ?? "Choose a sector"}</p><p className="text-xs text-uf-muted">{quadrantName ?? "Choose or pin within the native chart"}</p></div>
              <div className="rounded-md border border-[color:var(--uf-border)] bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-uf-muted">Proposed coordinates</p><p className="mt-1 font-mono text-sm" style={{ color: form.color }}>{form.posX.toFixed(1)}, {form.posY.toFixed(1)}, {form.posZ.toFixed(1)}</p><p className="text-xs text-uf-muted">Galactic X · Y · Z</p></div>
            </div>
          </div>
        </HoloCard>

        <HoloCard accent="violet">
          <div className="mb-4">
            <p className="uf-eyebrow">02 · Write the field dossier</p>
            <h3 className="mt-1 text-xl font-semibold">Give the star a story</h3>
            <p className="mt-1 text-xs text-uf-muted">The author dossier is stored with the chart marker and released to public canon only after review.</p>
          </div>
          {!isAuthenticated ? (
            <div className="rounded-lg border border-cyan-200/20 bg-cyan-200/[0.04] p-4">
              <p className="text-sm font-medium">The chart is open. Canon authorship requires a pilot account.</p>
              <p className="mt-2 text-xs text-uf-muted">Your selected mission or contest will be preserved after sign-in.</p>
              <Link to={`/auth?returnTo=${encodeURIComponent(`/map${window.location.search}#builder`)}`} className="uf-btn uf-btn--primary mt-4 inline-flex"><ShieldCheck className="mr-2 h-4 w-4" aria-hidden />Sign in to submit</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="text-xs uppercase tracking-[0.14em] text-uf-muted">System / star name<input className={`${fieldClass} mt-1.5`} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. The Lantern at Vesper Reach" maxLength={80} required /></label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="text-xs uppercase tracking-[0.14em] text-uf-muted">Lore classification<select className={`${fieldClass} mt-1.5`} value={form.category} onChange={(event) => update("category", event.target.value)}><option value="hero">Hero</option><option value="villain">Villain</option><option value="neutral">Neutral</option><option value="ancient">Ancient</option><option value="guardian">Guardian</option><option value="mystery">Mystery</option></select></label>
                <label className="text-xs uppercase tracking-[0.14em] text-uf-muted">Star hue<input className="mt-1.5 h-[42px] w-full cursor-pointer rounded-md border border-[color:var(--uf-border)] bg-[rgba(8,16,31,0.82)] p-1" type="color" value={form.color} onChange={(event) => update("color", event.target.value)} aria-label="Star color" /></label>
              </div>
              <label className="text-xs uppercase tracking-[0.14em] text-uf-muted">Faction / regional authority<input className={`${fieldClass} mt-1.5`} value={form.faction} onChange={(event) => update("faction", event.target.value)} placeholder="Unaligned / unknown" maxLength={80} /></label>
              <label className="text-xs uppercase tracking-[0.14em] text-uf-muted">Field notes & lore<textarea className={`${fieldClass} mt-1.5 resize-y leading-relaxed`} rows={7} minLength={40} maxLength={1800} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the stellar system, its worlds, inhabitants, history, signals, hazards, or place in fleet records…" required /></label>
              <div className="flex items-center justify-between gap-3 text-[11px] text-uf-muted"><span>{sourceLabel(source)}{contextTitle ? ` · ${contextTitle}` : ""}</span><span>{form.description.length}/1800</span></div>
              <NeonButton type="submit" variant="primary" loading={busy} disabled={!form.name.trim() || form.description.trim().length < 40 || !form.sectorId}><Send className="mr-2 h-4 w-4" aria-hidden />Transmit for canon review</NeonButton>
              <p className="text-[11px] leading-relaxed text-uf-muted">Your proposal stays private to you and the canon review team until it is approved. Approved chart markers and lore notes publish together.</p>
            </form>
          )}
        </HoloCard>
      </div>

      <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <HoloCard>
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="uf-eyebrow">03 · Creator flight log</p><h3 className="mt-1 text-xl font-semibold">Your chart proposals</h3></div><StatusPill variant="cyan">{proposals.length} filed</StatusPill></div>
          {!isAuthenticated ? <p className="text-sm text-uf-muted">Sign in to save a discovery and track its review status here.</p> : mine === undefined ? <div className="uf-skeleton h-24" /> : proposals.length === 0 ? <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-5 text-sm text-uf-muted">No chart proposals filed yet. Your next field discovery can become part of the shared galaxy.</div> : <ul className="flex flex-col gap-2">{proposals.map((proposal) => <li key={proposal._id} className="rounded-md border border-[color:var(--uf-border)] bg-white/[0.025] p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{proposal.name}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusStyle(proposal.status)}`}>{proposal.status}</span><span className="ml-auto text-[10px] text-uf-muted">{sourceLabel(proposal.source)}{proposal.contextTitle ? ` · ${proposal.contextTitle}` : ""}</span></div><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-uf-muted">{proposal.description}</p>{proposal.reviewNote && <p className="mt-2 border-l-2 border-amber-200/50 pl-2 text-xs text-amber-100">Review note: {proposal.reviewNote}</p>}{proposal.status === "approved" && <Link to="/map" className="mt-2 inline-flex items-center gap-1 text-xs text-uf-cyan hover:underline">View canon atlas <ExternalLink className="h-3 w-3" aria-hidden /></Link>}</li>)}</ul>}
        </HoloCard>

        {canReview && <HoloCard accent="amber">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="uf-eyebrow">04 · High Command</p><h3 className="mt-1 text-xl font-semibold">Canon review queue</h3></div><StatusPill variant="warning">{queue?.length ?? "…"} pending</StatusPill></div>
          {queue === undefined ? <div className="uf-skeleton h-24" /> : queue.length === 0 ? <p className="rounded-md border border-dashed border-[color:var(--uf-border)] p-5 text-sm text-uf-muted">No chart proposals are waiting for review.</p> : <ul className="flex flex-col gap-3">{queue.map((proposal) => <li key={proposal._id} className="rounded-md border border-[color:var(--uf-border)] bg-white/[0.025] p-3"><div className="flex flex-wrap items-center gap-2"><Crosshair className="h-4 w-4 text-uf-cyan" aria-hidden /><span className="font-medium">{proposal.name}</span><span className="ml-auto text-[10px] text-uf-muted">{proposal.authorName} · {proposal.sectorName}</span></div><p className="mt-2 text-xs leading-relaxed text-uf-muted">{proposal.description}</p><p className="mt-2 text-[10px] uppercase tracking-wide text-uf-muted">{sourceLabel(proposal.source)}{proposal.contextTitle ? ` · ${proposal.contextTitle}` : ""} · XYZ {proposal.posX}, {proposal.posY}, {proposal.posZ}</p><input className={`${fieldClass} mt-3`} value={reviewNotes[proposal._id] ?? ""} onChange={(event) => setReviewNotes((old) => ({ ...old, [proposal._id]: event.target.value }))} placeholder="Optional note to the author" maxLength={500} /><div className="mt-3 flex flex-wrap gap-2"><NeonButton variant="primary" onClick={() => reviewProposal(proposal._id, "approve")}><Check className="mr-1.5 h-4 w-4" aria-hidden />Approve & publish</NeonButton><NeonButton variant="danger" onClick={() => reviewProposal(proposal._id, "reject")}>Reject with note</NeonButton></div></li>)}</ul>}
        </HoloCard>}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-uf-muted"><MapPinned className="h-4 w-4 shrink-0 text-uf-cyan" aria-hidden />{atlas === undefined ? "Loading shared atlas sectors…" : `${sectors.length} native sectors available for charting.`} Approved discoveries become visible in the interactive galaxy and its lore catalogue.</p>
    </section>
  );
}
