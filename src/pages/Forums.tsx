import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useSearchParams } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill, NeonButton } from "@/components/uf";
import { ReactionBar } from "@/components/widgets/ReactionBar";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, type FormEvent } from "react";

import { usePageMeta } from "@/hooks/use-page-meta";
const BOARDS = [
  { id: "general", name: "General Operations", description: "Cross-faction discussion." },
  { id: "operations", name: "Operations", description: "Recon, survey, mission debriefs." },
  { id: "onboarding", name: "Cadet Onboarding", description: "Welcome and orientation." },
  { id: "lore", name: "Lore Council", description: "Cross-faction lore proposals." },
];

function displayName(u: { displayName?: string | null; name?: string | null } | null | undefined) {
  return u?.displayName || u?.name || "Unknown pilot";
}

export default function Forums() {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadSlug = searchParams.get("thread");
  const forumId = searchParams.get("forum") || undefined;
  const { isAuthenticated } = useAuth();

  const threads = useQuery(api.groups.listForumThreads, { limit: 30, forumId });
  const detail = useQuery(
    api.groups.threadBySlug,
    threadSlug ? { slug: threadSlug } : "skip",
  );
  const addReply = useMutation(api.groups.addReply);
  const createThread = useMutation(api.groups.createThread);

  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [newForum, setNewForum] = useState("general");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail?.thread || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await addReply({ threadId: detail.thread._id, content: replyText.trim() });
      setReplyText("");
      toast.success("Reply transmitted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post reply.");
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      await createThread({
        forumId: newForum,
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setNewTitle("");
      setNewContent("");
      toast.success("Thread created. It's live in the list below.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create thread.");
    } finally {
      setCreating(false);
    }
  };

  // ---- Thread detail view ------------------------------------------------
  if (threadSlug) {
  usePageMeta({ title: "Forums — Star Force Base 1198", description: "Tactical discussions, lore debates, and fleet coordination threads.", noindex: false });

    return (
      <SiteShell>
        <PageHero
          eyebrow="Forums"
          title={detail?.thread?.title ?? "Thread"}
          lead="Long-form discussion ranks."
          primary={{ label: "All threads", href: "/forums", variant: "ghost" }}
        secondary={{ label: "New thread", href: "/forums#new-thread", variant: "primary" }}
      />
        <section className="uf-section max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8">
          {detail === undefined ? (
            <div className="uf-skeleton" style={{ height: 200 }} />
          ) : detail === null ? (
            <div className="uf-empty">Thread not found.</div>
          ) : (
            <>
              <HoloCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <StatusPill variant="info">{detail.thread.forumId}</StatusPill>
                    <h2 className="text-2xl font-semibold mt-3">{detail.thread.title}</h2>
                    <p className="text-uf-muted text-xs mt-1">
                      Posted by {displayName(detail.author)} •{" "}
                      {new Date(detail.thread.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed whitespace-pre-wrap">{detail.thread.content}</p>
              </HoloCard>

              <div className="mt-6">
                <ReactionBar targetId={detail.thread._id} targetType="thread" />
              </div>

              <h3 className="text-lg font-semibold mt-8 mb-4">
                {detail.replies.length} repl{detail.replies.length === 1 ? "y" : "ies"}
              </h3>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {detail.replies.length === 0 && (
                  <p className="text-uf-muted text-sm">No replies yet. Open a channel.</p>
                )}
                {detail.replies.map((r) => (
                  <li key={r._id}>
                    <HoloCard>
                      <p className="text-xs text-uf-muted">
                        {displayName(r.author)} • {new Date(r.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{r.content}</p>
                    </HoloCard>
                  </li>
                ))}
              </ul>

              <HoloCard className="mt-8">
                <span className="uf-eyebrow">Reply</span>
                {isAuthenticated ? (
                  <form className="mt-3 flex flex-col gap-3" onSubmit={handleReply}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      required
                      placeholder="Add to the briefing…"
                      className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                    />
                    <div className="flex justify-end">
                      <NeonButton type="submit" variant="primary" loading={sendingReply} disabled={!replyText.trim()}>
                        Post reply
                      </NeonButton>
                    </div>
                  </form>
                ) : (
                  <div className="mt-3 flex items-center gap-3">
                    <p className="text-uf-muted text-sm">Sign in to join the discussion.</p>
                    <NeonButton variant="primary" onClick={() => (window.location.href = "/auth")}>
                      Sign in
                    </NeonButton>
                  </div>
                )}
              </HoloCard>
            </>
          )}
        </section>
      </SiteShell>
    );
  }

  // ---- Overview / list view ---------------------------------------------
  return (
    <SiteShell>
      <PageHero
        eyebrow="Forums"
        title="Long-form discussion ranks."
        lead="Wiki + comms hybrid. Thread archives searchable. Ranked reply weighting."
        primary={{ label: "Start a thread", href: "#new-thread", variant: "primary" }}
        secondary={{ label: "Join a group", href: "/groups", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="uf-grid uf-grid--2">
          <HoloCard>
            <span className="uf-eyebrow">Boards</span>
            <h2 className="text-2xl font-semibold mt-2">Forum overview</h2>
            <ul className="mt-4 space-y-3">
              {BOARDS.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-[color:var(--uf-border)]">
                  <div>
                    <h3 className="text-base font-semibold">{b.name}</h3>
                    <p className="text-uf-muted text-xs">{b.description}</p>
                  </div>
                  <Link to={`/forums?forum=${b.id}`} className="uf-btn uf-btn--ghost">Enter</Link>
                </li>
              ))}
            </ul>
          </HoloCard>
          <HoloCard id="new-thread">
            <span className="uf-eyebrow">New thread</span>
            <h2 className="text-2xl font-semibold mt-2">Open a discussion</h2>
            {isAuthenticated ? (
              <form className="mt-4 flex flex-col gap-3" onSubmit={handleCreate}>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Board
                  <select
                    value={newForum}
                    onChange={(e) => setNewForum(e.target.value)}
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  >
                    {BOARDS.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Title
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    placeholder="Thread title"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Message
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={4}
                    required
                    placeholder="What's on your mind, pilot?"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <NeonButton type="submit" variant="primary" loading={creating} disabled={!newTitle.trim() || !newContent.trim()}>
                  Create thread
                </NeonButton>
              </form>
            ) : (
              <div className="mt-4 flex items-center gap-3">
                <p className="text-uf-muted text-sm">Sign in to open a thread.</p>
                <NeonButton variant="primary" onClick={() => (window.location.href = "/auth")}>Sign in</NeonButton>
              </div>
            )}
          </HoloCard>
        </div>
      </section>
      <section id="threads" className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6">
          <span className="uf-eyebrow">{forumId ? `Board: ${forumId}` : "All threads"}</span>
          <h2 className="text-3xl font-semibold mt-2">
            {threads === undefined ? "Loading threads…" : `${threads.length} thread${threads.length === 1 ? "" : "s"}.`}
          </h2>
        </header>
        {threads && threads.length === 0 ? (
          <div className="uf-empty">No threads yet. Be the first to post.</div>
        ) : (
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {threads?.map((t, idx) => (
              <li key={t._id}>
                <ScaleReveal staggerIndex={idx}>
                <HoloCard>
                  <Link to={`/forums?thread=${t.slug}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <StatusPill variant="info">{t.forumId}</StatusPill>
                        <h3 className="text-lg mt-2 font-semibold hover:text-[var(--uf-cyan)] transition-colors">{t.title}</h3>
                        <p className="text-uf-muted text-sm mt-1 line-clamp-2">{t.content}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <StatusPill variant="info">{t.replyCount ?? 0} repl{t.replyCount === 1 ? "y" : "ies"}</StatusPill>
                        <p className="text-xs text-uf-muted mt-2">Last activity {new Date(t.lastActivityAt ?? t.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </Link>
                </HoloCard>
              </ScaleReveal>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}
