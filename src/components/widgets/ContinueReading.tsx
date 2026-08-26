import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// "Continue reading" (#24): shows the signed-in member's most recently
// updated in-progress stories with their progress bars.
export function ContinueReading({ limit = 3 }: { limit?: number }) {
  const { isAuthenticated } = useAuth();
  const items = useQuery(
    api.social.myInProgressStories,
    isAuthenticated ? { limit } : "skip",
  );

  if (!isAuthenticated || !items?.length) return null;

  return (
    <section aria-labelledby="uf-continue-reading-heading" className="uf-panel p-5 mb-8">
      <header className="flex items-center gap-2 mb-4">
        <BookOpen className="h-4 w-4" style={{ color: "var(--uf-cyan)" }} aria-hidden />
        <h2 id="uf-continue-reading-heading" className="uf-eyebrow">
          Continue reading
        </h2>
      </header>
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {items.map((s) => (
          <li key={s.storyId}>
            <Link
              to={`/stories/${s.slug}`}
              className="block rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] px-4 py-3 hover:border-[rgba(0,229,255,0.5)] transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold truncate">{s.title}</p>
                <span className="text-xs text-uf-muted tabular-nums shrink-0">
                  {s.percent}%
                </span>
              </div>
              <div
                className="mt-2 h-1.5 rounded-full bg-[rgba(0,229,255,0.12)] overflow-hidden"
                role="progressbar"
                aria-valuenow={s.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${s.percent}% read`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${s.percent}%`,
                    background: "linear-gradient(90deg, var(--uf-cyan), var(--uf-violet))",
                    boxShadow: "0 0 8px rgba(0,229,255,0.5)",
                  }}
                />
              </div>
              {s.series ? (
                <p className="text-[10px] uppercase tracking-[0.16em] text-uf-muted mt-1.5">
                  {s.series}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
