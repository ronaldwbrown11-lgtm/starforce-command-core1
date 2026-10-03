import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { CanonBadge } from "@/components/visuals/CanonBadge";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Gavel, ShieldCheck } from "lucide-react";

// =========================================================================
// Canon Review (/canon-review) — the REQUIRED visual canon approval
// workflow. Operator-only decisions over the pending queue:
//
//   pending → approved | rejected | needs_revision
//
// Approved artwork carries the gold CanonBadge across the Canon Image
// Library, Species/Technology viewers, Missions Deck, Storyboards, and
// Artist Profiles.
// =========================================================================

const OPERATOR_ROLES = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

type QueueRow = {
  _id: string;
  title: string;
  description?: string;
  kind: string;
  medium?: string;
  attribution?: string;
  status: string;
  reviewNote?: string;
  species?: string;
  technology?: string;
  faction?: string;
  mission?: string;
  url: string | null;
  authorId: Id<"users">;
  createdAt: number;
};

export default function CanonReview() {
  usePageMeta({
    title: "Canon Review — Star Force Base 1198",
    description: "Operator queue for approving visual canon submissions.",
  });

  const { isAuthenticated, user } = useAuth();
  const isOperator =
    !!user &&
    (user.role === "admin" ||
      (!!user.opRole && OPERATOR_ROLES.includes(user.opRole)));
  const queue = useQuery(
    api.visuals.reviewQueue,
    isOperator ? {} : "skip",
  );
  const review = useMutation(api.visuals.reviewAsset);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, decision: "approved" | "rejected" | "needs_revision") {
    const note = (
      document.getElementById(`review-note-${id}`) as HTMLInputElement | null
    )?.value;
    setBusyId(id);
    try {
      await review({
        id: id as Id<"visualAssets">,
        decision,
        note: note?.trim() || undefined,
      });
      toast.success(
        decision === "approved"
          ? "Approved — canon badge applied."
          : decision === "rejected"
            ? "Rejected."
            : "Sent back for revision.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAuthenticated) {
    return (
      <SiteShell>
        <PageHero eyebrow="Canon review" title="Sign in required" />
        <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
          <HoloCard className="sf-glass">
            <p className="text-uf-muted text-sm">
              Sign in to reach the canon review deck.{" "}
              <Link to="/auth?returnTo=/canon-review" className="text-uf-cyan">
                Open auth
              </Link>
              .
            </p>
          </HoloCard>
        </section>
      </SiteShell>
    );
  }

  if (!isOperator) {
    return (
      <SiteShell>
        <PageHero eyebrow="Canon review" title="Operators only" />
        <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
          <HoloCard className="sf-glass">
            <p className="text-uf-muted text-sm">
              The canon approval workflow is limited to fleet operators. Your
              submissions stay in the queue — track their badges in the{" "}
              <Link to="/canon-images" className="text-uf-cyan">
                Canon Image Library
              </Link>
              .
            </p>
          </HoloCard>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow="Canon review"
        title="Visual Canon Approval"
        lead="Pending and in-revision submissions from fleet artists — approve with the gold canon badge, send back with notes, or reject."
        primary={{ label: "Canon Image Library", href: "/canon-images", variant: "primary" }}
        secondary={{ label: "Back to the Forge", href: "/creator", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-5">
          <span className="uf-eyebrow uf-eyebrow--gold sf-pulse-soft">
            Review queue
          </span>
          <h2 className="sf-head text-2xl font-semibold mt-1">
            {queue === undefined
              ? "Loading queue…"
              : `${queue.length} submission${queue.length === 1 ? "" : "s"} awaiting decision`}
          </h2>
          <span
            aria-hidden
            className="mt-3 block h-[3px] w-36 rounded-full"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(243,200,73,0.95) 0%, rgba(230,168,23,0.35) 60%, rgba(230,168,23,0) 100%)",
              backgroundSize: "100% 100%",
            }}
          />
        </header>

        {queue === undefined ? (
          <div className="uf-skeleton" style={{ height: 220 }} />
        ) : queue.length === 0 ? (
          <div className="uf-empty">
            Queue clear — every submission has been decided.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {(queue as QueueRow[]).map((item, i) => (
              <HoloCard
                key={item._id}
                className={`sf-glass ${i === 0 ? "sf-holo-glow" : ""}`}
              >
                <div className="grid md:grid-cols-[240px_1fr] gap-4">
                  <div>
                    {item.url ? (
                      <img
                        src={item.url}
                        alt={item.title}
                        className="w-full h-44 object-cover rounded-md border border-[rgba(230,168,23,0.45)]"
                      />
                    ) : (
                      <div className="w-full h-44 rounded-md border border-[color:var(--uf-border)] bg-[rgba(2,11,26,0.5)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold sf-head">
                        {item.title}
                      </h3>
                      <CanonBadge status={item.status} />
                      {i === 0 ? (
                        <StatusPill variant="info">active review</StatusPill>
                      ) : null}
                    </div>
                    <p className="text-uf-muted text-xs mt-1 flex flex-wrap gap-x-3">
                      <span className="uppercase tracking-[0.12em]">
                        {item.kind}
                      </span>
                      {item.medium ? <span>{item.medium}</span> : null}
                      {item.attribution ? <span>by {item.attribution}</span> : null}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    {item.description ? (
                      <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-3">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="text-uf-muted text-xs mt-2 flex flex-wrap gap-2">
                      {item.species ? <StatusPill>species: {item.species}</StatusPill> : null}
                      {item.technology ? <StatusPill>tech: {item.technology}</StatusPill> : null}
                      {item.faction ? <StatusPill>faction: {item.faction}</StatusPill> : null}
                      {item.mission ? <StatusPill>mission: {item.mission}</StatusPill> : null}
                    </p>

                    <label className="block text-xs uppercase tracking-[0.16em] sf-label mt-3">
                      Reviewer note (optional)
                      <input
                        id={`review-note-${item._id}`}
                        defaultValue={item.reviewNote ?? ""}
                        maxLength={500}
                        placeholder="What should the artist change?"
                        className="sf-input w-full rounded-md px-3 py-2 text-sm mt-1"
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <NeonButton
                        variant="gold"
                        loading={busyId === item._id}
                        disabled={busyId !== null}
                        onClick={() => void decide(item._id, "approved")}
                      >
                        <ShieldCheck className="h-4 w-4" aria-hidden /> Approve
                        canon
                      </NeonButton>
                      <NeonButton
                        variant="ghost"
                        disabled={busyId !== null}
                        onClick={() => void decide(item._id, "needs_revision")}
                      >
                        Needs revision
                      </NeonButton>
                      <NeonButton
                        variant="danger"
                        disabled={busyId !== null}
                        onClick={() => {
                          if (window.confirm(`Reject "${item.title}"?`))
                            void decide(item._id, "rejected");
                        }}
                      >
                        <Gavel className="h-4 w-4" aria-hidden /> Reject
                      </NeonButton>
                    </div>
                  </div>
                </div>
              </HoloCard>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
