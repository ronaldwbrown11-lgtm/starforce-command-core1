import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Crown, Medal, Award, Zap, Coins } from "lucide-react";

const PODIUM_TONES = [
  { color: "var(--uf-gold)", glow: "rgba(230,168,23,0.45)", label: "Star Marshal" },
  { color: "var(--uf-violet)", glow: "rgba(139,92,246,0.40)", label: "Runner-up" },
  { color: "var(--uf-cyan)", glow: "rgba(0,229,255,0.40)", label: "Third place" },
];

function MedalBadge({ place }: { place: number }) {
  const tone = PODIUM_TONES[place] ?? PODIUM_TONES[2];
  return (
    <span
      aria-hidden
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2"
      style={{
        color: tone.color,
        borderColor: tone.color,
        boxShadow: `0 0 16px ${tone.glow}`,
        background: "rgba(6,10,18,0.85)",
      }}
    >
      {place === 0 ? (
        <Crown className="h-5 w-5" />
      ) : (
        <Medal className="h-5 w-5" />
      )}
    </span>
  );
}

export default function Leaderboard() {
  const rows = useQuery(api.social.leaderboard, { limit: 50 });

  usePageMeta({
    title: "Fleet Leaderboard — Star Force 1198",
    description:
      "Top Star Force members by XP: ranks, factions, contributions, and badge counts.",
  });

  const top = (rows ?? []).slice(0, 3);
  const rest = (rows ?? []).slice(3);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Fleet Rankings"
        title="The Leaderboard"
        lead="Where the fleet stands. XP for lore, art, discoveries, missions, and comments — climb the ranks to Star Marshal."
      />

      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Podium */}
        {rows === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="uf-empty">
            No rankings yet — the leaderboard fills as members earn XP.
          </div>
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-3 list-none p-0 m-0 mb-10">
              {top.map((u, idx) => {
                const tone = PODIUM_TONES[idx] ?? PODIUM_TONES[2];
                return (
                  <li key={u._id}>
                    <Link to={`/u/${u._id}`} className="block h-full">
                      <HoloCard className="h-full flex flex-col items-center text-center gap-2 !p-6">
                        <MedalBadge place={idx} />
                        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: tone.color }}>
                          {tone.label}
                        </p>
                        <h3 className="text-xl font-semibold">{u.displayName}</h3>
                        <StatusPill variant={idx === 0 ? "gold" : idx === 1 ? "violet" : "cyan"}>
                          {u.rank}
                        </StatusPill>
                        {u.fleet ? (
                          <p className="text-uf-muted text-xs">{u.fleet}</p>
                        ) : null}
                        <p
                          className="text-2xl font-semibold tabular-nums mt-1"
                          style={{ color: tone.color, textShadow: `0 0 16px ${tone.glow}` }}
                        >
                          {(u.xp ?? 0).toLocaleString()}
                          <span className="text-xs text-uf-muted ml-1">XP</span>
                        </p>
                        <p className="text-xs text-uf-muted">
                          {u.contributions} contributions · {u.badges} badges
                        </p>
                      </HoloCard>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Rest of the table */}
            {rest.length > 0 ? (
              <div className="uf-panel p-4 md:p-6">
                <span className="uf-eyebrow mb-4 block">Full standings</span>
                <ul className="flex flex-col list-none p-0 m-0">
                  {rest.map((u, i) => (
                    <li
                      key={u._id}
                      className={`flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 border-b border-[color:var(--uf-border)] last:border-0 ${
                        u.isMe ? "bg-[rgba(0,229,255,0.06)] rounded-md px-2" : ""
                      }`}
                    >
                      <span
                        className="font-mono tabular-nums w-8 shrink-0 text-uf-muted"
                        aria-label={`Position ${i + 4}`}
                      >
                        #{i + 4}
                      </span>
                      <Link
                        to={`/u/${u._id}`}
                        className="min-w-0 flex-1 text-base font-semibold truncate hover:text-[var(--uf-cyan)]"
                      >
                        {u.displayName}
                        {u.isMe ? (
                          <span className="ml-2 text-xs text-[var(--uf-cyan)]">(you)</span>
                        ) : null}
                      </Link>
                      <StatusPill variant="info">{u.rank}</StatusPill>
                      {u.fleet ? (
                        <span className="text-xs text-uf-muted">{u.fleet}</span>
                      ) : null}
                      <span className="text-xs text-uf-muted hidden sm:inline">
                        {u.contributions} contrib.
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-xs"
                        style={{ color: "var(--uf-cyan)" }}
                      >
                        <Zap className="h-3.5 w-3.5" aria-hidden />
                        {(u.xp ?? 0).toLocaleString()}
                      </span>
                      <Award
                        className="h-4 w-4"
                        style={{ color: "var(--uf-gold)" }}
                        aria-label={`${u.badges} badges`}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-uf-muted text-xs mt-6 flex items-center gap-2">
              <Coins className="h-3.5 w-3.5" style={{ color: "var(--uf-gold)" }} aria-hidden />
              Earn XP through approved lore, published stories, certified
              discoveries, mission reports, and comments. Badge racks and
              contributions update in real time.
            </p>
          </>
        )}
      </section>
    </SiteShell>
  );
}
