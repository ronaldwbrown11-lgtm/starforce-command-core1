import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useParams } from "react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill, NeonButton } from "@/components/uf";
import { getAchievement } from "@/lib/achievements";
import { tierLabel } from "@/lib/tiers";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookMarked,
  FileText,
  Loader2,
  MessageSquare,
  PenTool,
  Radio,
  Users,
} from "lucide-react";

const STORY_STATUS_VARIANT: Record<string, "default" | "warning" | "info" | "success" | "danger"> = {
  draft: "default",
  submitted: "warning",
  in_review: "info",
  changes_requested: "danger",
  approved: "success",
  published: "success",
  archived: "default",
};

const COMMENT_STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "default"> = {
  published: "success",
  hold: "warning",
  deleted: "danger",
};

function fmtDate(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Avatar({ name, url, size = 16 }: { name: string; url?: string | null; size?: number }) {
  const cls = `h-${size} w-${size} rounded-full shrink-0 object-cover`;
  if (url) return <img src={url} alt="" className={cls} />;
  return (
    <div
      className={`${cls} bg-[rgba(0,229,255,0.15)] flex items-center justify-center text-sm font-bold text-[var(--uf-cyan)]`}
    >
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.5)] px-3 py-2">
      <p className="text-xl font-semibold text-[var(--uf-cyan)] font-mono">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.16em] text-uf-muted mt-0.5">{label}</p>
    </div>
  );
}

export default function OperatorUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const data = useQuery(
    api.operator.userDetail,
    userId ? { id: userId as Id<"users"> } : "skip",
  );
  const revoke = useMutation(api.operator.revokeActiveSession);
  const adjustXp = useMutation(api.operator.adjustUserXp);
  const [pending, setPending] = useState<string | null>(null);
  const [tab, setTab] = useState<"sessions" | "content">("sessions");
  const [xpDelta, setXpDelta] = useState("");
  const [xpNote, setXpNote] = useState("");
  const [xpBusy, setXpBusy] = useState(false);

  if (data === undefined) {
    return (
      <OperatorShell>
        <div className="uf-skeleton" style={{ height: 300 }} />
      </OperatorShell>
    );
  }
  if (data === null) {
    return (
      <OperatorShell>
        <HoloCard>
          <div className="uf-empty">User not found.</div>
        </HoloCard>
      </OperatorShell>
    );
  }

  const { user } = data;
  const badges = user.achievements ?? [];
  const lastSeen = data.sessions[0]?.lastSeenAt ?? user.lastSeen;

  const sections: Array<{ key: string; label: string; count: number; render: React.ReactNode }> = [
    {
      key: "stories",
      label: "Stories",
      count: data.stories.length,
      render: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {data.stories.length === 0 ? (
            <p className="text-uf-muted text-sm">None authored.</p>
          ) : (
            data.stories.map((s) => (
              <li key={s._id} className="flex items-center gap-3 flex-wrap">
                <StatusPill variant={STORY_STATUS_VARIANT[s.status] ?? "default"}>{s.status}</StatusPill>
                <Link to={`/stories/${s.slug}`} className="text-sm hover:text-[var(--uf-cyan)] transition-colors">
                  {s.title}
                </Link>
                <span className="text-xs text-uf-muted ml-auto">{fmtDate(s.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      ),
    },
    {
      key: "lore",
      label: "Lore entries",
      count: data.loreEntries.length,
      render: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {data.loreEntries.length === 0 ? (
            <p className="text-uf-muted text-sm">None authored.</p>
          ) : (
            data.loreEntries.map((l) => (
              <li key={l._id} className="flex items-center gap-3 flex-wrap">
                <Link to={`/lore/${l.slug}`} className="text-sm hover:text-[var(--uf-cyan)] transition-colors">
                  {l.title}
                </Link>
                <span className="text-xs text-uf-muted">{(l.entryType ?? "").replace("_", " ")}</span>
                <span className="text-xs text-uf-muted ml-auto">{fmtDate(l.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      ),
    },
    {
      key: "threads",
      label: "Forum threads",
      count: data.threads.length,
      render: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {data.threads.length === 0 ? (
            <p className="text-uf-muted text-sm">None started.</p>
          ) : (
            data.threads.map((t) => (
              <li key={t._id} className="flex items-center gap-3 flex-wrap">
                <Link to="/forums" className="text-sm hover:text-[var(--uf-cyan)] transition-colors">
                  {t.title}
                </Link>
                <span className="text-xs text-uf-muted">({t.replyCount ?? 0} replies)</span>
                <span className="text-xs text-uf-muted ml-auto">{fmtDate(t.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      ),
    },
    {
      key: "replies",
      label: "Forum replies",
      count: data.replies.length,
      render: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {data.replies.length === 0 ? (
            <p className="text-uf-muted text-sm">None posted.</p>
          ) : (
            data.replies.map((r) => (
              <li key={r._id} className="text-sm text-uf-text/85">
                <span className="line-clamp-2">{r.content}</span>
                <span className="text-xs text-uf-muted">{fmtDate(r.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      ),
    },
    {
      key: "comments",
      label: "Comments",
      count: data.comments.length,
      render: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {data.comments.length === 0 ? (
            <p className="text-uf-muted text-sm">None posted.</p>
          ) : (
            data.comments.map((c) => (
              <li key={c._id} className="flex items-start gap-3">
                <StatusPill variant={COMMENT_STATUS_VARIANT[c.status] ?? "default"}>{c.status}</StatusPill>
                <div className="min-w-0">
                  <p className="text-sm text-uf-text/85 line-clamp-2">{c.content}</p>
                  <p className="text-xs text-uf-muted">
                    on {c.parentType} · {fmtDate(c.createdAt)}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      ),
    },
    {
      key: "reports",
      label: "Fleet reports",
      count: data.reports.length,
      render: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {data.reports.length === 0 ? (
            <p className="text-uf-muted text-sm">None filed.</p>
          ) : (
            data.reports.map((r) => (
              <li key={r._id} className="flex items-center gap-3 flex-wrap">
                <span className="text-sm">{r.title}</span>
                <span className="text-xs text-uf-muted ml-auto">{fmtDate(r.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      ),
    },
    {
      key: "activity",
      label: "Recent activity",
      count: data.activity.length,
      render: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {data.activity.length === 0 ? (
            <p className="text-uf-muted text-sm">No recorded activity.</p>
          ) : (
            data.activity.map((a) => (
              <li key={a._id} className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-[var(--uf-cyan)] capitalize">{a.verb.replace("_", " ")}</span>
                <span className="text-uf-muted">→ {a.targetType}</span>
                {a.summary ? <span className="text-uf-text/85 truncate max-w-64">{a.summary}</span> : null}
                <span className="text-xs text-uf-muted ml-auto">{fmtDate(a.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      ),
    },
  ];

  return (
    <OperatorShell>
      <Link
        to="/operator/users"
        className="inline-flex items-center gap-1.5 text-sm text-uf-muted hover:text-[var(--uf-cyan)] transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> User management
      </Link>

      {/* Profile header */}
      <HoloCard className="mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={user.displayName ?? user.name ?? "?"} url={user.avatarUrl} size={16} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">
                {user.displayName ?? user.name ?? "Unnamed recruit"}
              </h1>
              {badges.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {badges.map((key) => {
                    const entry = getAchievement(key);
                    if (!entry) return null;
                    const Icon = entry.icon;
                    return (
                      <span
                        key={key}
                        title={entry.description}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--uf-cyan)]/30 bg-[rgba(0,229,255,0.06)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--uf-cyan)]"
                      >
                        <Icon className="h-2.5 w-2.5" aria-hidden /> {entry.label}
                      </span>
                    );
                  })}
                </span>
              ) : null}
            </div>
            <p className="text-uf-muted text-sm mt-0.5">
              {user.email ?? "no email"} · joined {fmtDate(user._creationTime)}
              {user.role ? ` · role ${user.role}` : ""}
            </p>
            {user.bio ? <p className="text-sm text-uf-text/80 mt-2 max-w-2xl">{user.bio}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {user.tier ? (
              <StatusPill variant={user.tier === "gia_agent" ? "gold" : "info"}>{tierLabel(user.tier)}</StatusPill>
            ) : null}
            {user.opRole ? <StatusPill variant="violet">{user.opRole}</StatusPill> : null}
            {user.role === "admin" ? <StatusPill variant="danger">admin</StatusPill> : null}
            <StatusPill variant="default">
              {user.rank ?? "Recruit"} · {user.xp ?? 0} XP
            </StatusPill>
            {user.fleet ? <StatusPill variant="cyan">{user.fleet}</StatusPill> : null}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Stat label="Sessions" value={data.sessions.length} />
          <Stat label="Auth sessions" value={data.authSessionCount} />
          <Stat label="Stories" value={data.stories.length} />
          <Stat label="Lore" value={data.loreEntries.length} />
          <Stat label="Threads" value={data.threads.length} />
          <Stat label="Comments" value={data.comments.length} />
          <Stat label="Groups" value={data.memberships.length} />
          <Stat label="Last seen" value={lastSeen ? fmtDate(lastSeen).split(",")[0] : "—"} />
        </div>
      </HoloCard>

      {/* Adjust XP */}
      <HoloCard>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="min-w-0 flex-1">
            <span className="uf-eyebrow">Adjust XP</span>
            <p className="text-uf-muted text-xs mt-1">
              Current balance:{" "}
              <span className="text-[var(--uf-cyan)] font-mono">{(user.xp ?? 0).toLocaleString()} XP</span>
              {" "}· add a bonus or correct an over-award. Changes are audit-logged.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[50, 100, 500].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setXpDelta(String(v))}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    xpDelta === String(v)
                      ? "border-[rgba(80,255,160,0.7)] bg-[rgba(80,255,160,0.12)] text-uf-text"
                      : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text"
                  }`}
                >
                  +{v}
                </button>
              ))}
              {[-50, -100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setXpDelta(String(v))}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    xpDelta === String(v)
                      ? "border-[rgba(255,107,107,0.7)] bg-[rgba(255,107,107,0.12)] text-uf-text"
                      : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text"
                  }`}
                >
                  {v}
                </button>
              ))}
              <label className="sr-only" htmlFor="xp-delta">XP adjustment amount</label>
              <input
                id="xp-delta"
                type="number"
                value={xpDelta}
                onChange={(e) => setXpDelta(e.target.value)}
                placeholder="Custom ±"
                className="w-28 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-2.5 py-1 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
              <label className="sr-only" htmlFor="xp-note">XP adjustment note</label>
              <input
                id="xp-note"
                type="text"
                value={xpNote}
                onChange={(e) => setXpNote(e.target.value)}
                maxLength={200}
                placeholder="Reason (optional)"
                className="flex-1 min-w-[160px] rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-2.5 py-1 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
            </div>
          </div>
          <NeonButton
            variant="primary"
            loading={xpBusy}
            disabled={!xpDelta.trim() || Number(xpDelta) === 0}
            onClick={async () => {
              const delta = Number(xpDelta);
              if (!Number.isFinite(delta) || delta === 0) return;
              setXpBusy(true);
              try {
                const res = await adjustXp({
                  userId: user._id,
                  delta,
                  note: xpNote.trim() || undefined,
                });
                toast.success(
                  `XP updated to ${res.xp.toLocaleString()} (${delta > 0 ? "+" : ""}${delta}).`,
                );
                setXpDelta("");
                setXpNote("");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Adjustment failed.");
              } finally {
                setXpBusy(false);
              }
            }}
          >
            Apply
          </NeonButton>
        </div>
      </HoloCard>

      {/* Tabs */}
      <div
        className="flex flex-wrap gap-2 mb-4 rounded-lg border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.5)] p-1.5 w-fit"
        role="tablist"
        aria-label="User detail"
      >
        {(
          [
            { key: "sessions", label: `Sessions & logins (${data.activeSessions.length})`, icon: <Radio className="h-4 w-4" aria-hidden /> },
            { key: "content", label: `Authored content (${data.stories.length + data.loreEntries.length + data.threads.length + data.replies.length + data.comments.length + data.reports.length})`, icon: <PenTool className="h-4 w-4" aria-hidden /> },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key
                ? "bg-[var(--uf-cyan)]/15 text-[var(--uf-cyan)] border border-[var(--uf-cyan)]/40"
                : "text-uf-muted hover:text-uf-text border border-transparent"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sessions" ? (
        <HoloCard>
          <span className="uf-eyebrow">Login history</span>
          {data.activeSessions.length === 0 ? (
            <div className="uf-empty mt-3">No active sessions.</div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="uf-data-grid" style={{ minWidth: 640 }}>
                <caption className="uf-sr-only">Session and login history</caption>
                <thead>
                  <tr>
                    <th>Login</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activeSessions.map((s) => (
                    <tr key={s._id}>
                      <td>{fmtDate(s.loginAt)}</td>
                      <td>{fmtDate(s.expirationTime)}</td>
                      <td>
                        <NeonButton
                          variant="danger"
                          className="uf-btn--sm"
                          disabled={pending === s._id}
                          onClick={async () => {
                            if (!window.confirm("Revoke this session? Audit-logged.")) return;
                            setPending(s._id);
                            try {
                              await revoke({ id: s._id });
                              toast.success("Session revoked.");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Forbidden.");
                            } finally {
                              setPending(null);
                            }
                          }}
                        >
                          {pending === s._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : null}
                          Revoke
                        </NeonButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </HoloCard>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((s) => (
            <HoloCard key={s.key}>
              <span className="uf-eyebrow">{s.label}</span>
              <h3 className="text-base font-semibold mt-1">{s.count}</h3>
              <div className="mt-3">{s.render}</div>
            </HoloCard>
          ))}
          {data.memberships.length > 0 ? (
            <HoloCard>
              <span className="uf-eyebrow">Group memberships</span>
              <h3 className="text-base font-semibold mt-1">{data.memberships.length}</h3>
              <ul className="list-none p-0 m-0 mt-3 flex flex-col gap-2">
                {data.memberships.map((m) => (
                  <li key={m.groupId} className="flex items-center gap-3 flex-wrap text-sm">
                    <Users className="h-3.5 w-3.5 text-uf-muted" aria-hidden />
                    <Link
                      to={`/groups/${m.groupId}`}
                      className="hover:text-[var(--uf-cyan)] transition-colors"
                    >
                      {m.groupName}
                    </Link>
                    <StatusPill variant={m.role === "owner" ? "warning" : m.role === "moderator" ? "info" : "default"}>
                      {m.role}
                    </StatusPill>
                    <span className="text-xs text-uf-muted ml-auto">joined {fmtDate(m.joinedAt)}</span>
                  </li>
                ))}
              </ul>
            </HoloCard>
          ) : null}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/operator/users" className="uf-btn uf-btn--ghost">
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden /> Back to user management
        </Link>
        <Link to="/operator/audit" className="uf-btn uf-btn--ghost">
          <FileText className="h-4 w-4 mr-1.5" aria-hidden /> Audit log
        </Link>
        <Link to="/operator/sessions" className="uf-btn uf-btn--ghost">
          <MessageSquare className="h-4 w-4 mr-1.5" aria-hidden /> All sessions
        </Link>
        <Link to="/operator/logins" className="uf-btn uf-btn--ghost">
          <BookMarked className="h-4 w-4 mr-1.5" aria-hidden /> All logins
        </Link>
      </div>
    </OperatorShell>
  );
}
