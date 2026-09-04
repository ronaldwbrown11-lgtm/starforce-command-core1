import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Link } from "react-router";
import {
  CheckCircle2,
  Crosshair,
  Lock,
  Medal,
  Rocket,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { TIER_ORDER, tierLabel, type TierId } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { ShipMissions } from "@/components/ships/ShipMissions";

const FILTERS = [
  { id: "", label: "All" },
  { id: "active", label: "Active" },
  { id: "locked", label: "Locked" },
  { id: "completed", label: "Completed" },
] as const;

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "default"> = {
  active: "success",
  locked: "warning",
  completed: "default",
};

const STATUS_ICON: Record<string, typeof Swords> = {
  active: Swords,
  locked: Lock,
  completed: CheckCircle2,
};

function tierIndex(id: TierId | null | undefined): number {
  if (!id) return 0;
  return TIER_ORDER.indexOf(id);
}

export default function Missions() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("");
  const missions = useQuery(api.content.listMissions, { limit: 50 });

  usePageMeta({
    title: "Missions — Star Force Base 1198",
    description:
      "Active operations, locked briefings, and completed campaigns. Every mission earns XP toward your next rank.",
  });

  const viewerTierIndex = tierIndex(user?.tier as TierId | null | undefined);

  const decorated = (missions ?? []).map((m) => {
    const needsTier = !!m.tierRequired && tierIndex(m.tierRequired) > viewerTierIndex;
    const locked = m.missionStatus !== "completed" && needsTier;
    return {
      ...m,
      locked,
      statusForDisplay: m.missionStatus === "active" && locked ? "locked" : (m.missionStatus ?? "active"),
    };
  });

  const filtered = !filter
    ? decorated
    : decorated.filter((m) => m.statusForDisplay === filter);

  const activeCount = decorated.filter((m) => m.statusForDisplay === "active").length;
  const completedCount = decorated.filter((m) => m.statusForDisplay === "completed").length;
  const lockedCount = decorated.filter((m) => m.statusForDisplay === "locked").length;
  const totalXp = decorated
    .filter((m) => m.statusForDisplay !== "completed")
    .reduce((sum, m) => sum + (m.xpReward ?? 0), 0);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Missions"
        title="Take the operation."
        lead="The fleet runs on small, focused operations — each one earns XP, advances your rank, and keeps the story alive. Open briefings are listed first; higher clearances unlock the rest."
        primary={{ label: "See membership", href: "/membership", variant: "primary" }}
        secondary={{ label: "Review your rank", href: "/activity", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        {user?.shipClass ? (
          <HoloCard accent="cyan" className="mb-8">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="uf-eyebrow">Mission intelligence · your hull</span>
                <h2 className="text-xl font-semibold mt-1.5">Ship-class briefings</h2>
                <p className="text-uf-muted text-sm mt-1">
                  Operations themed to your {user.shipClass}. Logged runs bank XP
                  and Star Credits on your ship record.
                </p>
              </div>
              <Link
                to="/account"
                className="text-xs text-uf-cyan hover:underline underline-offset-4"
              >
                Manage ship
              </Link>
            </header>
            <div className="mt-4">
              <ShipMissions
                shipClass={user.shipClass}
                completed={user.shipCompletedMissions ?? []}
              />
            </div>
          </HoloCard>
        ) : null}
        {/* Ops stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8" aria-label="Mission overview">
          <HoloCard className="!p-4">
            <div
              className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--uf-text-muted)" }}
            >
              <Crosshair className="h-4 w-4" aria-hidden /> Active ops
            </div>
            <p className="text-3xl font-semibold mt-2" style={{ color: "var(--uf-cyan)" }}>
              {missions === undefined ? "—" : activeCount}
            </p>
          </HoloCard>
          <HoloCard className="!p-4">
            <div
              className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--uf-text-muted)" }}
            >
              <Lock className="h-4 w-4" aria-hidden /> Locked
            </div>
            <p className="text-3xl font-semibold mt-2" style={{ color: "var(--uf-amber)" }}>
              {missions === undefined ? "—" : lockedCount}
            </p>
          </HoloCard>
          <HoloCard className="!p-4">
            <div
              className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--uf-text-muted)" }}
            >
              <Trophy className="h-4 w-4" aria-hidden /> Completed
            </div>
            <p className="text-3xl font-semibold mt-2" style={{ color: "var(--uf-green)" }}>
              {missions === undefined ? "—" : completedCount}
            </p>
          </HoloCard>
          <HoloCard className="!p-4">
            <div
              className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--uf-text-muted)" }}
            >
              <Medal className="h-4 w-4" aria-hidden /> XP on offer
            </div>
            <p className="text-3xl font-semibold mt-2" style={{ color: "var(--uf-gold)" }}>
              {missions === undefined ? "—" : totalXp.toLocaleString()}
            </p>
          </HoloCard>
        </div>

        {/* Status filter tabs */}
        <div
          role="tablist"
          aria-label="Filter missions by status"
          className="flex flex-wrap gap-2 mb-6"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={cn("uf-btn", active ? "uf-btn--primary" : "")}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {missions === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 220 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="uf-empty">
            No {filter ? `${filter} ` : ""}missions on the board right now. Check back after the next
            fleet briefing — or rally the Bridge Council to charter one.
          </div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {filtered.map((m) => {
              const StatusIcon = STATUS_ICON[m.statusForDisplay] ?? Swords;
              const needsTier = !!m.tierRequired && tierIndex(m.tierRequired) > viewerTierIndex;
              return (
                <HoloCard key={m._id} className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <StatusPill variant={STATUS_VARIANT[m.statusForDisplay] ?? "default"}>
                      <StatusIcon className="h-3 w-3 mr-1 inline-block align-[-1px]" aria-hidden />
                      {m.statusForDisplay}
                    </StatusPill>
                    {m.xpReward ? (
                      <StatusPill variant="gold">+{m.xpReward.toLocaleString()} XP</StatusPill>
                    ) : null}
                    {m.tierRequired ? (
                      <StatusPill variant="violet">Tier: {tierLabel(m.tierRequired)}</StatusPill>
                    ) : null}
                  </div>
                  <Link
                    to={`/missions/${m.slug}`}
                    className="text-lg font-semibold hover:underline"
                    style={{ textDecorationColor: "var(--uf-cyan)" }}
                  >
                    {m.title}
                  </Link>
                  <p className="text-sm mt-2 flex-1" style={{ color: "var(--uf-text-muted)" }}>
                    {m.description}
                  </p>
                  <div className="mt-4">
                    {m.statusForDisplay === "completed" ? (
                      <span className="uf-btn uf-btn--ghost w-full justify-center opacity-70 cursor-default">
                        <CheckCircle2 className="h-4 w-4 mr-1" aria-hidden />
                        Complete
                      </span>
                    ) : m.statusForDisplay === "locked" ? (
                      <Link to="/membership" className="uf-btn uf-btn--ghost w-full justify-center">
                        <Lock className="h-4 w-4 mr-1" aria-hidden />
                        Unlock at {tierLabel(m.tierRequired ?? "cadet")}
                      </Link>
                    ) : (
                      <Link to={`/missions/${m.slug}`} className="uf-btn uf-btn--primary w-full justify-center">
                        <Rocket className="h-4 w-4 mr-1" aria-hidden />
                        Open briefing
                      </Link>
                    )}
                  </div>
                </HoloCard>
              );
            })}
          </div>
        )}

        {!user && missions !== undefined && lockedCount > 0 ? (
          <HoloCard className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--uf-amber)" }} aria-hidden />
                <div>
                  <p className="font-semibold">Clearance required</p>
                  <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--uf-text-muted)" }}>
                    {lockedCount} briefing{lockedCount === 1 ? " is" : "s are"} classified above the
                    public tier. Sign in or upgrade your clearance to open the full ops board.
                  </p>
                </div>
              </div>
              <Link to="/auth" className="uf-btn uf-btn--primary">
                Sign in to review clearance
              </Link>
            </div>
          </HoloCard>
        ) : null}
      </section>
    </SiteShell>
  );
}
