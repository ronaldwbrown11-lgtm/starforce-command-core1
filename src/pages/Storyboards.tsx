import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { VisualUploader } from "@/components/visuals/VisualUploader";
import { CanonBadge } from "@/components/visuals/CanonBadge";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Film, Plus, Save, Share2, Trash2, X } from "lucide-react";

// =========================================================================
// Storyboard Builder (/storyboards) — drag-and-drop panel grid with
// captions, scene metadata, canon links, and export-to-gallery publishing.
//
// FUTURE FEATURE — DO NOT IMPLEMENT IN THIS BUILD:
//   version history, change logs, comment threads, shared/collaborative
//   storyboards, and artist mentions. Storyboards stay single-author here.
// =========================================================================

type PanelDraft = {
  imageId?: string;
  caption: string;
  scene: string;
  url?: string | null;
};

type Draft = {
  id?: string;
  title: string;
  summary: string;
  panels: PanelDraft[];
  missionLink: string;
  speciesLink: string;
  characterLink: string;
  published: boolean;
};

const EMPTY: Draft = {
  title: "",
  summary: "",
  panels: [{ caption: "", scene: "" }],
  missionLink: "",
  speciesLink: "",
  characterLink: "",
  published: false,
};

export default function Storyboards() {
  usePageMeta({
    title: "Storyboard Builder — Star Force Base 1198",
    description:
      "Compose canon storyboards panel by panel — captions, scene metadata, mission links, and export to the Canon Image Library.",
  });

  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const mine = useQuery(api.visuals.listStoryboards, { mine: true });
  const all = useQuery(api.visuals.listStoryboards, {});
  const myAssets = useQuery(
    api.visuals.listAssets,
    isAuthenticated ? { mine: true } : "skip",
  );
  const save = useMutation(api.visuals.saveStoryboard);
  const exportSb = useMutation(api.visuals.exportStoryboard);
  const removeSb = useMutation(api.visuals.removeStoryboard);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [activePanel, setActivePanel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  // Deep links: ?new=1 starts a fresh board, ?id= opens an existing one.
  useEffect(() => {
    const idParam = params.get("id");
    const newParam = params.has("new");
    const source = (mine ?? []).find((s) => s._id === idParam);
    if (source) {
      setDraft({
        id: source._id,
        title: source.title,
        summary: source.summary ?? "",
        panels: source.panels.map((p) => ({
          imageId: p.imageId,
          caption: p.caption ?? "",
          scene: p.scene ?? "",
          url: p.url,
        })),
        missionLink: source.missionLink ?? "",
        speciesLink: source.speciesLink ?? "",
        characterLink: source.characterLink ?? "",
        published: source.published,
      });
    } else if (newParam) {
      setDraft(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, mine]);

  const boardList = useMemo(() => {
    const seen = new Set<string>();
    return [...(mine ?? []), ...(all ?? [])]
      .filter((s) => {
        if (seen.has(s._id)) return false;
        seen.add(s._id);
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [mine, all]);

  const openParam = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    setParams(p, { replace: true });
  };

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const patchPanel = (i: number, p: Partial<PanelDraft>) =>
    setDraft((d) => ({
      ...d,
      panels: d.panels.map((panel, idx) =>
        idx === i ? { ...panel, ...p } : panel,
      ),
    }));

  async function saveDraft() {
    if (!draft.title.trim()) {
      toast.error("Give the storyboard a title.");
      return;
    }
    setBusy(true);
    try {
      const res = await save({
        id: draft.id as Id<"storyboards"> | undefined,
        title: draft.title.trim(),
        summary: draft.summary || undefined,
        missionLink: draft.missionLink || undefined,
        speciesLink: draft.speciesLink || undefined,
        characterLink: draft.characterLink || undefined,
        panels: draft.panels.map((p) => ({
          imageId: p.imageId as Id<"visualAssets"> | undefined,
          caption: p.caption || undefined,
          scene: p.scene || undefined,
        })),
      });
      patch({ id: res.id });
      openParam({ id: res.id });
      toast.success("Storyboard saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleExport() {
    if (!draft.id) {
      toast.error("Save the storyboard first.");
      return;
    }
    try {
      await exportSb({ id: draft.id as Id<"storyboards">, publish: !draft.published });
      patch({ published: !draft.published });
      toast.success(
        draft.published
          ? "Removed from the gallery."
          : "Exported to the Canon Image Library.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function deleteDraft() {
    if (!draft.id) return;
    if (!window.confirm(`Delete storyboard "${draft.title}"?`)) return;
    try {
      await removeSb({ id: draft.id as Id<"storyboards"> });
      setDraft(EMPTY);
      openParam({ new: "1" });
      toast.success("Storyboard deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  const assignToPanel = (assetId: string, url: string | null) => {
    if (draft.panels[activePanel]) {
      patchPanel(activePanel, { imageId: assetId, url });
    } else {
      patch({
        panels: [...draft.panels, { imageId: assetId, url, caption: "", scene: "" }],
      });
    }
    setTrayOpen(false);
  };

  const trayAssets = (myAssets ?? []).filter((a) => a.url);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Visual creation"
        title="Storyboard Builder"
        lead="Compose canon sequences panel by panel — drag artwork from your tray, caption each beat, attach scene metadata, then export the board to the Canon Image Library."
        primary={{
          label: "New storyboard",
          href: "#builder",
          variant: "primary",
        }}
        secondary={{ label: "Canon Image Library", href: "/canon-images", variant: "ghost" }}
      />

      <section
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
        id="builder"
      >
        <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
          {/* ---- Saved boards list ------------------------------------- */}
          <HoloCard className="sf-glass">
            <div className="flex items-center justify-between gap-2">
              <h2 className="sf-head text-lg font-semibold">Boards</h2>
              <NeonButton
                variant="ghost"
                onClick={() => {
                  setDraft(EMPTY);
                  openParam({ new: "1" });
                }}
              >
                <Plus className="h-4 w-4" aria-hidden /> New
              </NeonButton>
            </div>
            {boardList.length === 0 ? (
              <p className="text-uf-muted text-sm mt-3">
                No storyboards yet — start a new board.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5 list-none p-0 m-0">
                {boardList.map((s) => (
                  <li key={s._id}>
                    <button
                      type="button"
                      onClick={() => openParam({ id: s._id })}
                      className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                        draft.id === s._id
                          ? "border-[rgba(0,200,255,0.55)] bg-[rgba(0,200,255,0.08)] sf-nav-active"
                          : "border-[color:var(--uf-border)] hover:bg-[rgba(0,200,255,0.06)]"
                      }`}
                    >
                      <span className="font-semibold block truncate">{s.title}</span>
                      <span className="text-uf-muted text-xs">
                        {s.panels.length} panel{s.panels.length === 1 ? "" : "s"}
                        {s.published ? " · gallery" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </HoloCard>

          {/* ---- Builder ------------------------------------------------ */}
          <div className="flex flex-col gap-4">
            <HoloCard className="sf-glass">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-uf-cyan" aria-hidden />
                  <h2 className="sf-head text-lg font-semibold">
                    {draft.id ? "Edit board" : "New board"}
                  </h2>
                  {draft.published ? <CanonBadge status="approved" /> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <NeonButton
                    variant="gold"
                    onClick={() => void saveDraft()}
                    loading={busy}
                    disabled={busy}
                  >
                    <Save className="h-4 w-4" aria-hidden /> Save
                  </NeonButton>
                  <NeonButton
                    variant={draft.published ? "ghost" : "primary"}
                    onClick={() => void toggleExport()}
                    disabled={!draft.id}
                  >
                    <Share2 className="h-4 w-4" aria-hidden />
                    {draft.published ? "Unpublish" : "Export to gallery"}
                  </NeonButton>
                  {draft.id ? (
                    <NeonButton variant="danger" onClick={() => void deleteDraft()}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </NeonButton>
                  ) : null}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <label className="sm:col-span-2 text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
                  Board title *
                  <input
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    maxLength={120}
                    placeholder="e.g. Operation Nightfall — opening sequence"
                    className="sf-input w-full rounded-md px-3 py-2 text-sm"
                  />
                </label>
                <label className="sm:col-span-2 text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
                  Summary
                  <textarea
                    value={draft.summary}
                    onChange={(e) => patch({ summary: e.target.value })}
                    rows={2}
                    maxLength={1000}
                    className="sf-input w-full rounded-md px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
                  Mission link
                  <input
                    value={draft.missionLink}
                    onChange={(e) => patch({ missionLink: e.target.value })}
                    maxLength={120}
                    placeholder="e.g. Operation Nightfall"
                    className="sf-input w-full rounded-md px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
                  Species link
                  <input
                    value={draft.speciesLink}
                    onChange={(e) => patch({ speciesLink: e.target.value })}
                    maxLength={120}
                    placeholder="e.g. Vashti"
                    className="sf-input w-full rounded-md px-3 py-2 text-sm"
                  />
                </label>
                <label className="sm:col-span-2 text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
                  Character link
                  <input
                    value={draft.characterLink}
                    onChange={(e) => patch({ characterLink: e.target.value })}
                    maxLength={120}
                    placeholder="e.g. Cmdr. Vega"
                    className="sf-input w-full rounded-md px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </HoloCard>

            {/* ---- Panel grid ------------------------------------------- */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="uf-eyebrow uf-eyebrow--gold sf-pulse-soft">
                Panels · {draft.panels.length}/12
              </span>
              <div className="flex gap-2">
                <NeonButton variant="ghost" onClick={() => setTrayOpen((v) => !v)}>
                  {trayOpen ? "Close tray" : "Open asset tray"}
                </NeonButton>
                <NeonButton
                  variant="ghost"
                  onClick={() =>
                    draft.panels.length < 12 &&
                    patch({ panels: [...draft.panels, { caption: "", scene: "" }] })
                  }
                  disabled={draft.panels.length >= 12}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add panel
                </NeonButton>
              </div>
            </div>

            {trayOpen ? (
              <HoloCard className="sf-glass">
                <p className="text-uf-muted text-xs mb-2">
                  Drag an asset onto a panel, or click it to place it in the
                  selected panel. No assets yet?{" "}
                  <button
                    type="button"
                    className="text-uf-cyan underline"
                    onClick={() => setTrayOpen(false)}
                  >
                    upload one below
                  </button>
                  .
                </p>
                {trayAssets.length === 0 ? (
                  <p className="text-uf-muted text-sm">
                    Your asset tray is empty — upload artwork first.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {trayAssets.map((a) => (
                      <button
                        key={a._id}
                        type="button"
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/asset-id", a._id)
                        }
                        onClick={() =>
                          assignToPanel(
                            a._id,
                            (a as { url: string | null }).url,
                          )
                        }
                        title={a.title}
                        className={`rounded-md overflow-hidden border transition-shadow ${
                          draft.panels[activePanel]?.imageId === a._id
                            ? "border-[rgba(0,200,255,0.7)] shadow-[0_0_12px_rgba(0,200,255,0.4)]"
                            : "border-[color:var(--uf-border)] hover:shadow-[0_0_12px_rgba(0,200,255,0.3)]"
                        }`}
                      >
                        <img
                          src={(a as { url: string | null }).url ?? ""}
                          alt={a.title}
                          loading="lazy"
                          className="h-20 w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </HoloCard>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {draft.panels.map((p, i) => (
                <div
                  key={i}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const assetId = e.dataTransfer.getData("text/asset-id");
                    if (!assetId) return;
                    const asset = trayAssets.find((a) => a._id === assetId);
                    if (!asset) return;
                    patchPanel(i, {
                      imageId: assetId,
                      url: (asset as { url: string | null }).url,
                    });
                  }}
                  onClick={() => setActivePanel(i)}
                  className={`rounded-[14px] p-[3px] cursor-pointer transition-shadow ${
                    activePanel === i
                      ? "shadow-[0_0_18px_rgba(0,200,255,0.35)]"
                      : ""
                  }`}
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,244,200,0.45) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.28) 100%)",
                    backgroundSize: "100% 100%",
                  }}
                >
                  <div className="sf-glass rounded-[11px] overflow-hidden h-full flex flex-col">
                    <div className="relative aspect-video bg-[rgba(2,11,26,0.55)] grid place-items-center">
                      {p.url ? (
                        <img
                          src={p.url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-uf-muted text-xs uppercase tracking-[0.14em]">
                          drop image
                        </span>
                      )}
                      <span className="absolute top-1.5 left-1.5 sf-deck rounded bg-[rgba(2,11,26,0.8)] border border-[rgba(230,168,23,0.5)] px-1.5 text-[10px] font-bold text-uf-gold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {p.imageId ? (
                        <button
                          type="button"
                          aria-label={`Remove image from panel ${i + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            patchPanel(i, { imageId: undefined, url: null });
                          }}
                          className="absolute top-1.5 right-1.5 rounded bg-[rgba(2,11,26,0.8)] border border-[rgba(255,77,109,0.6)] p-1 text-[#FF6B85]"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <div className="p-2.5 flex flex-col gap-2">
                      <input
                        value={p.scene}
                        onChange={(e) => patchPanel(i, { scene: e.target.value })}
                        placeholder="Scene metadata (e.g. EXT. BELT STATION — NIGHT)"
                        className="sf-input w-full rounded px-2 py-1.5 text-xs"
                      />
                      <textarea
                        value={p.caption}
                        onChange={(e) => patchPanel(i, { caption: e.target.value })}
                        rows={2}
                        maxLength={600}
                        placeholder="Caption…"
                        className="sf-input w-full rounded px-2 py-1.5 text-xs resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ---- Upload straight into the tray ------------------------ */}
            <VisualUploader
              defaults={{ kind: "storyboard", folder: "Storyboards" }}
              submitLabel="Add to asset tray"
            />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
