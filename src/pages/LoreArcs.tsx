import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, Feather, Loader2, PenLine, ScrollText } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Lore Arcs — operator-curated collaborative storylines. Operators open an
// arc; members submit chapters; the Bridge approves what becomes canon. Only
// approved chapters ever render publicly.
// ---------------------------------------------------------------------------

export default function LoreArcs() {
  const { slug } = useParams();
  usePageMeta({
    title: slug ? "Lore Arc — Star Force Base 1198" : "Lore Arcs — Star Force Base 1198",
    description:
      "Collaborative storylines written by the fleet. Contribute a chapter to an open arc and earn your place in canon.",
  });
  return slug ? <ArcDetail slug={slug} /> : <ArcList />;
}

function ArcList() {
  const arcs = useQuery(api.engagement.listArcs, {});
  const { isAuthenticated } = useAuth();

  return (
    <SiteShell>
      <PageHero
        eyebrow="The Living Canon"
        title="Lore Arcs."
        lead="Storylines the whole fleet writes together. Pick an open arc, read what's canon, and add your chapter — the Bridge reviews every submission before it joins the record."
        primary={
          isAuthenticated
            ? { label: "Read the latest arc", href: "#arcs", variant: "primary" }
            : { label: "Sign in to contribute", href: "/auth?returnTo=/arcs", variant: "primary" }
        }
        secondary={{ label: "How arcs work", href: "#how", variant: "ghost" }}
      />

      <section id="arcs" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-10 pb-6">
        <header className="mb-6">
          <span className="uf-eyebrow">Active arcs</span>
          <h2 className="text-3xl font-semibold mt-2 tracking-tight">
            The storylines currently in flight.
          </h2>
        </header>
        {arcs === undefined ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 160 }} aria-hidden />
            ))}
          </div>
        ) : arcs.length === 0 ? (
          <HoloCard>
            <div className="flex items-start gap-4">
              <ScrollText className="h-8 w-8 text-uf-cyan shrink-0" aria-hidden />
              <div>
                <h3 className="text-lg font-semibold">No arcs open yet.</h3>
                <p className="text-uf-muted text-sm mt-1">
                  Command is drafting the first storyline. Watch this page — when an arc
                  opens, its chapters are written by members like you.
                </p>
              </div>
            </div>
          </HoloCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {arcs.map((arc) => (
              <HoloCard key={arc._id} as="article" className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold tracking-tight">{arc.title}</h3>
                  <StatusPill variant={arc.status === "active" ? "cyan" : "violet"}>
                    {arc.status === "active" ? "In progress" : "Open"}
                  </StatusPill>
                </div>
                <p className="text-uf-muted text-sm mt-2 flex-1">{arc.summary}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-uf-muted text-xs uppercase tracking-[0.16em]">
                    {arc.chapterCount} canon chapter{arc.chapterCount === 1 ? "" : "s"}
                  </span>
                  <Link to={`/arcs/${arc.slug}`}>
                    <NeonButton variant="ghost">
                      <BookOpen className="h-4 w-4" aria-hidden /> Read & contribute
                    </NeonButton>
                  </Link>
                </div>
              </HoloCard>
            ))}
          </div>
        )}
      </section>

      <section id="how" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-16 scroll-mt-24">
        <header className="mb-6">
          <span className="uf-eyebrow">Protocol</span>
          <h2 className="text-2xl font-semibold mt-2 tracking-tight">How an arc works.</h2>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Command opens the arc",
              b: "Operators publish a storyline premise — a setting, a conflict, a question the galaxy hasn't answered yet.",
            },
            {
              n: "02",
              t: "The fleet writes",
              b: "Any member submits a chapter continuing the story. Write canon characters faithfully; your chapter is reviewed before it joins the record.",
            },
            {
              n: "03",
              t: "The Bridge approves",
              b: "Approved chapters render publicly in order and pay 100 XP + 50 Star Credits. Approved work becomes part of the galaxy forever.",
            },
          ].map((s) => (
            <HoloCard key={s.n}>
              <span className="uf-eyebrow">Step {s.n}</span>
              <h3 className="text-lg font-semibold mt-1">{s.t}</h3>
              <p className="text-uf-muted text-sm mt-2">{s.b}</p>
            </HoloCard>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

function ArcDetail({ slug }: { slug: string }) {
  const data = useQuery(api.engagement.getArcBySlug, { slug });
  const mine = useQuery(api.engagement.myArcContributions, {});
  const { isLoading, isAuthenticated, user } = useAuth();

  if (data === undefined) {
    return (
      <SiteShell>
        <div className="uf-section max-w-[900px] mx-auto px-4 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-uf-cyan" aria-hidden />
        </div>
      </SiteShell>
    );
  }
  if (!data) {
    return (
      <SiteShell>
        <div className="uf-section max-w-[900px] mx-auto px-4 text-center">
          <ScrollText className="h-10 w-10 mx-auto text-uf-muted" aria-hidden />
          <h1 className="text-2xl font-semibold mt-4">Arc not found.</h1>
          <p className="text-uf-muted mt-2">This storyline may have been closed and archived.</p>
          <Link to="/arcs" className="inline-block mt-6">
            <NeonButton variant="ghost">Back to all arcs</NeonButton>
          </Link>
        </div>
      </SiteShell>
    );
  }

  const { arc, chapters } = data;
  const myPending = (mine ?? []).filter((c) => c.arcId === arc._id);

  return (
    <SiteShell>
      <PageHero
        eyebrow={`Lore Arc · ${arc.status === "active" ? "In progress" : "Open for contributions"}`}
        title={arc.title}
        lead={arc.summary}
        primary={{ label: `${chapters.length} canon chapters`, href: "#chapters", variant: "ghost" }}
        secondary={
          isAuthenticated
            ? { label: "Contribute a chapter", href: "#contribute", variant: "primary" }
            : { label: "Sign in to contribute", href: `/auth?returnTo=/arcs/${slug}`, variant: "primary" }
        }
      />

      <section id="chapters" className="uf-section max-w-[900px] mx-auto px-4 sm:px-6 scroll-mt-24">
        <header className="mb-6">
          <span className="uf-eyebrow">The canon record</span>
          <h2 className="text-2xl font-semibold mt-2 tracking-tight">Chapters.</h2>
        </header>
        {chapters.length === 0 ? (
          <HoloCard>
            <p className="text-uf-muted">
              No chapters approved yet — this arc's first page is unwritten. Be the first to
              contribute below.
            </p>
          </HoloCard>
        ) : (
          <ol className="flex flex-col gap-4 list-none p-0 m-0">
            {chapters.map((ch) => (
              <li key={ch._id}>
                <HoloCard as="article">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold">
                      <span className="text-uf-cyan mr-2">Ch. {ch.chapterNumber}</span>
                      {ch.title}
                    </h3>
                    <time
                      dateTime={new Date(ch.createdAt).toISOString()}
                      className="text-uf-muted text-xs"
                    >
                      {new Date(ch.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  <p className="uf-eyebrow mt-1">by {ch.author}</p>
                  <div className="text-sm mt-3 leading-relaxed whitespace-pre-wrap">
                    {ch.body}
                  </div>
                </HoloCard>
              </li>
            ))}
          </ol>
        )}
      </section>

      {myPending.length > 0 && (
        <section className="uf-section max-w-[900px] mx-auto px-4 sm:px-6">
          <HoloCard>
            <span className="uf-eyebrow">Your submissions</span>
            <ul className="mt-2 space-y-2 list-none p-0 m-0">
              {myPending.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-3 text-sm">
                  <span>“{c.title}”</span>
                  <StatusPill
                    variant={
                      c.status === "approved" ? "cyan" : c.status === "rejected" ? "danger" : "info"
                    }
                  >
                    {c.status === "approved"
                      ? "Canon"
                      : c.status === "rejected"
                        ? "Returned"
                        : "Under review"}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </HoloCard>
        </section>
      )}

      {arc.status !== "closed" && (
        <section id="contribute" className="uf-section max-w-[900px] mx-auto px-4 sm:px-6 scroll-mt-24">
          {isLoading ? null : isAuthenticated ? (
            <ContributeForm arcId={arc._id} arcTitle={arc.title} memberName={user?.displayName ?? user?.name ?? ""} />
          ) : (
            <HoloCard>
              <div className="flex items-start gap-4">
                <Feather className="h-6 w-6 text-uf-cyan shrink-0" aria-hidden />
                <div>
                  <h3 className="text-lg font-semibold">Add your chapter.</h3>
                  <p className="text-uf-muted text-sm mt-1">
                    Sign in to write for this arc — approved chapters pay 100 XP and 50 Star
                    Credits and become permanent canon.
                  </p>
                  <Link to={`/auth?returnTo=/arcs/${slug}`} className="inline-block mt-4">
                    <NeonButton variant="primary">Sign in to contribute</NeonButton>
                  </Link>
                </div>
              </div>
            </HoloCard>
          )}
        </section>
      )}
    </SiteShell>
  );
}

function ContributeForm({
  arcId,
  arcTitle,
  memberName,
}: {
  arcId: string;
  arcTitle: string;
  memberName: string;
}) {
  const submit = useMutation(api.engagement.submitArcContribution);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyLen = useMemo(() => body.trim().length, [body]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await submit({ arcId: arcId as any, title, body });
      toast.success(`Chapter submitted — the Bridge will review "${title || "your chapter"}".`);
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <HoloCard>
      <span className="uf-eyebrow">Contribute</span>
      <h3 className="text-xl font-semibold mt-1">Write for “{arcTitle}.”</h3>
      <p className="text-uf-muted text-sm mt-2">
        Continuing the record as <strong>{memberName || "a cadet"}</strong>. Approved chapters pay
        100 XP + 50★ and join canon. Keep established characters and events consistent — the
        Bridge checks every entry.
      </p>
      <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
        <label className="text-xs text-uf-muted flex flex-col gap-1">
          Chapter title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
            placeholder="e.g., The Silent Transfer at Vedae Station"
            className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm text-uf-text bg-[rgba(16,24,39,0.5)]"
          />
        </label>
        <label className="text-xs text-uf-muted flex flex-col gap-1">
          Your chapter ({bodyLen}/50 min characters)
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={50}
            rows={10}
            placeholder="The transfer bay lights flickered as the shuttle settled on the pad…"
            className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm text-uf-text bg-[rgba(16,24,39,0.5)] leading-relaxed"
          />
        </label>
        <div>
          <NeonButton variant="primary" type="submit" disabled={busy} loading={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Transmitting…
              </>
            ) : (
              <>
                <PenLine className="h-4 w-4" aria-hidden /> Submit for Bridge review
              </>
            )}
          </NeonButton>
        </div>
      </form>
    </HoloCard>
  );
}
