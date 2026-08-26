import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import { SiteShell, HoloCard, NeonButton } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Rocket } from "lucide-react";

// Canonical rank ladder (mirrors the server validator in convex/users.ts and
// the thresholds used by social:rankProgress).
const RANKS: Array<{ id: string; blurb: string }> = [
  { id: "Recruit", blurb: "First step off the gangway" },
  { id: "Aspirant", blurb: "500 XP — proven to the Bridge" },
  { id: "Pilot", blurb: "1,500 XP — at home in the black" },
  { id: "Commander", blurb: "4,000 XP — runs a deck" },
  { id: "Captain", blurb: "9,000 XP — commands a ship" },
  { id: "Admiral", blurb: "20,000 XP — commands the fleet" },
];

// Canonical factions, matched to what lore/stories use as their fleet tags.
const FLEETS = [
  "Terran Reach",
  "Outer Belt",
  "Sol system-Gemini",
  "Darkspire Expanse",
  "Coreward",
] as const;

export default function PilotOnboarding() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const complete = useMutation(api.users.completeOnboarding);
  const missions = useQuery(api.content.listMissions, {});
  const [displayName, setDisplayName] = useState("");
  const [rank, setRank] = useState<string | null>(null);
  const [fleet, setFleet] = useState<string | null>(null);
  const [missionSlug, setMissionSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Free-cleared operations only — hide tier-gated briefings from a new pilot.
  const starterMissions = useMemo(
    () =>
      (missions ?? [])
        .filter((m) => m.missionStatus === "active" && !m.tierRequired)
        .slice(0, 4),
    [missions],
  );

  if (!isAuthenticated) {
    return (
      <SiteShell>
        <section className="uf-section max-w-[860px] mx-auto px-4 sm:px-6 lg:px-12">
          <HoloCard>
            <p className="text-uf-muted text-sm">
              Sign in to set up your pilot identity.{" "}
              <Link to="/auth" className="text-uf-cyan">
                Open auth
              </Link>
              .
            </p>
          </HoloCard>
        </section>
      </SiteShell>
    );
  }

  const submit = async (skip: boolean) => {
    if (saving) return;
    if (!skip && !rank) {
      toast.info("Pick a starting rank — or skip and set it later.");
      return;
    }
    setSaving(true);
    try {
      const res = await complete({
        displayName: skip || !displayName.trim() ? undefined : displayName.trim(),
        rank: skip ? undefined : (rank ?? undefined),
        fleet: skip ? undefined : (fleet ?? undefined),
        starterMissionSlug: skip ? undefined : (missionSlug ?? undefined),
        skip,
      });
      toast.success(
        skip ? "Welcome to the fleet — identity can wait." : "Welcome aboard, pilot.",
      );
      const target =
        !skip && res.starterMissionSlug
          ? `/missions/${res.starterMissionSlug}`
          : "/missions";
      navigate(target);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't finish orientation.");
      setSaving(false);
    }
  };

  return (
    <SiteShell>
      <section className="uf-section max-w-[980px] mx-auto px-4 sm:px-6 lg:px-12">
        <HoloCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="uf-eyebrow">Pilot orientation</span>
              <h2 className="text-2xl md:text-3xl mt-2">Report for duty.</h2>
              <p className="text-uf-muted text-sm mt-2 max-w-[52ch]">
                Three quick choices and you're in the rotation. You can change
                all of this later from your account page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={saving}
              className="shrink-0 text-xs text-uf-muted underline underline-offset-4 hover:text-uf-text transition-colors disabled:opacity-50"
            >
              Skip for now
            </button>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Callsign */}
            <div className="md:col-span-2">
              <label htmlFor="pilot-callsign" className="uf-eyebrow">
                Callsign <span className="text-uf-muted">(optional)</span>
              </label>
              <input
                id="pilot-callsign"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                placeholder="e.g. Vega Seven"
                className="mt-2 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
            </div>

            {/* Rank */}
            <fieldset className="md:col-span-2">
              <legend className="uf-eyebrow">Rank</legend>
              <p className="text-uf-muted text-xs mt-1 mb-3">
                Your starting rank is ceremony, not a gate — XP moves you up the
                ladder as you run operations.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {RANKS.map((r) => {
                  const active = rank === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRank(r.id)}
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-[rgba(0,229,255,0.7)] bg-[rgba(0,229,255,0.12)] text-uf-text"
                          : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text hover:border-[rgba(0,229,255,0.35)]"
                      }`}
                    >
                      <span className="block text-sm font-medium">{r.id}</span>
                      <span className="block text-[11px] opacity-70">{r.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Fleet */}
            <fieldset className="md:col-span-2">
              <legend className="uf-eyebrow">Fleet affiliation</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {FLEETS.map((f) => {
                  const active = fleet === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFleet(active ? null : f)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        active
                          ? "border-[rgba(167,139,250,0.7)] bg-[rgba(167,139,250,0.14)] text-uf-text"
                          : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text hover:border-[rgba(167,139,250,0.4)]"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Starter mission */}
            <fieldset className="md:col-span-2">
              <legend className="uf-eyebrow">Starter operation</legend>
              <p className="text-uf-muted text-xs mt-1 mb-3">
                Optional — pick a briefing and we drop you straight into it.
              </p>
              {starterMissions.length === 0 ? (
                <p className="text-uf-muted text-sm">
                  No open operations on the board right now — check the{" "}
                  <Link to="/missions" className="text-uf-cyan">
                    mission board
                  </Link>{" "}
                  later.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {starterMissions.map((m) => {
                    const active = missionSlug === m.slug;
                    return (
                      <button
                        key={m._id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setMissionSlug(active ? null : m.slug)}
                        className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                          active
                            ? "border-[rgba(80,255,160,0.7)] bg-[rgba(80,255,160,0.1)] text-uf-text"
                            : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text hover:border-[rgba(80,255,160,0.35)]"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{m.title}</span>
                          <span className="text-[11px] text-uf-cyan shrink-0">
                            +{m.xpReward} XP
                          </span>
                        </span>
                        <span className="block text-[11px] opacity-70 mt-1 line-clamp-2">
                          {m.description ?? m.durationLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <p className="text-uf-muted text-xs max-w-[46ch]">
              Don't worry about the perfect pick — the Bridge updates your dossier
              every time you change it.
            </p>
            <NeonButton
              variant="primary"
              loading={saving}
              onClick={() => void submit(false)}
            >
              <Rocket className="h-4 w-4 mr-1.5" aria-hidden />
              Report for duty
            </NeonButton>
          </div>
        </HoloCard>
      </section>
    </SiteShell>
  );
}