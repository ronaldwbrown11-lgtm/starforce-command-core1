import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Users, UserMinus, UserPlus } from "lucide-react";
import { opRoleValidator } from "@/convex/schema";
import type { Infer } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";

type OpRole = Infer<typeof opRoleValidator> | null;
type OpRoleLiteral = NonNullable<OpRole>;

const OP_ROLE_OPTIONS: { value: OpRoleLiteral; label: string; variant: "info" | "violet" | "gold" }[] = [
  { value: "operator", label: "Operator", variant: "info" },
  { value: "senior_operator", label: "Senior Operator", variant: "gold" },
  { value: "story_editor", label: "Story Editor", variant: "violet" },
  { value: "lore_archivist", label: "Lore Archivist", variant: "violet" },
  { value: "community_moderator", label: "Community Mod", variant: "info" },
];

const ALL_POTENTIAL: OpRoleLiteral[] = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
  "community_moderator",
];

function variantForRole(role: string | null): "info" | "violet" | "gold" | "default" {
  if (role === "senior_operator") return "gold";
  if (role === "story_editor" || role === "lore_archivist") return "violet";
  if (role === "operator" || role === "community_moderator") return "info";
  return "default";
}

export default function OperatorTeam() {
  const operators = useQuery(api.admin.listOperators, { limit: 100 });
  const candidates = useQuery(api.operator.listUsersForOperator, {
    limit: 60,
  });
  const setUserOpRole = useMutation(api.operator.setUserOpRole);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");
  const [addPendingId, setAddPendingId] = useState<string | null>(null);

  const filteredOps = (operators ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.fleet?.toLowerCase().includes(q) ||
      String(u.opRole ?? "").includes(q)
    );
  });

  const addCandidates = (candidates ?? []).filter((u) => {
    if (u.opRole) return false;
    if (!addSearch.trim()) return false;
    const q = addSearch.trim().toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  async function changeRole(id: Id<"users">, role: OpRole) {
    setPendingId(`${id}_${role ?? "revoke"}`);
    try {
      await setUserOpRole({ id, opRole: role });
      toast.success(role ? `Role set to ${role}` : "Revoked.");
    } catch {
      toast.error("Role update failed.");
    } finally {
      setPendingId(null);
    }
  }

  async function assignNew(id: Id<"users">, role: OpRoleLiteral) {
    if (!role) return;
    setAddPendingId(id);
    try {
      await setUserOpRole({ id, opRole: role });
      setAddSearch("");
      toast.success(`Assigned ${role}.`);
    } catch {
      toast.error("Assignment failed.");
    } finally {
      setAddPendingId(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <Users className="h-6 w-6 text-uf-cyan" aria-hidden />
          Team Roster
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Operators are capability-gated by their <code>opRole</code>. Reassign
          or revoke with confirm — every change is audit-logged.
        </p>
      </header>

      <section aria-labelledby="team-current" className="mb-8">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id="team-current" className="text-xl font-semibold">
            Currently assigned
          </h2>
          <StatusPill variant="violet">
            {filteredOps.length} operator{filteredOps.length === 1 ? "" : "s"}
          </StatusPill>
        </header>
        <HoloCard>
          <label
            htmlFor="operator-search"
            className="text-xs uppercase tracking-[0.16em] text-uf-muted"
          >
            Filter
          </label>
          <input
            id="operator-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, fleet, email, or role"
            className="mt-1 mb-3 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          {operators === undefined ? (
            <div className="uf-skeleton" style={{ height: 80 }} />
          ) : filteredOps.length === 0 ? (
            <p className="uf-empty">No operators match.</p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {filteredOps.map((u) => (
                <li
                  key={u._id}
                  className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate">
                      {u.displayName ?? u.name ?? u.email ?? "—"}
                    </p>
                    <p className="text-uf-muted text-xs">
                      {u.email ?? "no email"} ·{" "}
                      {u.fleet ?? "no fleet"} ·{" "}
                      {u.xp?.toLocaleString() ?? 0} XP
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill variant={variantForRole(u.opRole ?? null)}>
                      {u.opRole ?? "—"}
                    </StatusPill>
                    <select
                      aria-label={`Change role for ${u.displayName ?? u.email}`}
                      className="border border-[color:var(--uf-border)] rounded-md px-2 py-1 text-sm bg-[rgba(16,24,39,0.5)]"
                      value=""
                      onChange={(e) => {
                        const v = (e.target.value || null) as OpRole;
                        if (v === u.opRole) return;
                        if (!window.confirm(
                          v
                            ? `Reassign ${u.displayName ?? "operator"} to "${v}"? This is audit-logged.`
                            : `Revoke ${u.displayName ?? "operator"} from operator role? This is audit-logged.`,
                        )) {
                          return;
                        }
                        changeRole(u._id, v);
                      }}
                    >
                      <option value="">Change…</option>
                      {ALL_POTENTIAL.map((r) => (
                        <option key={r} value={r} disabled={r === u.opRole}>
                          {r}
                        </option>
                      ))}
                      <option value="" disabled={!u.opRole}>— Revoke —</option>
                    </select>
                    {u.opRole && (
                      <NeonButton
                        variant="danger"
                        disabled={pendingId === `${u._id}_revoke`}
                        loading={pendingId === `${u._id}_revoke`}
                        onClick={() => {
                          if (window.confirm(
                            `Revoke operator role from ${u.displayName ?? "this user"}?`,
                          ))
                            changeRole(u._id, null);
                        }}
                      >
                        <UserMinus className="h-4 w-4" aria-hidden />
                      </NeonButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
      </section>

      <section aria-labelledby="team-add">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id="team-add" className="text-xl font-semibold">
            Promote a member
          </h2>
          <StatusPill variant="info">Add a new operator</StatusPill>
        </header>
        <HoloCard>
          <label
            htmlFor="add-search"
            className="text-xs uppercase tracking-[0.16em] text-uf-muted"
          >
            Search a non-operator member
          </label>
          <input
            id="add-search"
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder="Type a name or email to look up who to promote"
            className="mt-1 mb-3 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          {addSearch.trim() === "" ? (
            <p className="text-uf-muted text-xs">
              Type at least 1 character to begin.
            </p>
          ) : addCandidates.length === 0 ? (
            <p className="uf-empty">No matching non-operators.</p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {addCandidates.slice(0, 6).map((u) => (
                <li
                  key={u._id}
                  className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate">
                      {u.displayName ?? u.name ?? u.email ?? "—"}
                    </p>
                    <p className="text-uf-muted text-xs">
                      {u.email ?? "no email"} ·{" "}
                      {u.fleet ?? "no fleet"} ·{" "}
                      {u.role ?? "user"}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {ALL_POTENTIAL.map((r) => (
                      <button
                        type="button"
                        key={r}
                        className="uf-btn"
                        disabled={addPendingId === u._id}
                        onClick={() => {
                          if (window.confirm(
                            `Promote ${u.displayName ?? "this user"} to "${r}"?`,
                          ))
                            assignNew(u._id, r);
                        }}
                      >
                        <UserPlus className="h-4 w-4" aria-hidden />
                        {r.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
      </section>
    </OperatorShell>
  );
}
