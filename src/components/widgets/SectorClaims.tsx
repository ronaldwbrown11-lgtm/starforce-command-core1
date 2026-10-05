import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { HoloCard } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Flag, Users } from "lucide-react";

/**
 * Sector claims — the faction territory layer of the cartography deck.
 *
 * Originally lived on the in-house Star Atlas page. When that 3D chart was
 * retired in favour of the standalone atlas app, the territory mechanic was
 * preserved here so members can still stake a public claim on a charted
 * sector, personally or on behalf of a fleet group. Claims are faction-level:
 * a later claim by a different faction seizes the sector from its holder.
 *
 * Backend note: `discoveries.claimSector` files its activity-feed entry at
 * `/maps`, so this component is the canonical home for the feature.
 */
export function SectorClaims({ returnTo = "/maps" }: { returnTo?: string } = {}) {
  const { isAuthenticated } = useAuth();
  const sectors = useQuery(api.content.sectors);
  const claims = useQuery(api.discoveries.listSectorClaims);
  const claimSector = useMutation(api.discoveries.claimSector);
  const factions = useQuery(api.factions.listAll);
  const myMemberships = useQuery(api.groups.myGroupMemberships);
  const allGroups = useQuery(api.groups.listGroups, {});

  const [claimSectorName, setClaimSectorName] = useState("");
  const [claimFaction, setClaimFaction] = useState<string>("");
  const [claimGroupId, setClaimGroupId] = useState("");
  const [claiming, setClaiming] = useState(false);

  // Groups the signed-in member belongs to, for group-owned claims.
  const memberGroupIds = new Set(
    (myMemberships ?? []).map((m) => m.groupId as string),
  );
  const claimableGroups =
    allGroups === undefined
      ? []
      : allGroups.filter((g) => memberGroupIds.has(g._id as string));

  const submitClaim = async (e: FormEvent) => {
    e.preventDefault();
    if (!claimSectorName || !claimFaction) {
      toast.info("Pick a sector and a faction to stake the claim.");
      return;
    }
    setClaiming(true);
    try {
      const res = await claimSector({
        sector: claimSectorName,
        faction: claimFaction,
        groupId: claimGroupId ? (claimGroupId as Id<"groups">) : undefined,
      });
      const holder = res.groupName ?? claimFaction;
      toast.success(
        res.replaced
          ? `${holder} seized ${claimSectorName} from the previous holder.`
          : `${holder} now holds ${claimSectorName}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
      <header className="mb-4">
        <span className="uf-eyebrow flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5" aria-hidden /> Sector claims
        </span>
        <h2 className="text-xl mt-1">Who holds the frontier?</h2>
        <p className="text-uf-muted text-sm mt-1 max-w-[70ch]">
          Factions stake public claims on charted sectors — personally or on
          behalf of a fleet group you belong to. The latest claimant holds the
          sector until another faction seizes it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <HoloCard>
          <span className="uf-eyebrow flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5" aria-hidden /> Current holders
          </span>
          {claims === undefined ? (
            <div className="uf-skeleton mt-3" style={{ height: 120 }} />
          ) : claims.length === 0 ? (
            <div className="uf-empty mt-3">
              No sector claims yet — plant the first flag.
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2 list-none p-0 m-0">
              {claims.map((c) => (
                <li
                  key={c.sector}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag className="h-4 w-4 text-uf-gold shrink-0" aria-hidden />
                    <span className="text-sm font-semibold truncate">{c.sector}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-uf-cyan">{c.faction}</p>
                    {c.groupName ? (
                      <p className="text-[11px] text-uf-violet inline-flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden /> {c.groupName}
                      </p>
                    ) : (
                      <p className="text-[11px] text-uf-muted">
                        by {c.claimant?.displayName ?? "unknown"}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>

        <HoloCard>
          <span className="uf-eyebrow">Stake a claim</span>
          {isAuthenticated ? (
            <form onSubmit={submitClaim} className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Sector</span>
                <select
                  value={claimSectorName}
                  onChange={(e) => setClaimSectorName(e.target.value)}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                >
                  <option value="">Pick a sector…</option>
                  {(sectors ?? []).map((s) => (
                    <option key={s._id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Faction</span>
                <select
                  value={claimFaction}
                  onChange={(e) => setClaimFaction(e.target.value)}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                >
                  <option value="">Pick your faction…</option>
                  {(factions?.items ?? []).map((f) => (
                    <option key={f.slug} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Claim for</span>
                <select
                  value={claimGroupId}
                  onChange={(e) => setClaimGroupId(e.target.value)}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                >
                  <option value="">Personal claim</option>
                  {claimableGroups.map((g) => (
                    <option key={g._id} value={g._id}>
                      Group: {g.name}
                    </option>
                  ))}
                </select>
                <span className="text-uf-muted text-[11px] mt-1">
                  Claiming for a group stamps the group name on the sector.
                </span>
              </label>
              <button type="submit" disabled={claiming} className="uf-btn uf-btn--primary">
                {claiming ? "Planting flag…" : "Claim this sector"}
              </button>
            </form>
          ) : (
            <p className="text-uf-muted text-sm mt-3">
              Sign in to stake a claim for your faction.{" "}
              <Link to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} className="text-uf-cyan underline">
                Sign in
              </Link>
            </p>
          )}
        </HoloCard>
      </div>
    </section>
  );
}

export default SectorClaims;
