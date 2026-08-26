import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";
import { NeonButton } from "../uf/NeonButton";
import { MiniBadgeRow } from "./MiniBadgeRow";
import { Flair } from "./Flair";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type ReactionKind = "transmit" | "salute" | "warn";

const REACTION_LABEL: Record<ReactionKind, string> = {
  transmit: "Transmit",
  salute: "Salute",
  warn: "Warn",
};

export function LiveComments({
  postId,
  parentType,
  limit = 20,
}: {
  postId: string;
  parentType: "story" | "lore" | "transmission" | "activity";
  limit?: number;
}) {
  const { isAuthenticated } = useAuth();
  const items = useQuery(api.social.listComments, { postId, parentType, limit });
  const add = useMutation(api.social.addComment);
  const react = useMutation(api.social.toggleReaction);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Sign in to comment.");
      return;
    }
    if (!draft.trim()) return;
    setPending(true);
    try {
      await add({ postId, parentType, content: draft });
      setDraft("");
      toast.success("Comment transmitted.");
    } catch {
      toast.error("Failed to post comment.");
    } finally {
      setPending(false);
    }
  }

  async function toggle(targetId: string, kind: ReactionKind) {
    if (!isAuthenticated) {
      toast.error("Sign in to react.");
      return;
    }
    try {
      await react({ targetId, targetType: "comment", kind });
    } catch {
      toast.error("Failed to react.");
    }
  }

  return (
    <section
      aria-labelledby="uf-comments-heading"
      className="uf-panel p-5"
      data-uf-widget="live-comments"
    >
      <header className="flex items-center justify-between mb-3">
        <h3 id="uf-comments-heading" className="uf-eyebrow">Live comments</h3>
        <StatusPill variant="info" aria-live="polite">
          {items?.length ?? 0}
        </StatusPill>
      </header>

      {isAuthenticated ? (
        <form onSubmit={submit} className="flex flex-col gap-3 mb-4" aria-label="Add comment">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Compose
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What's the fleet observing?"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] min-h-20"
            />
          </label>
          <NeonButton
            variant="primary"
            type="submit"
            loading={pending}
            disabled={pending || !draft.trim()}
          >
            Transmit
          </NeonButton>
        </form>
      ) : (
        <div className="uf-empty" role="status">
          Sign in to add a comment.
        </div>
      )}

      <ul
        role="feed"
        aria-busy={items === undefined}
        aria-live="polite"
        className="flex flex-col gap-3 list-none p-0 m-0"
      >
        {items === undefined ? (
          [0, 1].map((i) => (
            <li key={i}>
              <div className="uf-skeleton" style={{ height: 64 }} />
            </li>
          ))
        ) : items.length === 0 ? (
          <li className="uf-empty">No comments yet. Be the first to transmit.</li>
        ) : (
          items.map((c) => (
            <li key={c._id}>
              <article className="uf-card !p-3">
                <header className="flex flex-wrap items-center gap-2 mb-2">
                  {c.author ? (
                    <>
                      <span className="text-xs font-semibold tracking-wide text-uf-cyan">
                        {c.author.displayName}
                      </span>
                      {c.author.flair ? <Flair label={c.author.flair} /> : null}
                      <span className="uf-pill !text-[10px] !px-2 !py-0.5">
                        {c.author.rank}
                      </span>
                      <MiniBadgeRow ids={c.author.achievements} max={3} />
                    </>
                  ) : null}
                </header>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                <footer className="flex flex-wrap items-center justify-between mt-2 text-xs text-uf-muted gap-2">
                  <time dateTime={new Date(c.createdAt).toISOString()}>
                    {new Date(c.createdAt).toLocaleString()}
                  </time>
                  <div className="flex gap-1">
                    {(Object.keys(REACTION_LABEL) as ReactionKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="uf-pill"
                        aria-pressed={false}
                        onClick={() => toggle(c._id, k)}
                      >
                        {REACTION_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </footer>
              </article>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
