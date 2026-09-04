import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteShell, PageHero, HoloCard, StatusPill, NeonButton } from "@/components/uf";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import { usePageMeta } from "@/hooks/use-page-meta";
export default function Groups() {
  const [privacy, setPrivacy] = useState("");
  const [cat, setCat] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ops");
  const [newPrivacy, setNewPrivacy] = useState<"public" | "private" | "classified">("public");
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const groups = useQuery(
    api.groups.listGroups,
    privacy || cat ? { privacy: privacy || undefined, category: cat || undefined } : {},
  );
  const memberships = useQuery(api.groups.myGroupMemberships);
  const joinGroup = useMutation(api.groups.joinGroup);
  const leaveGroup = useMutation(api.groups.leaveGroup);
  const createGroup = useMutation(api.groups.createGroup);
  const [busyId, setBusyId] = useState<Id<"groups"> | null>(null);
  const [stalled, setStalled] = useState(false);

  usePageMeta({
    title: "Fleet Groups — Star Force Base 1198",
    description:
      "Join patrol groups, specialist guilds, and operational units across the fleet.",
    noindex: false,
  });

  // If the groups query hasn't resolved within 8s, show an explicit error panel
  // instead of skeletons forever (makes connection failures visible).
  useEffect(() => {
    if (groups === undefined) {
      const t = setTimeout(() => setStalled(true), 8000);
      return () => clearTimeout(t);
    }
    // No reset needed: `stalled` only affects rendering while the query is
    // still undefined; once data arrives the grid renders regardless.
  }, [groups]);

  const memberIds = new Set((memberships ?? []).map((m) => m.groupId));

  const handleToggle = async (groupId: Id<"groups">, isMember: boolean) => {
    setBusyId(groupId);
    try {
      if (isMember) {
        await leaveGroup({ groupId });
        toast.success("Left group.");
      } else {
        await joinGroup({ groupId });
        toast.success("Joined group.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setCreating(true);
    try {
      const id = await createGroup({
        name: name.trim(),
        description: description.trim(),
        category,
        privacy: newPrivacy,
      });
      toast.success("Group opened.");
      setShowCreate(false);
      setName("");
      setDescription("");
      setCategory("ops");
      setNewPrivacy("public");
      // GroupBySlug needs the slug — refetch list then navigate by id.
      const created = groups?.find((g) => g._id === id);
      if (created) {
        navigate(`/groups/${created.slug}`);
      } else {
        navigate("/groups");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SiteShell>
      <PageHero
        eyebrow="Groups"
        title="Find your people."
        lead="Public, private, classified groups. Wiki + comms hybrid."
        primary={{ label: "Open a group", href: "#create-group", variant: "primary" }}
        secondary={{ label: "Activity Feed", href: "/activity", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="mb-6 flex flex-wrap gap-2">
          {["", "public", "private", "classified"].map((p) => (
            <button
              key={p || "all"}
              type="button"
              className={`uf-pill ${privacy === p ? "shadow-[var(--uf-glow-cyan)]" : ""}`}
              onClick={() => setPrivacy(p)}
            >
              {p || "All"}
            </button>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter groups by community type">
          {[
            ["", "All types"],
            ["ops", "Operations"],
            ["faction", "Factions"],
            ["ship", "Ship crews"],
            ["planet", "Homeworlds"],
            ["social", "Social"],
          ].map(([value, label]) => (
            <button
              key={value || "all-types"}
              type="button"
              className={`uf-pill ${cat === value ? "shadow-[var(--uf-glow-violet)]" : ""}`}
              onClick={() => setCat(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {showCreate && (
          <HoloCard id="create-group" className="mb-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="uf-eyebrow">New group</span>
                <h3 className="text-xl mt-1">Open a group</h3>
              </div>
              <button type="button" className="uf-btn uf-btn--ghost" onClick={() => setShowCreate(false)}>
                Close ✕
              </button>
            </div>
            {isAuthenticated ? (
              <form className="mt-4 flex flex-col gap-3" onSubmit={handleCreate}>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Sector Patrol 9"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Description
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    required
                    placeholder="What's this group about?"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                    Category
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                    >
                      <option value="faction">Faction (Ultra Force, G.I.A., Starforge, Chrono Monks)</option>
                      <option value="ship">Starship crew</option>
                      <option value="planet">Homeworld</option>
                      <option value="ops">Operations</option>
                      <option value="intel">Intel</option>
                      <option value="governance">Governance</option>
                      <option value="social">Social</option>
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                    Privacy
                    <select
                      value={newPrivacy}
                      onChange={(e) => setNewPrivacy(e.target.value as "public" | "private" | "classified")}
                      className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                      <option value="classified">Classified</option>
                    </select>
                  </label>
                </div>
                <NeonButton type="submit" variant="primary" loading={creating} disabled={!name.trim() || !description.trim()}>
                  Open group
                </NeonButton>
              </form>
            ) : (
              <div className="mt-4 flex items-center gap-3">
                <p className="text-uf-muted text-sm">Sign in to open a group.</p>
                <NeonButton variant="primary" onClick={() => (window.location.href = "/auth")}>Sign in</NeonButton>
              </div>
            )}
          </HoloCard>
        )}

        {!showCreate && (
          <div className="mb-6">
            <NeonButton variant="primary" onClick={() => setShowCreate(true)}>
              + Open a group
            </NeonButton>
          </div>
        )}

        {groups !== undefined && groups.length > 0 ? (
          <p
            className="mt-4 text-xs text-uf-muted/70 font-mono"
            aria-live="polite"
          >
            Registry sync: {groups.length} groups · Freebuff backend
          </p>
        ) : null}

        {groups === undefined ? (
          stalled ? (
            <div className="uf-empty">
              <p className="text-base font-semibold">Group registry unreachable</p>
              <p className="text-uf-muted text-sm mt-1">
                The group query did not resolve. This usually means the dev server
                or database connection dropped — retry, or restart the preview.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="uf-btn uf-btn--primary mt-4"
              >
                ⟳ Retry now
              </button>
            </div>
          ) : (
            <HoloCard>
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <span
                  className="inline-block h-8 w-8 rounded-full animate-spin"
                  style={{ border: "2px solid rgba(0,229,255,0.2)", borderTopColor: "var(--uf-cyan)", boxShadow: "0 0 18px rgba(0,229,255,0.35)" }}
                  aria-hidden
                />
                <p className="text-sm uppercase tracking-[0.16em] text-uf-muted">
                  Synchronizing with group registry…
                </p>
              </div>
            </HoloCard>
          )
        ) : groups.length === 0 ? (
          <div className="uf-empty">
            {privacy
              ? "No groups match this filter."
              : "No groups yet — open the first one."}
          </div>
        ) : (
          <ul className="uf-grid uf-grid--3 list-none p-0 m-0">
            {groups.map((g, idx) => {
              const isMember = memberIds.has(g._id);
              return (
                <li key={g._id}>
                  <ScaleReveal staggerIndex={idx}>
                    <HoloCard
                      className="h-full flex flex-col cursor-pointer transition-all hover:-translate-y-1"
                      htmlProps={{
                        onClick: () => navigate(`/groups/${g.slug}`),
                        onKeyDown: (e: KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/groups/${g.slug}`);
                          }
                        },
                        role: "link",
                        tabIndex: 0,
                        "aria-label": `Open group ${g.name}`,
                      }}
                    >
                      <div className="flex items-start justify-between mb-2 gap-3">
                        <div>
                          <span className="uf-eyebrow">{g.category ?? "ops"}</span>
                          <h3 className="text-lg font-semibold mt-1 hover:text-[var(--uf-cyan)] transition-colors">{g.name}</h3>
                        </div>
                        <StatusPill
                          variant={
                            g.privacy === "public"
                              ? "success"
                              : g.privacy === "private"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {g.privacy}
                        </StatusPill>
                      </div>
                      <p className="text-uf-muted text-sm">{g.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-uf-muted">{g.memberCount ?? 0} members</p>
                        {g.latestActivityAt && (
                          <p className="text-xs text-uf-muted">
                            Last activity {new Date(g.latestActivityAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-[var(--uf-cyan)] mt-3 font-medium">Open group →</p>
                      <div className="mt-3 border-t border-[color:var(--uf-border)] pt-3" onClick={(e) => e.stopPropagation()}>
                        {isAuthenticated ? (
                          <NeonButton
                            type="button"
                            variant={isMember ? "ghost" : "primary"}
                            loading={busyId === g._id}
                            onClick={() => handleToggle(g._id, isMember)}
                            className="w-full"
                          >
                            {isMember ? "Leave group" : "Join group"}
                          </NeonButton>
                        ) : (
                          <NeonButton
                            type="button"
                            variant="primary"
                            className="w-full"
                            onClick={() => (window.location.href = "/auth")}
                          >
                            Sign in to join
                          </NeonButton>
                        )}
                      </div>
                    </HoloCard>
                  </ScaleReveal>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}
