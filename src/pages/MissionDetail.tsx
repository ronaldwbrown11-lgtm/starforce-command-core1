import { useParams, Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Crosshair,
  FileText,
  Flag,
  Loader2,
  Lock,
  MapPin,
  Medal,
  Send,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { ReactionBar } from "@/components/widgets/ReactionBar";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";
import { TIER_ORDER, tierLabel, type TierId } from "@/lib/tiers";

function tierIndex(id: TierId | null | undefined): number {
  if (!id) return 0;
  return TIER_ORDER.indexOf(id);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function MissionDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justFiled, setJustFiled] = useState<{ xpAwarded: number } | null>(null);

  const mission = useQuery(api.missions.missionBySlug, { slug });
  const reports = useQuery(
    api.missions.missionReports,
    mission ? { missionId: mission._id, limit: 12 } : "skip",
  );
  const myReport = useQuery(
    api.missions.myMissionReport,
    mission ? { missionId: mission._id } : "skip",
  );
  const fileReport = useMutation(api.missions.fileMissionReport);

  usePageMeta({
    title: mission ? `${mission.title} — Mission — Star Force Base 1198` : "Mission — Star Force Base 1198",
    description: mission?.description ?? undefined,
  });

  const viewerTierIndex = tierIndex(user?.tier as TierId | null | undefined);
  const needsTier =
    !!mission?.tierRequired &&
    tierIndex(mission.tierRequired as TierId) > viewerTierIndex;
  const isLocked = !!mission && mission.missionStatus !== "completed" && needsTier;
  const isCompleted = mission?.missionStatus === "completed";

  const canFile =
    !!mission && !isLocked && !isCompleted && !myReport && !justFiled;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mission) return;
    const body = content.trim();
    if (body.length < 20) {
      setError("Reports must be at least 20 characters — give Command something to read.");
      return;
    }
    if (body.length > 2000) {
      setError("Reports are limited to 2,000 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fileReport({ missionId: mission._id, content: body });
      setJustFiled({ xpAwarded: res.xpAwarded });
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed to transmit.");
    } finally {
      setBusy(false);
    }
  }

  if (mission === undefined) {
    return (
      <SiteShell>
        <PageHero eyebrow="Mission" title="Decrypting briefing…" />
        <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="uf-skeleton" style={{ height: 320 }} />
        </section>
      </SiteShell>
    );
  }
  if (mission === null) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Out of range"
          title="Briefing not found"
          lead="This operation has either been struck from the record or never existed."
          primary={{ label: "Back to ops board", href: "/missions", variant: "primary" }}
        />
      </SiteShell>
    );
  }

  const statusLabel = isLocked
    ? "locked"
    : isCompleted
      ? "completed"
      : "active";
  const statusVariant =
    statusLabel === "active"
      ? ("success" as const)
      : statusLabel === "locked"
        ? ("warning" as const)
        : ("default" as const);
  const StatusIcon =
    statusLabel === "active"
      ? Swords
      : statusLabel === "locked"
        ? Lock
        : CheckCircle2;

  return (
    <SiteShell>
      <PageHero
        eyebrow={mission.location ?? "Mission briefing"}
        title={mission.title}
        lead={mission.description}
        primary={
          canFile
            ? { label: "File your report", href: "#report", variant: "primary" }
            : { label: "Back to ops board", href: "/missions", variant: "ghost" }
        }
        secondary={{ label: "All missions", href: "/missions", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Ops meta strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8" aria-label="Mission details">
          <HoloCard className="!p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--uf-text-muted)" }}>
              <StatusIcon className="h-4 w-4" aria-hidden /> Status
            </div>
            <p className="text-xl font-semibold mt-2 capitalize" style={{ color: "var(--uf-cyan)" }}>
              {statusLabel}
            </p>
          </HoloCard>
          <HoloCard className="!p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--uf-text-muted)" }}>
              <Medal className="h-4 w-4" aria-hidden /> Reward
            </div>
            <p className="text-xl font-semibold mt-2" style={{ color: "var(--uf-gold)" }}>
              +{mission.xpReward?.toLocaleString() ?? 0} XP
            </p>
          </HoloCard>
          <HoloCard className="!p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--uf-text-muted)" }}>
              <ShieldCheck className="h-4 w-4" aria-hidden /> Clearance
            </div>
            <p className="text-xl font-semibold mt-2" style={{ color: "var(--uf-violet)" }}>
              {mission.tierRequired ? tierLabel(mission.tierRequired) : "Open to all"}
            </p>
          </HoloCard>
          <HoloCard className="!p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--uf-text-muted)" }}>
              <Clock3 className="h-4 w-4" aria-hidden /> Duration
            </div>
            <p className="text-xl font-semibold mt-2" style={{ color: "var(--uf-text)" }}>
              {mission.durationLabel ?? "Varies"}
            </p>
          </HoloCard>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Briefing + objectives */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <HoloCard>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5" style={{ color: "var(--uf-cyan)" }} aria-hidden />
                Situation briefing
              </h2>
              {isLocked ? (
                <div className="mt-4">
                  <div
                    className="rounded-md border border-dashed px-4 py-6 text-center"
                    style={{ borderColor: "var(--uf-border)", color: "var(--uf-text-muted)" }}
                  >
                    <Lock className="h-6 w-6 mx-auto mb-2" aria-hidden />
                    <p className="text-sm">
                      This briefing is classified above your current clearance.
                      Raise your tier to decrypt the full operation.
                    </p>
                  </div>
                  <p className="text-sm mt-4" style={{ color: "var(--uf-text-muted)" }}>
                    {mission.description}
                  </p>
                </div>
              ) : (
                <div className="text-base leading-relaxed whitespace-pre-wrap mt-4">
                  {mission.briefing ?? mission.description}
                </div>
              )}
            </HoloCard>

            {!isLocked && (mission.objectives?.length ?? 0) > 0 ? (
              <HoloCard>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Crosshair className="h-5 w-5" style={{ color: "var(--uf-green)" }} aria-hidden />
                  Objectives
                </h2>
                <ul className="mt-4 flex flex-col gap-3 list-none p-0 m-0">
                  {mission.objectives!.map((o, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                        style={{ borderColor: "var(--uf-border)", color: "var(--uf-cyan)" }}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed">{o}</span>
                    </li>
                  ))}
                </ul>
                {mission.location ? (
                  <p className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--uf-text-muted)" }}>
                    <MapPin className="h-4 w-4" aria-hidden /> {mission.location}
                  </p>
                ) : null}
              </HoloCard>
            ) : null}

            <ReactionBar targetId={mission._id} targetType="report" />
          </div>

          {/* Report-in panel */}
          <div id="report" className="lg:col-span-1 scroll-mt-24">
            <HoloCard>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Send className="h-5 w-5" style={{ color: "var(--uf-cyan)" }} aria-hidden />
                Report in
              </h2>

              {!user ? (
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-sm" style={{ color: "var(--uf-text-muted)" }}>
                    Sign in to file a field report and claim your XP.
                  </p>
                  <Link to="/auth" className="uf-btn uf-btn--primary justify-center">
                    Sign in to transmit
                  </Link>
                </div>
              ) : isLocked ? (
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-sm" style={{ color: "var(--uf-text-muted)" }}>
                    Clearance required. This operation unlocks at{" "}
                    <span style={{ color: "var(--uf-violet)" }}>
                      {tierLabel(mission.tierRequired)}
                    </span>
                    .
                  </p>
                  <Link to="/membership" className="uf-btn uf-btn--primary justify-center">
                    <Lock className="h-4 w-4 mr-1" aria-hidden />
                    Raise your clearance
                  </Link>
                </div>
              ) : isCompleted ? (
                <div className="mt-4">
                  <p className="text-sm" style={{ color: "var(--uf-text-muted)" }}>
                    This operation has closed. The Q4-style readouts live in the
                    archive for reference — no further reports are accepted.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Trophy className="h-4 w-4" style={{ color: "var(--uf-gold)" }} aria-hidden />
                    <span>Complete</span>
                  </div>
                </div>
              ) : justFiled ? (
                <div
                  className="mt-4 rounded-md border px-4 py-4"
                  style={{ borderColor: "var(--uf-green)", background: "rgba(16,185,129,0.08)" }}
                  role="status"
                  aria-live="polite"
                >
                  <p className="font-semibold flex items-center gap-2" style={{ color: "var(--uf-green)" }}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Report received
                  </p>
                  <p className="text-sm mt-2" style={{ color: "var(--uf-text-muted)" }}>
                    Your report is on the Bridge's desk awaiting certification{" "}
                    and{" "}
                    <span style={{ color: "var(--uf-gold)" }}>
                      +{justFiled.xpAwarded.toLocaleString()} XP
                    </span>{" "}
                    has been credited to your service record. Operators may
                    claw the award back if the report is rejected.
                  </p>
                  <Link to="/activity" className="uf-btn uf-btn--ghost mt-3 w-full justify-center">
                    Review your rank
                  </Link>
                </div>
              ) : myReport ? (
                <MyReportStatus report={myReport} />
              ) : (
                <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit} data-uf-form="mission-report">
                  {mission.reportGuidance ? (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--uf-text-muted)" }}>
                      {mission.reportGuidance}
                    </p>
                  ) : null}
                  <label className="text-xs uppercase tracking-[0.16em] flex flex-col gap-1" style={{ color: "var(--uf-text-muted)" }}>
                    Field report
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={7}
                      placeholder="What did you see? Who did you talk to? What does Command need to know?"
                      className="border rounded-md px-3 py-2 text-sm min-h-36"
                      style={{ borderColor: "var(--uf-border)", background: "rgba(16,24,39,0.5)" }}
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--uf-text-muted)" }} aria-live="polite">
                      {content.trim().length} / 2000
                    </span>
                    <button
                      type="submit"
                      disabled={busy}
                      className="uf-btn uf-btn--primary"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Transmitting…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" aria-hidden /> Transmit report
                        </>
                      )}
                    </button>
                  </div>
                  {error ? (
                    <p className="text-sm" style={{ color: "var(--uf-red)" }} role="alert">
                      {error}
                    </p>
                  ) : null}
                  <p className="text-[11px]" style={{ color: "var(--uf-text-muted)" }}>
                    One report per member per operation. Approved reports credit{" "}
                    <span style={{ color: "var(--uf-gold)" }}>+{mission.xpReward?.toLocaleString() ?? 0} XP</span>{" "}
                    immediately.
                  </p>
                </form>
              )}
            </HoloCard>
          </div>
        </div>

        {/* Field reports feed */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" style={{ color: "var(--uf-cyan)" }} aria-hidden />
            Field reports
          </h2>
          {reports === undefined ? (
            <div className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="uf-skeleton" style={{ height: 120 }} />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="uf-empty">
              No field reports filed yet. Be the first to transmit your after-action notes.
            </div>
          ) : (
            <ul role="feed" aria-label="Field reports" className="flex flex-col gap-3 list-none p-0 m-0">
              {reports.map((r) => (
                <li key={r._id}>
                  <HoloCard className="!p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {r.author?.displayName ?? "Unknown operator"}
                      </span>
                      {r.author?.rank ? (
                        <StatusPill variant="info">{r.author.rank}</StatusPill>
                      ) : null}
                      {r.xpAwarded ? (
                        <StatusPill variant="gold">+{r.xpAwarded.toLocaleString()} XP</StatusPill>
                      ) : null}
                      {r.reviewStatus === "approved" ? (
                        <StatusPill variant="success">Certified</StatusPill>
                      ) : (
                        <StatusPill variant="warning">Pending review</StatusPill>
                      )}
                      <time className="ml-auto text-xs" style={{ color: "var(--uf-text-muted)" }} dateTime={new Date(r.createdAt).toISOString()}>
                        {timeAgo(r.createdAt)}
                      </time>
                    </div>
                    <p className="text-sm leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: "var(--uf-text-muted)" }}>
                      {r.content}
                    </p>
                  </HoloCard>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8">
          <Link to="/missions" className="uf-btn uf-btn--ghost">
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden />
            Back to ops board
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}

/**
 * Member-facing status for the viewer's own report — shown in the report-in
 * panel so a rejected/flagged report (hidden from the public feed) still
 * surfaces its verdict and the operator's note to its author.
 */
function MyReportStatus({ report }: { report: any }) {
  const status = report.reviewStatus ?? "pending";
  const xp = report.xpAwarded ? report.xpAwarded.toLocaleString() : null;

  if (status === "approved") {
    return (
      <div className="mt-4">
        <p className="text-sm flex items-center gap-2" style={{ color: "var(--uf-green)" }}>
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Your report was certified by Command.
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--uf-text-muted)" }}>
          {xp ? `+${xp} XP` : "XP"} confirmed on your service record.
        </p>
      </div>
    );
  }

  if (status === "rejected" || status === "flagged") {
    return (
      <div className="mt-4">
        <p className="text-sm flex items-center gap-2" style={{ color: "var(--uf-amber)" }}>
          <Flag className="h-4 w-4" aria-hidden />
          {status === "rejected"
            ? "Your report was not certified."
            : "Your report was flagged for review."}
        </p>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--uf-text-muted)" }}>
          {xp ? `The +${xp} XP award was revoked. ` : ""}
          {report.reviewNote
            ? `Operator note: ${report.reviewNote}`
            : "Contact Support if you believe this was an error."}
        </p>
        <Link to="/support" className="uf-btn uf-btn--ghost mt-3 w-full justify-center">
          Appeal to Support
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-sm flex items-center gap-2" style={{ color: "var(--uf-amber)" }}>
        <Clock3 className="h-4 w-4" aria-hidden />
        Your report is awaiting certification.
      </p>
      <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--uf-text-muted)" }}>
        Operators review reports against the mission objectives. XP is credited
        now but may be clawed back if the report is rejected.
      </p>
    </div>
  );
}
