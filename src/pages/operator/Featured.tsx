import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Sparkles, ArrowUp, ArrowDown, X, Save } from "lucide-react";

export default function OperatorFeatured() {
  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-uf-violet" aria-hidden />
          Featured Content Manager
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Pin the front-page story, the lore spotlight lineup, and the video
          broadcast lineup. Every change is soft-applied and audit-logged.
        </p>
      </header>
      <div className="flex flex-col gap-6">
        <FeaturedStoryBlock />
        <FeaturedLoreBlock />
        <FeaturedVideoLineupBlock />
      </div>
    </OperatorShell>
  );
}

// -----------------------------------------------------------------------------
// Featured story (single-slot)
// -----------------------------------------------------------------------------

function FeaturedStoryBlock() {
  const featured = useQuery(api.content.listFeaturedStories, { limit: 1 });
  const candidates = useQuery(api.content.listStories, {
    status: "published",
    limit: 50,
  });
  const setFeatured = useMutation(api.operator.setFeaturedStory);
  const [pending, setPending] = useState<null | "save" | "unpin">(null);
  const [slugs, setSlugs] = useState<{ a?: string; b?: string }>({});

  // Two-step swap: pick candidate slug "a" → pin with order=1 → unpin the old.
  // Mutations are deterministic; we'll just call them serially with both ids.
  useEffect(() => {
    setSlugs({ a: featured?.[0]?.slug });
  }, [featured?.[0]?.slug]);

  const targetSlug = slugs.b ?? slugs.a;
  const targetId = candidates?.find((s) => s.slug === targetSlug)?._id ?? null;
  const oldId = featured?.[0]?._id ?? null;

  async function apply() {
    if (!targetId || targetId === oldId) return;
    setPending("save");
    try {
      await setFeatured({ id: targetId, featured: true, featuredOrder: 1 });
      if (oldId) await setFeatured({ id: oldId, featured: false });
      toast.success("Featured story replaced.");
    } catch {
      toast.error("Failed to replace.");
    } finally {
      setPending(null);
    }
  }
  async function unpin() {
    if (!oldId) return;
    if (!window.confirm("Unpin the current front-page story?")) return;
    setPending("unpin");
    try {
      await setFeatured({ id: oldId, featured: false });
      toast.success("Featured story unpinned.");
    } catch {
      toast.error("Failed to unpin.");
    } finally {
      setPending(null);
    }
  }

  return (
    <HoloCard>
      <header className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-xl font-semibold">Front-page story</h2>
        <StatusPill variant="violet">Single slot</StatusPill>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <span className="uf-eyebrow">Currently pinned</span>
          <p className="mt-2 text-base">
            {featured === undefined
              ? "Loading…"
              : featured.length === 0
                ? "No story currently featured."
                : featured[0].title}
          </p>
          <div className="mt-3">
            <NeonButton
              variant="danger"
              disabled={pending !== null || !oldId}
              onClick={unpin}
            >
              {pending === "unpin" ? "Unpinning…" : "Unpin current"}
            </NeonButton>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted">
            Replace with
          </label>
          <select
            value={targetSlug ?? ""}
            onChange={(e) => setSlugs((s) => ({ ...s, b: e.target.value }))}
            className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          >
            <option value="">— Pick a published story —</option>
            {(candidates ?? []).map((s) => (
              <option key={s._id} value={s.slug}>
                {s.title}
                {s.series ? ` · ${s.series}` : ""}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <NeonButton
              variant="primary"
              loading={pending === "save"}
              disabled={pending !== null || !targetId || targetId === oldId}
              onClick={apply}
            >
              <Save className="h-4 w-4" aria-hidden />
              Pin selected
            </NeonButton>
          </div>
        </div>
      </div>
    </HoloCard>
  );
}

// -----------------------------------------------------------------------------
// Featured lore (ordered list with add / re-order / remove)
// -----------------------------------------------------------------------------

function FeaturedLoreBlock() {
  const featured = useQuery(api.content.listFeaturedLore, { limit: 12 });
  const candidates = useQuery(api.content.listLore, { limit: 60 });
  const setFeatured = useMutation(api.operator.setFeaturedLore);
  const [pending, setPending] = useState<string | null>(null);
  const [addingSlug, setAddingSlug] = useState("");

  const sorted = useMemo(() => {
    if (!featured) return [];
    return [...featured].sort((a, b) => {
      const ao = a.featuredOrder ?? 0;
      const bo = b.featuredOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return b.createdAt - a.createdAt;
    });
  }, [featured]);

  async function reorder(id: Id<"loreEntries">, direction: "up" | "down") {
    const list = sorted;
    const idx = list.findIndex((e) => e._id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    setPending(`${id}_${direction}`);
    try {
      const a = list[idx];
      const b = list[swapIdx];
      const aOrder = a.featuredOrder ?? idx * 10 + 10;
      const bOrder = b.featuredOrder ?? swapIdx * 10 + 10;
      await Promise.all([
        setFeatured({ id: a._id, featured: true, featuredOrder: bOrder }),
        setFeatured({ id: b._id, featured: true, featuredOrder: aOrder }),
      ]);
    } catch {
      toast.error("Reorder failed.");
    } finally {
      setPending(null);
    }
  }
  async function remove(id: Id<"loreEntries">) {
    if (!window.confirm("Remove this lore entry from the spotlight lineup?"))
      return;
    setPending(`${id}_remove`);
    try {
      await setFeatured({ id, featured: false });
      toast.success("Removed from lineup.");
    } catch {
      toast.error("Remove failed.");
    } finally {
      setPending(null);
    }
  }
  async function add() {
    const cid = candidates?.find((e) => e.slug === addingSlug)?._id;
    if (!cid) return;
    const nextOrder =
      Math.max(0, ...sorted.map((e) => e.featuredOrder ?? 0)) + 10;
    setPending(`${cid}_add`);
    try {
      await setFeatured({ id: cid, featured: true, featuredOrder: nextOrder });
      setAddingSlug("");
      toast.success("Added to lineup.");
    } catch {
      toast.error("Add failed.");
    } finally {
      setPending(null);
    }
  }

  const candidateLore = (candidates ?? []).filter(
    (e) => !(featured ?? []).some((f) => f._id === e._id),
  );

  return (
    <HoloCard>
      <header className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-xl font-semibold">Lore spotlight lineup</h2>
        <StatusPill variant="info">Up to 12 pinned</StatusPill>
      </header>
      {sorted.length === 0 ? (
        <p className="text-uf-muted text-sm">No lore pinned yet.</p>
      ) : (
        <ol className="flex flex-col gap-2 list-none p-0 m-0">
          {sorted.map((entry, idx) => (
            <li
              key={entry._id}
              className="flex items-center justify-between gap-2 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-uf-muted w-6">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="truncate text-base">{entry.title}</span>
                {entry.faction ? (
                  <StatusPill variant="info">{entry.faction}</StatusPill>
                ) : null}
                {entry.entryType ? (
                  <StatusPill variant="violet">{entry.entryType}</StatusPill>
                ) : null}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Move up"
                  className="uf-btn uf-btn--ghost"
                  disabled={idx === 0 || pending === `${entry._id}_up`}
                  onClick={() => reorder(entry._id, "up")}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  className="uf-btn uf-btn--ghost"
                  disabled={
                    idx === sorted.length - 1 ||
                    pending === `${entry._id}_down`
                  }
                  onClick={() => reorder(entry._id, "down")}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Remove from lineup"
                  className="uf-btn uf-btn--danger"
                  disabled={pending === `${entry._id}_remove`}
                  onClick={() => remove(entry._id)}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="addlore"
            className="text-xs uppercase tracking-[0.16em] text-uf-muted"
          >
            Add lore entry
          </label>
          <select
            id="addlore"
            value={addingSlug}
            onChange={(e) => setAddingSlug(e.target.value)}
            className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          >
            <option value="">— Pick lore to pin —</option>
            {candidateLore.map((e) => (
              <option key={e._id} value={e.slug}>
                {e.title}
                {e.faction ? ` · ${e.faction}` : ""}
              </option>
            ))}
          </select>
        </div>
        <NeonButton
          variant="primary"
          loading={!!pending && pending.endsWith("_add")}
          disabled={!addingSlug}
          onClick={add}
        >
          Pin to lineup
        </NeonButton>
      </div>
    </HoloCard>
  );
}

// -----------------------------------------------------------------------------
// Featured video lineup (nowPlaying + upNext)
// -----------------------------------------------------------------------------

function FeaturedVideoLineupBlock() {
  const lineup = useQuery(api.content.getFeaturedVideoLineup, {});
  const available = useQuery(api.content.listTransmissions, { limit: 50 });
  const setLineup = useMutation(api.operator.setFeaturedVideoLineup);
  const [pending, setPending] = useState(false);
  const [slots, setSlots] = useState<[string, string, string]>([
    "",
    "",
    "",
  ]);

  useEffect(() => {
    if (!lineup || !available) return;
    const nowSlug = lineup.nowPlaying?.slug ?? "";
    const nextA = lineup.upNext?.[0]?.slug ?? "";
    const nextB = lineup.upNext?.[1]?.slug ?? "";
    setSlots([nowSlug, nextA, nextB]);
  }, [lineup, available]);

  const slugId = (slug: string) =>
    available?.find((t) => t.slug === slug)?._id ?? null;

  async function save() {
    setPending(true);
    try {
      const ids = slots.map(slugId);
      if (!ids[0] || !ids[1] || !ids[2]) {
        toast.error("All three slots must be filled.");
        setPending(false);
        return;
      }
      if (new Set(ids).size !== 3) {
        toast.error("Slots must contain three different transmissions.");
        setPending(false);
        return;
      }
      await setLineup({
        lineup: [
          { id: ids[0], featuredOrder: 1 },
          { id: ids[1], featuredOrder: 2 },
          { id: ids[2], featuredOrder: 3 },
        ],
      });
      toast.success("Lineup applied to /.");
    } catch {
      toast.error("Failed to apply lineup.");
    } finally {
      setPending(false);
    }
  }

  const slotLabels = ["Now Playing", "Up Next — Ep 01", "Up Next — Ep 02"] as const;

  return (
    <HoloCard>
      <header className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-xl font-semibold">Video broadcast lineup</h2>
        <StatusPill variant="gold">3 slots · applied atomically</StatusPill>
      </header>
      <p className="text-uf-muted text-sm mb-4">
        Saving replaces the entire lineup atomically. Empty slots block save.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map((slug, i) => (
          <div key={i}>
            <label
              htmlFor={`slot-${i}`}
              className="text-xs uppercase tracking-[0.16em] text-uf-muted"
            >
              {slotLabels[i]}
            </label>
            <select
              id={`slot-${i}`}
              value={slug}
              onChange={(e) => {
                const v = e.target.value;
                setSlots((prev) => {
                  const next = [...prev] as [string, string, string];
                  next[i] = v;
                  return next;
                });
              }}
              className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            >
              <option value="">— Pick a transmission —</option>
              {(available ?? []).map((t) => (
                <option
                  key={t._id}
                  value={t.slug}
                  disabled={slug !== "" && slots.includes(t.slug) && slots[i] !== t.slug}
                >
                  {t.title}
                  {t.transmissionType ? ` · ${t.transmissionType}` : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <NeonButton
          variant="primary"
          loading={pending}
          disabled={pending || slots.some((s) => !s)}
          onClick={save}
        >
          <Save className="h-4 w-4" aria-hidden />
          Apply lineup
        </NeonButton>
        <span className="text-uf-muted text-xs" aria-live="polite">
          {lineup === undefined
            ? "Loading current lineup…"
            : `Currently live: ${lineup.nowPlaying ? lineup.nowPlaying.title : "—"} → ${(lineup.upNext ?? []).map((t) => t.title).join(" → ") || "—"}`}
        </span>
      </div>
    </HoloCard>
  );
}
