import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { Bookmark, Library, Trash2 } from "lucide-react";
import { HoloCard, NeonButton, StatusPill } from "../uf";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Personal Codex — a member's bookmarked lore and stories. Saves are one row
// per (member, entry); the list renders from the stored title/slug snapshot
// so it needs no joins. Shown on the Account page.
// ---------------------------------------------------------------------------

export function CodexPanel({ limit }: { limit?: number }) {
  const saves = useQuery(api.engagement.listCodex, {});
  const remove = useMutation(api.engagement.toggleCodexSave);
  const [pending, setPending] = useState<string | null>(null);

  const visible = useMemo(
    () => (limit ? (saves ?? []).slice(0, limit) : (saves ?? [])),
    [saves, limit],
  );

  if (saves === undefined) {
    return (
      <HoloCard aria-label="Codex loading">
        <div className="uf-skeleton" style={{ height: 120 }} />
      </HoloCard>
    );
  }

  async function handleRemove(id: string, entryId: string) {
    setPending(id);
    try {
      await remove({
        entryType: "lore",
        entryId,
        title: "",
        slug: "",
      }).catch(async () => {
        // toggleCodexSave with empty title fails validation on a new save,
        // but an existing row takes the delete path before validation —
        // belt-and-braces: call with the row's own snapshot.
        const row = (saves ?? []).find((s) => s._id === id);
        await remove({
          entryType: (row?.entryType as "lore" | "story") ?? "lore",
          entryId,
          title: row?.title ?? "",
          slug: row?.slug ?? "",
        });
      });
      toast.success("Removed from your codex.");
    } catch {
      toast.error("Couldn't remove that entry.");
    } finally {
      setPending(null);
    }
  }

  return (
    <HoloCard aria-label="Personal codex">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="uf-eyebrow flex items-center gap-1.5">
            <Library className="h-3.5 w-3.5" aria-hidden /> Personal Codex
          </span>
          <p className="text-uf-muted text-sm mt-1">
            Entries you've flagged for study — your shelf of the archive.
          </p>
        </div>
        <StatusPill variant={saves.length > 0 ? "default" : "info"}>
          {saves.length}
        </StatusPill>
      </div>

      {saves.length === 0 ? (
        <p className="text-uf-muted text-sm mt-4">
          Nothing saved yet. Open any{" "}
          <Link to="/lore" className="text-uf-cyan">
            lore entry
          </Link>{" "}
          and tap <Bookmark className="inline h-3.5 w-3.5 -mt-0.5" aria-hidden />{" "}
          to start your codex.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 mt-4 list-none p-0 m-0">
          {visible.map((s) => (
            <li key={s._id}>
              <div className="flex items-center gap-2 rounded-md border border-[color:var(--uf-border)] px-3 py-2">
                <Bookmark
                  className="h-4 w-4 shrink-0 text-uf-cyan"
                  aria-hidden
                />
                <Link
                  to={
                    s.entryType === "story"
                      ? `/stories/${s.slug}`
                      : `/lore/${s.slug}`
                  }
                  className="min-w-0 flex-1 text-sm text-uf-text hover:text-uf-cyan transition-colors truncate"
                >
                  {s.title}
                </Link>
                <span className="text-[10px] uppercase tracking-[0.16em] text-uf-muted shrink-0">
                  {s.entryType}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${s.title} from codex`}
                  className="uf-btn uf-btn--ghost p-1.5 shrink-0 cursor-pointer"
                  disabled={pending === s._id}
                  onClick={() => handleRemove(s._id, s.entryId)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
          {limit && saves.length > limit ? (
            <li className="text-xs text-uf-muted px-1">
              {saves.length - limit} more…
            </li>
          ) : null}
        </ul>
      )}
    </HoloCard>
  );
}

/**
 * Compact save/remove toggle for lore and story detail pages. Renders
 * nothing while auth resolves; prompts sign-in for guests.
 */
export function CodexSaveButton({
  entryType,
  entryId,
  title,
  slug,
  isAuthenticated,
}: {
  entryType: "lore" | "story";
  entryId: string;
  title: string;
  slug: string;
  isAuthenticated: boolean;
}) {
  const saved = useQuery(api.engagement.isCodexSaved, { entryId });
  const toggle = useMutation(api.engagement.toggleCodexSave);

  async function handleToggle() {
    if (!isAuthenticated) {
      toast.error("Sign in to save entries to your codex.");
      return;
    }
    try {
      const res = await toggle({ entryType, entryId, title, slug });
      toast.success(
        res.saved ? "Saved to your codex." : "Removed from your codex.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    }
  }

  if (!isAuthenticated) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={saved === true}
      title={saved ? "Remove from codex" : "Save to codex"}
      className={`uf-btn uf-btn--ghost cursor-pointer min-h-[44px] ${
        saved ? "text-uf-cyan" : "text-uf-muted"
      }`}
    >
      <Bookmark
        className="h-4 w-4 mr-1.5"
        aria-hidden
        fill={saved ? "currentColor" : "none"}
      />
      {saved ? "Saved" : "Save to codex"}
    </button>
  );
}
