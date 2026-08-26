import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, useState, type FormEvent } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Link } from "react-router";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { TIER_ORDER, tierLabel } from "@/lib/tiers";
import { ACHIEVEMENT_CATALOG, getAchievement } from "@/lib/achievements";
import { toast } from "sonner";
import { Eye, Medal, Trash2, UserPlus, Loader2 } from "lucide-react";

type UsageRow = {
  userId: string;
  tier: string;
  ai: { used: number; cap: number; percent: number };
  storage: { usedGb: number; capGb: number; percent: number };
};

export default function OperatorUsers() {
  const [search, setSearch] = useState("");
  const users = useQuery(api.operator.listUsersForOperator, { search, limit: 80 });
  const allUsage = useQuery(api.usage.usersUsageForOperator, { limit: 120 });
  const setTier = useMutation(api.operator.setUserTier);
  const setOpRole = useMutation(api.operator.setUserOpRole);
  const setUsage = useMutation(api.usage.setUsage);
  const createUser = useMutation(api.operator.createUser);
  const deleteUser = useMutation(api.operator.deleteUser);
  const awardAchievement = useMutation(api.operator.awardAchievement);
  const removeAchievement = useMutation(api.operator.removeAchievement);
  const [badgeBusy, setBadgeBusy] = useState<string | null>(null);

  // Add-member form state
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    tier: "free",
    rank: "",
    xp: "",
    fleet: "",
  });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const usageById = useMemo(() => {
    const map = new Map<string, UsageRow>();
    (allUsage ?? []).forEach((u) => map.set(u.userId, u));
    return map;
  }, [allUsage]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.displayName.trim()) {
      toast.error("Display name is required.");
      return;
    }
    setCreating(true);
    try {
      const xp = parseInt(form.xp, 10);
      await createUser({
        displayName: form.displayName.trim(),
        email: form.email.trim() || undefined,
        tier: form.tier as
          | "free"
          | "cadet"
          | "officer"
          | "command"
          | "gia_agent",
        rank: form.rank.trim() || undefined,
        xp: Number.isNaN(xp) ? undefined : xp,
        fleet: form.fleet.trim() || undefined,
      });
      toast.success(`Member ${form.displayName.trim()} added to the roster.`);
      setForm({ displayName: "", email: "", tier: "free", rank: "", xp: "", fleet: "" });
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(u: Doc<"users">, force: boolean) {
    setRemoving(`${u._id}_${force}`);
    try {
      await deleteUser({ id: u._id, force });
      toast.success(
        force
          ? `Member removed (content kept).`
          : `Member removed from the roster.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove member.";
      if (!force && msg.toLowerCase().includes("authored")) {
        const forceIt = window.confirm(
          `${msg}\n\nRemove them anyway? Their stories/lore stay but the author link is severed.`,
        );
        if (forceIt) return handleRemove(u, true);
      }
      toast.error(msg);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <span className="uf-eyebrow">Operator Console</span>
          <h1 className="text-3xl font-semibold mt-2">User Management</h1>
        </div>
        <NeonButton variant="primary" onClick={() => setFormOpen((v) => !v)}>
          <UserPlus className="h-4 w-4 mr-1.5" aria-hidden />
          {formOpen ? "Close" : "Add member"}
        </NeonButton>
      </header>

      {formOpen ? (
        <HoloCard className="mb-6">
          <span className="uf-eyebrow">New member</span>
          <form onSubmit={handleCreate} className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Display name *
              <input
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Cmdr. Vega"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Email (optional)
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="pilot@fleet.local"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Tier
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              >
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {tierLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Rank (optional)
              <input
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                placeholder="Recruit"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Starting XP (optional)
              <input
                type="number"
                min={0}
                value={form.xp}
                onChange={(e) => setForm({ ...form, xp: e.target.value })}
                placeholder="0"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Fleet (optional)
              <input
                value={form.fleet}
                onChange={(e) => setForm({ ...form, fleet: e.target.value })}
                placeholder="Terran Reach"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <div className="md:col-span-3 flex gap-2">
              <NeonButton type="submit" variant="primary" disabled={creating}>
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <UserPlus className="h-4 w-4 mr-1" aria-hidden />
                )}
                {creating ? "Adding…" : "Add to roster"}
              </NeonButton>
              <NeonButton type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel
              </NeonButton>
            </div>
          </form>
        </HoloCard>
      ) : null}

      <HoloCard>
        <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1 mb-4">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name / email / fleet"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>
        {users === undefined ? (
          <div className="uf-skeleton" style={{ height: 200 }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="uf-data-grid" style={{ minWidth: 1100 }}>
              <caption className="uf-sr-only">All users (operator view)</caption>
              <thead>
                <tr>
                  <th>Display name</th>
                  <th>Email</th>
                  <th>Tier</th>
                  <th>Usage</th>
                  <th>Rank / XP</th>
                  <th>Fleet</th>
                  <th>Op role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const usage = usageById.get(String(u._id));
                  return (
                    <tr key={u._id}>
                      <td>
                        <Link
                          to={`/operator/users/${u._id}`}
                          className="text-[var(--uf-cyan)] hover:underline"
                          title="Open detail view"
                        >
                          {u.displayName ?? u.name ?? "—"}
                        </Link>
                        {(u.achievements ?? []).length > 0 ? (
                          <span className="block mt-1 flex flex-wrap gap-1">
                            {(u.achievements ?? []).slice(0, 4).map((key) => {
                              const entry = getAchievement(key);
                              if (!entry) return null;
                              const Icon = entry.icon;
                              return (
                                <span
                                  key={key}
                                  title={entry.label}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--uf-cyan)]/30 bg-[rgba(0,229,255,0.06)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--uf-cyan)]"
                                >
                                  <Icon className="h-2.5 w-2.5" aria-hidden />
                                  {entry.label}
                                </span>
                              );
                            })}
                            {(u.achievements ?? []).length > 4 ? (
                              <span className="text-[9px] text-uf-muted self-center">
                                +{(u.achievements ?? []).length - 4} more
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </td>
                      <td>{u.email ?? "—"}</td>
                      <td>
                        <select
                          defaultValue={u.tier ?? "free"}
                          onChange={async (e) => {
                            try {
                              await setTier({
                                id: u._id,
                                tier: e.target.value as
                                  | "free"
                                  | "cadet"
                                  | "officer"
                                  | "command"
                                  | "gia_agent",
                              });
                              toast.success(`Tier updated for ${u.displayName ?? u.email ?? "member"}.`);
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Tier update failed.",
                              );
                            }
                          }}
                          className="bg-[rgba(16,24,39,0.5)] border border-[color:var(--uf-border)] rounded px-2 py-1 text-xs"
                        >
                          {TIER_ORDER.map((t) => (
                            <option key={t} value={t}>
                              {tierLabel(t)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {usage ? (
                          <div className="flex flex-col gap-1 min-w-44">
                            <UsageMini
                              label="AI"
                              used={usage.ai.used}
                              cap={usage.ai.cap}
                              percent={usage.ai.percent}
                            />
                            <UsageMini
                              label="Storage"
                              used={usage.storage.usedGb}
                              cap={usage.storage.capGb}
                              percent={usage.storage.percent}
                              suffix=" GB"
                            />
                          </div>
                        ) : (
                          <span className="uf-skeleton inline-block w-32" />
                        )}
                      </td>
                      <td>{(u.rank ?? "Recruit")} / {u.xp ?? 0}</td>
                      <td>{u.fleet ?? "—"}</td>
                      <td>
                        <select
                          defaultValue={u.opRole ?? ""}
                          onChange={async (e) => {
                            try {
                              const v = e.target.value;
                              await setOpRole({
                                id: u._id,
                                opRole:
                                  v === ""
                                    ? null
                                    : (v as
                                        | "operator"
                                        | "senior_operator"
                                        | "story_editor"
                                        | "lore_archivist"
                                        | "community_moderator"),
                              });
                              toast.success(`Role updated for ${u.displayName ?? u.email ?? "member"}.`);
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Role update failed.",
                              );
                            }
                          }}
                          className="bg-[rgba(16,24,39,0.5)] border border-[color:var(--uf-border)] rounded px-2 py-1 text-xs"
                        >
                          <option value="">none</option>
                          <option value="operator">operator</option>
                          <option value="senior_operator">senior_operator</option>
                          <option value="story_editor">story_editor</option>
                          <option value="lore_archivist">lore_archivist</option>
                          <option value="community_moderator">community_moderator</option>
                        </select>
                      </td>
                      <td>
                        <div className="flex flex-col gap-2 items-start">
                          <details className="text-xs">
                            <summary className="cursor-pointer text-uf-cyan">
                              <Medal className="h-3.5 w-3.5 inline mr-1" aria-hidden />
                              Badges ({(u.achievements ?? []).length})
                            </summary>
                            <div className="mt-2 flex flex-wrap gap-1.5 max-w-64">
                              {Object.entries(ACHIEVEMENT_CATALOG).map(
                                ([key, entry]) => {
                                  const has = (u.achievements ?? []).includes(
                                    key,
                                  );
                                  const Icon = entry.icon;
                                  const busy = badgeBusy === `${u._id}:${key}`;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      disabled={busy}
                                      title={`${has ? "Revoke" : "Award"}: ${entry.label} — ${entry.description}`}
                                      onClick={async () => {
                                        setBadgeBusy(`${u._id}:${key}`);
                                        try {
                                          if (has) {
                                            await removeAchievement({
                                              id: u._id,
                                              key,
                                            });
                                            toast.success(`Revoked ${entry.label}.`);
                                          } else {
                                            await awardAchievement({
                                              id: u._id,
                                              key,
                                            });
                                            toast.success(`Awarded ${entry.label}.`);
                                          }
                                        } catch (err) {
                                          toast.error(
                                            err instanceof Error
                                              ? err.message
                                              : "Badge update failed.",
                                          );
                                        } finally {
                                          setBadgeBusy(null);
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50 ${
                                        has
                                          ? "border-[var(--uf-cyan)]/40 bg-[var(--uf-cyan)]/10 text-[var(--uf-cyan)]"
                                          : "border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text hover:border-[var(--uf-cyan)]/30"
                                      }`}
                                    >
                                      <Icon className="h-3 w-3" aria-hidden />
                                      {entry.label}
                                      {busy ? (
                                        <Loader2
                                          className="h-2.5 w-2.5 animate-spin"
                                          aria-hidden
                                        />
                                      ) : null}
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </details>
                          <details className="text-xs">
                            <summary className="cursor-pointer text-uf-cyan">
                              Override usage
                            </summary>
                            <div className="mt-2 grid gap-1">
                              <label className="text-uf-muted">
                                AI used
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="n"
                                  className="ml-2 w-20 border border-[color:var(--uf-border)] rounded px-2 py-1 text-xs bg-[rgba(16,24,39,0.5)]"
                                  onKeyDown={async (e) => {
                                    if (e.key !== "Enter") return;
                                    const v = parseInt(
                                      (e.target as HTMLInputElement).value,
                                      10,
                                    );
                                    if (Number.isNaN(v)) return;
                                    try {
                                      await setUsage({
                                        userId: u._id,
                                        monthlyAiUsed: v,
                                        reason: "operator override",
                                      });
                                      toast.success("AI used overridden.");
                                      (e.target as HTMLInputElement).value = "";
                                    } catch {
                                      toast.error("Failed to override.");
                                    }
                                  }}
                                />
                              </label>
                              <label className="text-uf-muted">
                                Storage GB
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  placeholder="GB"
                                  className="ml-2 w-20 border border-[color:var(--uf-border)] rounded px-2 py-1 text-xs bg-[rgba(16,24,39,0.5)]"
                                  onKeyDown={async (e) => {
                                    if (e.key !== "Enter") return;
                                    const v = parseFloat(
                                      (e.target as HTMLInputElement).value,
                                    );
                                    if (Number.isNaN(v)) return;
                                    try {
                                      await setUsage({
                                        userId: u._id,
                                        storageUsedGb: v,
                                        reason: "operator override",
                                      });
                                      toast.success("Storage overridden.");
                                      (e.target as HTMLInputElement).value = "";
                                    } catch {
                                      toast.error("Failed to override.");
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </details>
                          <Link
                            to={`/operator/users/${u._id}`}
                            className="inline-flex items-center gap-1.5 text-xs text-[var(--uf-cyan)] hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            View
                          </Link>
                          <button
                            type="button"
                            disabled={removing === u._id}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Remove ${u.displayName ?? u.email ?? "this member"} from the roster?` +
                                    (u.role === "admin"
                                      ? "\n\nThis is an admin account — removal is blocked."
                                      : "\n\nTheir account and session will be deleted."),
                                )
                              )
                                return;
                              await handleRemove(u, false);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-uf-red hover:underline disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            {removing === u._id ? "Removing…" : "Remove"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </HoloCard>
    </OperatorShell>
  );
}

function UsageMini({
  label,
  used,
  cap,
  percent,
  suffix = "",
}: {
  label: string;
  used: number;
  cap: number;
  percent: number;
  suffix?: string;
}) {
  const variant =
    percent >= 100 ? "danger" : percent >= 80 ? "warning" : "success";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-uf-muted text-[10px] uppercase tracking-[0.16em]">
          {label}
        </span>
        <span className="text-xs">
          {used.toLocaleString()}
          {suffix} <span className="text-uf-muted">/ {cap.toLocaleString()}</span>
        </span>
      </div>
      <div
        className="uf-progress mt-0.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        aria-label={`${label} ${percent}% used`}
      >
        <div
          className="uf-progress__bar"
          style={{
            width: `${Math.min(100, percent)}%`,
            background:
              variant === "danger"
                ? "linear-gradient(90deg, var(--uf-red), var(--uf-magenta))"
                : variant === "warning"
                  ? "linear-gradient(90deg, var(--uf-gold), var(--uf-magenta))"
                  : undefined,
            boxShadow:
              variant === "danger"
                ? "var(--uf-glow-danger)"
                : variant === "warning"
                  ? "var(--uf-glow-violet)"
                  : undefined,
          }}
        />
      </div>
      <StatusPill variant={variant} className="mt-0.5">
        {percent >= 100 ? "Overage" : percent >= 80 ? "Near cap" : "Healthy"}
      </StatusPill>
    </div>
  );
}
