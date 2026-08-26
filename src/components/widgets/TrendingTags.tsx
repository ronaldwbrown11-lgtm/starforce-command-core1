import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";

export function TrendingTags({ limit = 12 }: { limit?: number }) {
  const tags = useQuery(api.content.trendingTags, { limit });
  if (!tags) {
    return <div className="uf-skeleton" style={{ height: 40 }} aria-hidden />;
  }
  if (!tags.length) {
    return <p className="text-uf-muted text-sm">No trending tags yet.</p>;
  }
  return (
    <ul
      aria-label="Trending tags"
      className="flex flex-wrap gap-2 list-none p-0 m-0"
    >
      {tags.map((tag) => (
        <li key={tag.tag}>
          <Link
            to={`/stories?tag=${encodeURIComponent(tag.tag)}`}
            className="uf-pill hover:shadow-[var(--uf-glow-cyan)]"
          >
            #{tag.tag} <span className="text-uf-muted">({tag.count})</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
