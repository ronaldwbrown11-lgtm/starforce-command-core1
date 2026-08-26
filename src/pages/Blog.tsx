import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { ScrollReveal, ScaleReveal } from "@/hooks/use-scroll-reveal";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Clock, Tag, ArrowRight, BookOpen } from "lucide-react";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "announcement", label: "Announcements" },
  { id: "lore", label: "Lore Drops" },
  { id: "guide", label: "Guides" },
  { id: "update", label: "Updates" },
];

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function Blog() {
  const [cat, setCat] = useState("");
  const posts = useQuery(api.blog.listPublished, { category: cat || undefined, limit: 50 });
  const featured = useQuery(api.blog.featured, { limit: 1 });

  usePageMeta({
    title: "Blog — Star Force Base 1198",
    description: "News, lore drops, guides, and updates from the Star Force command center.",
  });

  const heroPost = useMemo(() => featured?.[0] ?? posts?.[0], [featured, posts]);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Blog"
        title="Dispatches from the command center."
        lead="News, lore drops, guides, and fleet updates — straight from the bridge."
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <nav className="flex flex-wrap gap-2 mb-8" aria-label="Blog categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                cat === c.id
                  ? "bg-[rgba(0,229,255,0.15)] text-[var(--uf-cyan)] border border-[rgba(0,229,255,0.4)]"
                  : "bg-[rgba(255,255,255,0.04)] text-uf-muted border border-[color:var(--uf-border)] hover:text-uf-text"
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>
        {heroPost && !cat && (
          <ScaleReveal>
            <Link to={`/blog/${heroPost.slug}`} className="block mb-8">
              <HoloCard className="overflow-hidden">
                <div className="flex flex-col md:flex-row gap-6">
                  {heroPost.coverUrl ? (
                    <div className="md:w-1/3">
                      <img src={heroPost.coverUrl} alt="" className="w-full h-48 md:h-full object-cover rounded-md" />
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusPill variant="info">Featured</StatusPill>
                      {heroPost.category ? <StatusPill variant="default">{heroPost.category}</StatusPill> : null}
                    </div>
                    <h2 className="text-2xl font-semibold text-uf-text mb-2">{heroPost.title}</h2>
                    <p className="text-uf-muted text-sm leading-relaxed mb-3">{heroPost.excerpt}</p>
                    <div className="flex items-center gap-4 text-xs text-uf-muted">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(heroPost.publishedAt ?? heroPost.createdAt)}</span>
                      {heroPost.authorName ? <span>by {heroPost.authorName}</span> : null}
                      {heroPost.tags?.length ? (
                        <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{heroPost.tags.slice(0, 3).join(", ")}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </HoloCard>
            </Link>
          </ScaleReveal>
        )}
        {posts === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[1, 2, 3].map((i) => (<div key={i} className="uf-skeleton" style={{ height: 260 }} />))}
          </div>
        ) : posts.length === 0 ? (
          <HoloCard><div className="uf-empty"><BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" /><p>{cat ? "No posts in this category yet." : "No blog posts published yet."}</p></div></HoloCard>
        ) : (
          <div className="uf-grid uf-grid--3">
            {(cat ? posts : posts.filter((p) => p._id !== heroPost?._id)).map((post, idx) => (
              <ScrollReveal key={post._id} staggerIndex={idx}>
                <Link to={`/blog/${post.slug}`} className="block h-full">
                  <HoloCard className="flex flex-col h-full">
                    {post.coverUrl ? <img src={post.coverUrl} alt="" className="w-full h-40 object-cover rounded-md mb-3" /> : null}
                    <div className="flex items-center gap-2 mb-2">
                      {post.category ? <StatusPill variant="default">{post.category}</StatusPill> : null}
                      {post.featured ? <StatusPill variant="info">Featured</StatusPill> : null}
                    </div>
                    <h3 className="text-lg font-semibold text-uf-text mb-1 line-clamp-2">{post.title}</h3>
                    <p className="text-uf-muted text-sm leading-relaxed mb-3 line-clamp-3 flex-1">{post.excerpt}</p>
                    <div className="flex items-center justify-between text-xs text-uf-muted mt-auto pt-2 border-t border-[color:var(--uf-border)]">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(post.publishedAt ?? post.createdAt)}</span>
                      <span className="flex items-center gap-1 text-[var(--uf-cyan)]">Read <ArrowRight className="h-3 w-3" /></span>
                    </div>
                  </HoloCard>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
