import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { NotificationsPanel } from "@/components/widgets/NotificationsPanel";

import { usePageMeta } from "@/hooks/use-page-meta";
const PAGE_SIZE = 20;

// Human-readable labels for activity verbs; unknown verbs fall back to raw.
const VERB_LABELS: Record<string, string> = {
  published: "published",
  published_lore: "published lore",
  commented: "commented",
  joined: "joined",
  reacted: "reacted",
  messaged: "messaged",
  filed_report: "filed report",
};

export default function Activity() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const feed = useQuery(api.social.activityFeed, { limit: PAGE_SIZE, page: 1 });
  const myReports = useQuery(
    api.missions.myReportCount,
    isAuthenticated ? {} : "skip",
  );
  const [draft, setDraft] = useState("");
  const submitOps = useMutation(api.social.addComment);
  const [pagesFetched, setPagesFetched] = useState(1);
  const [autoLoad, setAutoLoad] = useState(true);

  usePageMeta({
    title: "Activity Feed — Star Force Base 1198",
    description:
      "Recent fleet activity — published stories, filed reports, new members.",
    noindex: false,
  });

  // Reduced-motion: turn off auto-loading; user must use Load More.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAutoLoad(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const pageQueries = useMemo(
    () =>
      Array.from({ length: pagesFetched }, (_, i) => ({
        query: api.social.activityFeed,
        args: { limit: PAGE_SIZE, page: i + 1 } as const,
      })),
    [pagesFetched],
  );
  const pageResults = useQueries(pageQueries as any);

  const merged = useMemo(() => {
    const flat: Array<{
      _id: string;
      verb: string;
      createdAt: number;
      actorId: string;
      targetType: string;
      targetId: string;
      url?: string;
      summary?: string;
    }> = [];
    for (let i = 0; i < pageResults.length; i++) {
      const r = pageResults[i];
      if (r === undefined) continue; // still loading
      for (const item of r) flat.push(item);
    }
    flat.sort((a, b) => b.createdAt - a.createdAt);
    return flat;
  }, [pageResults]);

  const lastPage = pageResults[pageResults.length - 1];
  const pageStillLoading =
    !!lastPage && lastPage === undefined && pagesFetched > 1;
  const initialLoading = feed === undefined;
  const hasMore =
    lastPage !== undefined &&
    (lastPage?.length ?? 0) === PAGE_SIZE;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoLoad || !hasMore || pageStillLoading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) {
          setPagesFetched((p) => p + 1);
        }
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoLoad, hasMore, pageStillLoading]);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Activity Feed"
        title="Comms channel open."
        lead="Post a transmission. React. Track the latest fleet activity."
        primary={
          isAuthenticated
            ? undefined
            : { label: "Sign in to post", href: "/auth", variant: "primary" }
        }
        secondary={{ label: "Back to home", href: "/", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="uf-grid uf-grid--3">
          <div className="lg:col-span-2 flex flex-col gap-4">
            {isAuthenticated &&
              myReports !== undefined &&
              myReports !== null &&
              myReports === 0 && (
                <HoloCard>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <span className="uf-eyebrow">Operation queue</span>
                      <h2 className="text-xl mt-1.5">Pick your first mission</h2>
                      <p className="text-uf-muted text-sm mt-1 max-w-[52ch]">
                        You haven't filed a field report yet. Run one open
                        operation and the Bridge logs your first XP.
                      </p>
                    </div>
                    <NeonButton
                      variant="primary"
                      onClick={() => navigate("/missions")}
                    >
                      Open the mission board
                    </NeonButton>
                  </div>
                </HoloCard>
              )}
            {isAuthenticated && (
              <HoloCard>
                <span className="uf-eyebrow">Compose</span>
                <h3 className="text-xl mt-2 mb-3">Post a transmission</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    await submitOps({
                      postId: "fleet:activity",
                      parentType: "activity",
                      content: draft,
                    });
                    setDraft("");
                  }}
                  className="flex flex-col gap-3"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="What did the fleet just observe?"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] min-h-24"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-uf-muted text-xs">
                      Posting as{" "}
                      {user?.displayName ?? user?.email ?? "anonymous"}
                    </span>
                    <NeonButton type="submit" variant="primary">
                      Transmit
                    </NeonButton>
                  </div>
                </form>
              </HoloCard>
            )}
            <ul
              role="feed"
              aria-busy={initialLoading || pageStillLoading}
              aria-live="polite"
              className="flex flex-col gap-3 list-none p-0 m-0"
            >
              {merged.length === 0 && initialLoading ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="uf-skeleton" style={{ height: 96 }} />
                ))
              ) : merged.length === 0 ? (
                <div className="uf-empty">
                  The fleet is quiet right now. Be the first to transmit.
                </div>
              ) : (
                merged.map((item) => (
                  <li key={item._id}>
                    <HoloCard>
                      <div className="flex items-center justify-between">
                        <StatusPill variant="info">
                          {VERB_LABELS[item.verb] ?? item.verb}
                        </StatusPill>
                        <time
                          className="text-xs text-uf-muted"
                          dateTime={new Date(item.createdAt).toISOString()}
                        >
                          {new Date(item.createdAt).toLocaleString()}
                        </time>
                      </div>
                      <h3 className="text-lg mt-2">
                        {item.summary ?? `${item.targetType}: ${item.targetId}`}
                      </h3>
                      {item.url && (
                        <Link to={item.url} className="uf-btn uf-btn--ghost mt-3">
                          Open target
                        </Link>
                      )}
                    </HoloCard>
                  </li>
                ))
              )}
            </ul>
            <div className="flex items-center justify-center py-4">
              {pageStillLoading ? (
                <div
                  className="uf-skeleton"
                  style={{ height: 32, width: 220 }}
                />
              ) : hasMore ? (
                <NeonButton
                  variant="ghost"
                  onClick={() => setPagesFetched((p) => p + 1)}
                >
                  Load more transmissions
                </NeonButton>
              ) : merged.length > 0 ? (
                <p className="text-uf-muted text-xs uppercase tracking-[0.16em]">
                  End of feed
                </p>
              ) : null}
              {/* Sentinel: auto-loads the next page when scrolled into view. */}
              <div
                ref={sentinelRef}
                aria-hidden
                className="h-px w-px"
              />
            </div>
          </div>
          <aside className="flex flex-col gap-4">
            <NotificationsPanel limit={8} />
            <HoloCard>
              <span className="uf-eyebrow">Member tools</span>
              <ul className="space-y-2 text-sm mt-2 list-none p-0">
                <li>
                  <Link to="/missions" className="text-uf-cyan">
                    Mission board
                  </Link>
                </li>
                <li>
                  <Link to="/members" className="text-uf-cyan">
                    Member directory
                  </Link>
                </li>
                <li>
                  <Link to="/groups" className="text-uf-cyan">
                    Groups
                  </Link>
                </li>
                <li>
                  <Link to="/community" className="text-uf-cyan">
                    Community hub
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="text-uf-cyan">
                    Open a ticket
                  </Link>
                </li>
              </ul>
            </HoloCard>
            <HoloCard>
              <span className="uf-eyebrow">Recent activity</span>
              <p className="text-uf-muted text-xs mt-2">
                {autoLoad
                  ? "Live: more pages load automatically as you reach the bottom."
                  : "Reduced-motion mode: use the Load more button above."}
              </p>
            </HoloCard>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
}
