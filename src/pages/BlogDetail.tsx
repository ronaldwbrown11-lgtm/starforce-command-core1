import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, Link } from "react-router";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ArrowLeft, Clock, User, Tag } from "lucide-react";

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const post = useQuery(api.blog.getBySlug, { slug: slug ?? "" });
  const recordView = useMutation(api.blog.recordView);

  usePageMeta({
    title: post ? `${post.title} — Star Force Base 1198` : "Blog — Star Force Base 1198",
    description: post?.excerpt ?? undefined,
    image: post?.coverUrl ?? undefined,
  });

  useEffect(() => {
    if (post) recordView({ id: post._id }).catch(() => {});
  }, [post?._id]);

  if (post === undefined) {
    return (
      <SiteShell>
        <PageHero eyebrow="Blog" title="Loading dispatch…" />
        <section className="uf-section max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="uf-skeleton" style={{ height: 400 }} />
        </section>
      </SiteShell>
    );
  }

  if (post === null) {
    return (
      <SiteShell>
        <PageHero eyebrow="Blog" title="Dispatch not found" />
        <section className="uf-section max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-12">
          <HoloCard>
            <p className="text-uf-muted text-sm">This blog post doesn't exist or was removed.</p>
            <Link to="/blog" className="block mt-4"><NeonButton variant="ghost"><ArrowLeft className="h-4 w-4" aria-hidden />Back to Blog</NeonButton></Link>
          </HoloCard>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow={[post.category, "Blog"].filter(Boolean).join(" • ")}
        title={post.title}
        lead={post.excerpt}
        secondary={{ label: "Back to Blog", href: "/blog", variant: "ghost" }}
      />
      <article className="uf-section max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="flex flex-wrap items-center gap-3 mb-6 text-sm text-uf-muted">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo(post.publishedAt ?? post.createdAt)}</span>
          {post.authorName ? <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{post.authorName}</span> : null}
          {post.tags?.length ? (
            <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{post.tags.join(", ")}</span>
          ) : null}
          {post.category ? <StatusPill variant="default">{post.category}</StatusPill> : null}
        </header>
        {post.coverUrl ? (
          <figure className="mb-8 rounded-lg overflow-hidden border border-[color:var(--uf-border)]">
            <img src={post.coverUrl} alt="" className="w-full max-h-[500px] object-cover" />
          </figure>
        ) : null}
        <HoloCard className="!p-0 overflow-hidden">
          <div
            className="prose prose-invert max-w-none p-6 sm:p-10"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
          />
        </HoloCard>
        <div className="mt-8">
          <Link to="/blog"><NeonButton variant="ghost"><ArrowLeft className="h-4 w-4" aria-hidden />Back to Blog</NeonButton></Link>
        </div>
      </article>
    </SiteShell>
  );
}

/** Minimal markdown → HTML (bold, italic, headings, links, lists, paragraphs, code). */
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-uf-text mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-uf-text mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-uf-text mt-8 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-uf-text font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="text-[var(--uf-cyan)] bg-[rgba(0,229,255,0.08)] px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[var(--uf-cyan)] hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-uf-muted">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="my-3">${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p class="text-uf-muted leading-relaxed mt-4">')
    .replace(/\n/g, '<br/>');
  return `<p class="text-uf-muted leading-relaxed">${html}</p>`;
}
