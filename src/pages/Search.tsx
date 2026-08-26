import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useSearchParams } from "react-router";
import {
  SiteShell,
  NeonButton,
  HoloCard,
  StatusPill,
} from "@/components/uf";
import { Starfield } from "@/components/uf/Starfield";
import {
  BookOpen,
  Database,
  FileText,
  MessagesSquare,
  Radio,
  Search,
  Users,
  UserRound,
  Wrench,
  X,
  ArrowRight,
  Radar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
// Normalized result group returned by api.search.siteSearch.
type SearchGroup = {
  type: string;
  label: string;
  href: string;
  items: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    meta: string[];
    coverUrl: string | null;
    matchedTerms: string[];
  }>;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders text with every occurrence of any matched term wrapped in <mark>,
 * so results show exactly why they matched. Longest terms are tried first so
 * overlapping keywords highlight as one unit.
 */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  if (!sorted.length) return <>{text}</>;
  const pattern = new RegExp(`(${sorted.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded-[3px] px-0.5 font-semibold"
            style={{ backgroundColor: "rgba(0,229,255,0.24)", color: "inherit" }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  stories: BookOpen,
  lore: FileText,
  loreLibrary: Database,
  transmissions: Radio,
  resources: Wrench,
  forumThreads: MessagesSquare,
  groups: Users,
  users: UserRound,
};

const QUICK_BROWSE = [
  { label: "Stories", href: "/stories" },
  { label: "Lore", href: "/lore" },
  { label: "Transmissions", href: "/videos" },
  { label: "Forums", href: "/forums" },
  { label: "Resources", href: "/resources" },
  { label: "Members", href: "/members" },
  { label: "Groups", href: "/groups" },
];

const MIN_QUERY = 2;
const RECENTS_KEY = "uf-search-recents";

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 6).map(String) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const next = [query, ...readRecents().filter((r) => r !== query)].slice(0, 6);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are a flourish, never a requirement */
  }
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get("q") ?? "";

  // Input is the live text field; query is the debounced value driving the
  // search and the URL (so results are shareable and back/forward works).
  const [input, setInput] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery);
  const [recents, setRecents] = useState<string[]>(() => readRecents());

  useEffect(() => {
    setInput(urlQuery);
    setQuery(urlQuery);
  }, [urlQuery]);

  usePageMeta({
    title: "Search — Star Force Base 1198",
    description: "Search across stories, lore, missions, and fleet records.",
    noindex: false,
  });

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = input.trim();
      setQuery(trimmed);
      setParams(trimmed ? { q: trimmed } : {}, { replace: true });
    }, 300);
    return () => window.clearTimeout(t);
  }, [input, setParams]);

  const active = query.trim().length >= MIN_QUERY;
  const results = useQuery(
    api.search.siteSearch,
    active ? { query, limit: 6 } : "skip",
  );
  const loading = active && results === undefined;
  const totalMatches = results?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0;

  const submitSearch = () => {
    const trimmed = input.trim();
    if (trimmed.length < MIN_QUERY) return;
    setQuery(trimmed);
    setParams({ q: trimmed }, { replace: true });
    saveRecent(trimmed);
    setRecents(readRecents());
  };

  return (
    <SiteShell>
      <section
        className="relative overflow-hidden pt-16 pb-10 px-4 sm:px-6 lg:px-12"
        aria-labelledby="uf-search-title"
      >
        <Starfield hue="mixed" density="medium" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="uf-eyebrow">Fleet Search</span>
          <h1
            id="uf-search-title"
            className="mt-3 mb-3 text-4xl md:text-5xl font-semibold leading-[1.1]"
          >
            Search the Command Network
          </h1>
          <p className="text-uf-muted text-base md:text-lg max-w-2xl mx-auto mb-8">
            One sweep across stories, lore, transmissions, resources, forums,
            groups, and the fleet roster.
          </p>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="max-w-2xl mx-auto"
          >
            <label htmlFor="uf-search-input" className="sr-only">
              Search stories, lore, and the fleet
            </label>
            <div className="relative flex items-center">
              <Search
                className="h-5 w-5 absolute left-4 text-uf-muted pointer-events-none"
                aria-hidden
              />
              <input
                id="uf-search-input"
                type="search"
                autoComplete="off"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRecent(input.trim());
                }}
                placeholder="e.g., Outer Belt, Cmdr. Singh, signal…"
                className="w-full rounded-xl border border-[color:var(--uf-border)] bg-[rgba(10,16,34,0.7)] backdrop-blur-sm py-4 pl-12 pr-12 text-base placeholder:text-uf-muted/70 focus:outline-none focus:ring-2 focus:ring-[rgba(0,229,255,0.4)]"
                style={{ boxShadow: "0 0 30px rgba(0,229,255,0.12)" }}
              />
              {input ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setInput("");
                    setQuery("");
                  }}
                  className="absolute right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-uf-muted hover:text-uf-text hover:bg-[rgba(0,229,255,0.08)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-uf-muted tracking-[0.08em] uppercase">
              {input.trim().length > 0 && input.trim().length < MIN_QUERY
                ? `Enter at least ${MIN_QUERY} characters to begin the sweep.`
                : "Results update as you type. Press Enter to lock in a scan."}
            </p>
          </form>
        </div>
      </section>

      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div
          role="status"
          aria-live="polite"
          className="text-uf-muted text-xs uppercase tracking-[0.16em] mb-4"
        >
          {loading
            ? "Scanning the network…"
            : active && results
              ? `${totalMatches} match${totalMatches === 1 ? "" : "es"} across ${results.groups.length} archive${results.groups.length === 1 ? "" : "s"} for “${results.query}”.`
              : "Awaiting input."}
        </div>

        {!active ? <QuickBrowse recents={recents} /> : null}

        {loading ? (
          <div className="flex flex-col gap-4" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 108 }} />
            ))}
          </div>
        ) : null}

        {active && results && results.groups.length === 0 ? (
          <div className="uf-empty">
            <Radar className="h-8 w-8 mx-auto mb-3" aria-hidden />
            <p className="font-medium text-uf-text">No signals found.</p>
            <p className="mt-1 max-w-md mx-auto">
              Nothing matched “{results.query}” across the fleet archives. Try a
              broader term, a faction name, or a member callsign.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link to="/stories" className="inline-block">
                <NeonButton variant="ghost">Browse stories</NeonButton>
              </Link>
              <Link to="/lore" className="inline-block">
                <NeonButton variant="ghost">Open the vault</NeonButton>
              </Link>
            </div>
          </div>
        ) : null}

        {results && results.groups.length > 0 ? (
          <div className="flex flex-col gap-10">
            {results.groups.map((group) => {
              const Icon = GROUP_ICONS[group.type] ?? FileText;
              return (
                <section key={group.type} aria-label={group.label}>
                  <header className="flex items-end justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.55)]"
                        style={{ color: "var(--uf-cyan)" }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-xl md:text-2xl font-semibold leading-tight">
                          {group.label}
                        </h2>
                        <p className="text-xs text-uf-muted uppercase tracking-[0.16em]">
                          {group.items.length} match
                          {group.items.length === 1 ? "" : "es"}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={group.href}
                      className="shrink-0 text-xs uppercase tracking-[0.16em] text-uf-cyan hover:underline"
                    >
                      Browse all
                    </Link>
                  </header>
                  <ul className="flex flex-col gap-3">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link to={item.href} className="block group">
                          <HoloCard className="p-4 flex items-center gap-4 transition-transform duration-200 group-hover:translate-x-1">
                            {item.coverUrl ? (
                              <span className="hidden sm:block h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-[color:var(--uf-border)]">
                                <img
                                  src={item.coverUrl}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-semibold text-base group-hover:text-uf-cyan transition-colors">
                                  <Highlight text={item.title} terms={item.matchedTerms} />
                                </span>
                                {item.meta.map((m) => (
                                  <StatusPill key={m} variant="default">
                                    {m}
                                  </StatusPill>
                                ))}
                              </span>
                              <span className="block text-uf-muted text-sm mt-1 line-clamp-2">
                                <Highlight text={item.description} terms={item.matchedTerms} />
                              </span>
                            </span>
                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-uf-muted group-hover:text-uf-cyan group-hover:translate-x-0.5 transition-all"
                              aria-hidden
                            />
                          </HoloCard>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}

function QuickBrowse({ recents }: { recents: string[] }) {
  const [, setParams] = useSearchParams();
  return (
    <div className="flex flex-col gap-8">
      {recents.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-uf-muted mb-3">
            Recent scans
          </p>
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setParams({ q: r }, { replace: true });
                }}
                className="uf-btn"
              >
                <Search className="h-4 w-4" aria-hidden />
                {r}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-uf-muted mb-3">
          Or browse the archives
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_BROWSE.map((q) => (
            <Link key={q.href} to={q.href} className="inline-block">
              <NeonButton variant="ghost">{q.label}</NeonButton>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
