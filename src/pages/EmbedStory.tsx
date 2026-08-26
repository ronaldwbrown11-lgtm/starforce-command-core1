import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "react-router";
import { usePageMeta } from "@/hooks/use-page-meta";

// Embeddable story card (#33) — a self-contained, dark-themed card that
// external sites can iframe via <EmbedStory>. No SiteShell, no nav, no auth
// chrome: just the story and a link back to the full page.
export default function EmbedStory() {
  const { slug } = useParams<{ slug: string }>();
  const story = useQuery(api.content.storyBySlug, { slug: slug ?? "" });

  usePageMeta({
    title: "Embedded story — Star Force Base 1198",
    description: "An embedded story card from Star Force Base 1198.",
    noindex: true,
  });

  if (story === undefined) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] text-[#F5F9FF] flex items-center justify-center p-4">
        <p className="text-sm opacity-70">Loading transmission…</p>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] text-[#F5F9FF] flex items-center justify-center p-4">
        <p className="text-sm opacity-70">This transmission is unavailable.</p>
      </div>
    );
  }

  const href = `https://starforcebase1198.com/stories/${story.slug}`;

  return (
    <div
      className="min-h-screen bg-[#0A0A0C] text-[#F5F9FF] flex items-center justify-center p-4"
      style={{ fontFamily: "Rajdhani, Orbitron, system-ui, sans-serif" }}
    >
      <article
        className="max-w-md w-full rounded-xl border border-[#1E2430] bg-[#111214] p-5 flex flex-col gap-3"
        style={{ boxShadow: "0 0 0 1px rgba(0,229,255,0.08), 0 20px 60px rgba(0,0,0,0.5)" }}
      >
        <p
          className="m-0 text-[10px] uppercase tracking-[0.22em] text-[#00E5FF]"
          style={{ fontFamily: "Orbitron, system-ui, sans-serif" }}
        >
          Star Force Base 1198
        </p>
        <h2 className="m-0 text-xl font-semibold leading-snug text-[#F5F9FF]">
          {story.title}
        </h2>
        {story.excerpt ? (
          <p className="m-0 text-sm text-[#B7C3D0] leading-relaxed line-clamp-3">
            {story.excerpt}
          </p>
        ) : null}
        <p className="m-0 text-xs text-[#7A8794]">
          Filed by{" "}
          <span className="text-[#00E5FF] font-semibold">
            {story.author?.displayName ?? "an unnamed recruit"}
          </span>
          {story.author?.rank ? ` · ${story.author.rank}` : ""}
        </p>
        <a
          href={href}
          className="inline-block mt-1 rounded-md px-4 py-2 text-center text-sm font-semibold text-[#0A0A0C] bg-[#00E5FF] hover:bg-[#33ECFF] transition-colors"
        >
          Read the full transmission
        </a>
      </article>
    </div>
  );
}
