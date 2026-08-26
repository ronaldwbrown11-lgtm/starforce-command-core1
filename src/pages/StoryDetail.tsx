import { useParams, Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRef } from "react";
import { SiteShell, PageHero, StatusPill } from "@/components/uf";
import { StoryProgressTracker } from "@/components/widgets/StoryProgressTracker";
import { ReactionBar } from "@/components/widgets/ReactionBar";
import { MiniBadgeRow } from "@/components/widgets/MiniBadgeRow";
import { LiveComments } from "@/components/widgets/LiveComments";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function StoryDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const story = useQuery(api.content.storyBySlug, { slug });
  const articleRef = useRef<HTMLElement | null>(null);

  usePageMeta({
    title: story ? `${story.title} — Star Force 1198` : "Story — Star Force 1198",
    description: story?.excerpt ?? undefined,
  });

  if (story === undefined) {
    return (
      <SiteShell>
        <PageHero eyebrow="Transmission" title="Loading story…" />
        <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="uf-skeleton" style={{ height: 320 }} />
        </section>
      </SiteShell>
    );
  }
  if (story === null) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Out of range"
          title="Story not found"
          lead="The transmission you're looking for has gone dark."
          primary={{ label: "Browse stories", href: "/stories", variant: "primary" }}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow={story.series ?? "Standalone"}
        title={story.title}
        lead={story.excerpt}
        primary={{ label: "Continue reading", href: "#article", variant: "primary" }}
        secondary={{ label: "Back to stories", href: "/stories", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        {story.author ? (
          <aside
            aria-label="Story author"
            className="uf-card mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 !p-4"
          >
            <span className="text-xs uppercase tracking-[0.18em] text-uf-muted">
              Filed by
            </span>
            <span className="text-sm font-semibold text-uf-cyan">
              {story.author.displayName}
            </span>
            <span className="uf-pill !text-[10px] !px-2 !py-0.5">
              {story.author.rank}
            </span>
            <MiniBadgeRow ids={story.author.achievements} max={4} />
          </aside>
        ) : null}
        <div className="sticky top-20 z-10 mb-6">
          <StoryProgressTracker
            storyId={story._id}
            targetRef={articleRef}
          />
        </div>
        <article
          id="article"
          ref={articleRef}
          className="uf-panel p-6 md:p-10"
          aria-label={`Story: ${story.title}`}
        >
          <header className="flex items-center flex-wrap gap-2 mb-4">
            {story.classification ? (
              <StatusPill variant="warning">{story.classification}</StatusPill>
            ) : null}
            {(story.factions ?? []).slice(0, 3).map((f) => (
              <StatusPill key={f} variant="info">
                {f}
              </StatusPill>
            ))}
            {story.readMinutes ? (
              <StatusPill variant="default">~{story.readMinutes} min</StatusPill>
            ) : null}
          </header>
          <div className="text-base leading-relaxed whitespace-pre-wrap">
            {story.content}
          </div>
          {story.tags && story.tags.length > 0 ? (
            <footer className="mt-6 flex flex-wrap gap-2">
              {story.tags.map((t) => (
                <Link
                  key={t}
                  to={`/stories?tag=${encodeURIComponent(t)}`}
                  className="uf-pill hover:shadow-[var(--uf-glow-cyan)]"
                >
                  #{t}
                </Link>
              ))}
            </footer>
          ) : null}
        </article>
        <div className="mt-6">
          <ReactionBar targetId={story._id} />
        </div>
        <div className="mt-8">
          <LiveComments
            postId={story._id}
            parentType="story"
            limit={20}
          />
        </div>
      </section>
    </SiteShell>
  );
}
