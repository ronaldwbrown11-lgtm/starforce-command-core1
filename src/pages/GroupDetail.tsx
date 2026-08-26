import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useParams } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill, NeonButton } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  CalendarDays,
  CheckCircle2,
  Crown,
  FileText,
  Loader2,
  MessageSquare,
  PencilRuler,
  Pin,
  PinOff,
  Rocket,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Tab = "overview" | "chat" | "ops" | "members";
type MemberRole = "owner" | "moderator" | "member";

const ROLE_PILL: Record<MemberRole, "warning" | "info" | "default"> = {
  owner: "warning",
  moderator: "info",
  member: "default",
};

const STATUS_PILL: Record<string, "success" | "warning" | "info" | "default" | "danger"> = {
  open: "success",
  in_progress: "warning",
  completed: "info",
  cancelled: "danger",
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const cls = "h-8 w-8 rounded-full shrink-0 object-cover";
  if (url) return <img src={url} alt="" className={cls} />;
  return (
    <div
      className={`${cls} bg-[rgba(0,229,255,0.15)] flex items-center justify-center text-xs font-semibold text-[var(--uf-cyan)]`}
    >
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function GroupDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const data = useQuery(api.groups.groupBySlug, slug ? { slug } : "skip");
  const joinGroup = useMutation(api.groups.joinGroup);
  const leaveGroup = useMutation(api.groups.leaveGroup);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  const group = data?.group ?? null;
  const members = data?.members ?? [];
  const isMember = data?.isMember ?? false;
  const myRole: MemberRole | null = data?.myRole ?? null;
  const isMod = myRole === "owner" || myRole === "moderator";
  const isOwner = myRole === "owner";

  usePageMeta({
    title: "Group — Star Force Base 1198",
    description: "Fleet group details, members, and activity.",
    noindex: false,
  });

  if (data === undefined) {
    return (
      <SiteShell>
        <PageHero eyebrow="Group" title="Opening channel…" />
        <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="uf-skeleton" style={{ height: 300 }} />
        </section>
      </SiteShell>
    );
  }

  if (data === null || !group) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Offline"
          title="Group not found"
          lead="This channel has gone dark."
          primary={{ label: "Browse groups", href: "/groups", variant: "primary" }}
        />
      </SiteShell>
    );
  }

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (isMember) {
        await leaveGroup({ groupId: group._id });
        toast.success("Left group.");
      } else {
        await joinGroup({ groupId: group._id });
        toast.success("Joined group.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const privacyVariant =
    group.privacy === "public"
      ? ("success" as const)
      : group.privacy === "private"
        ? ("warning" as const)
        : ("danger" as const);

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "overview", label: "Overview", icon: <FileText className="h-4 w-4" aria-hidden /> },
    { key: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" aria-hidden /> },
    { key: "ops", label: "Missions & Events", icon: <Rocket className="h-4 w-4" aria-hidden /> },
    { key: "members", label: `Members (${members.length})`, icon: <Users className="h-4 w-4" aria-hidden /> },
  ];

  return (
    <SiteShell>
      <PageHero
        eyebrow={group.category ?? "ops"}
        title={group.name}
        lead={group.description}
        primary={{ label: isMember ? "Leave group" : "Join group", href: "#join", variant: isMember ? "ghost" : "primary" }}
        secondary={{ label: "All groups", href: "/groups", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Status strip */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <StatusPill variant={privacyVariant}>{group.privacy}</StatusPill>
          {myRole ? <StatusPill variant={ROLE_PILL[myRole]}>{myRole}</StatusPill> : null}
          {isMember ? (
            <span className="text-xs text-uf-muted">You're in the collaborator space.</span>
          ) : (
            <span className="text-xs text-uf-muted">Membership unlocks the workspace below.</span>
          )}
          {isMod ? (
            <span className="text-xs text-uf-muted ml-auto hidden sm:inline">
              {isOwner ? "Owner powers active" : "Moderator powers active"}
            </span>
          ) : null}
        </div>

        {/* Gate: must be a member to use the workspace */}
        {!isMember ? (
          <HoloCard id="join">
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-[rgba(0,229,255,0.12)] flex items-center justify-center">
                <Rocket className="h-6 w-6 text-[var(--uf-cyan)]" aria-hidden />
              </div>
              <div>
                <h3 className="text-lg">Join to collaborate</h3>
                <p className="text-uf-muted text-sm mt-1 max-w-md">
                  Membership unlocks the group chat, posts, missions & events, and the member
                  roster for {group.name}.
                </p>
              </div>
              {isAuthenticated ? (
                <NeonButton type="button" variant="primary" loading={busy} onClick={handleToggle}>
                  Join group
                </NeonButton>
              ) : (
                <NeonButton
                  type="button"
                  variant="primary"
                  onClick={() => (window.location.href = "/auth")}
                >
                  Sign in to join
                </NeonButton>
              )}
            </div>
          </HoloCard>
        ) : (
          <>
            {/* Tabs */}
            <div
              className="flex flex-wrap gap-2 mb-4 rounded-lg border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.5)] p-1.5"
              role="tablist"
              aria-label="Group workspace"
            >
              {tabs.map((t) => (
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

            {tab === "overview" ? (
              <OverviewTab groupId={group._id} isMod={isMod} />
            ) : tab === "chat" ? (
              <ChatTab groupId={group._id} meId={data.meId ?? undefined} />
            ) : tab === "ops" ? (
              <OpsTab groupId={group._id} isMod={isMod} />
            ) : (
              <MembersTab
                groupId={group._id}
                members={members}
                meId={data.meId ?? undefined}
                myRole={myRole}
              />
            )}
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/forums" className="uf-btn uf-btn--ghost">Visit the forums</Link>
          <Link to="/groups" className="uf-btn uf-btn--ghost">Browse all groups</Link>
        </div>
      </section>
    </SiteShell>
  );
}

// ---- Overview: posts & announcements ----

function OverviewTab({ groupId, isMod }: { groupId: Id<"groups">; isMod: boolean }) {
  const posts = useQuery(api.groupSpace.listGroupPosts, { groupId });
  const createPost = useMutation(api.groupSpace.createGroupPost);
  const pinPost = useMutation(api.groupSpace.pinGroupPost);
  const deletePost = useMutation(api.groupSpace.deleteGroupPost);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"post" | "announcement">("post");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createPost({
        groupId,
        title,
        body,
        kind: kind === "announcement" && isMod ? "announcement" : "post",
      });
      toast.success(kind === "announcement" ? "Announcement posted." : "Post published.");
      setTitle("");
      setBody("");
      setKind("post");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div className="flex flex-col gap-3">
        {posts === undefined ? (
          <div className="uf-skeleton" style={{ height: 160 }} />
        ) : posts.length === 0 ? (
          <HoloCard>
            <div className="uf-empty">No posts yet. Break the silence — start a thread.</div>
          </HoloCard>
        ) : (
          posts.map((p) => (
            <HoloCard key={p._id}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {p.pinned ? (
                  <StatusPill variant="warning">
                    <Pin className="h-3 w-3 inline mr-1" aria-hidden />Pinned
                  </StatusPill>
                ) : null}
                <StatusPill variant={p.kind === "announcement" ? "violet" : "default"}>
                  {p.kind === "announcement" ? "Announcement" : "Post"}
                </StatusPill>
                <span className="text-xs text-uf-muted ml-auto">
                  {p.author?.displayName ?? "Unknown"} · {fmtDate(p.createdAt)}
                </span>
              </div>
              <h3 className="text-base font-semibold">{p.title}</h3>
              <p className="text-sm text-uf-text/85 whitespace-pre-wrap mt-1">{p.body}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {isMod ? (
                  <NeonButton
                    variant="ghost"
                    className="uf-btn--sm"
                    onClick={async () => {
                      try {
                        await pinPost({ id: p._id, pinned: !p.pinned });
                        toast.success(p.pinned ? "Unpinned." : "Pinned to top.");
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    {p.pinned ? <PinOff className="h-3.5 w-3.5 mr-1.5" aria-hidden /> : <Pin className="h-3.5 w-3.5 mr-1.5" aria-hidden />}
                    {p.pinned ? "Unpin" : "Pin"}
                  </NeonButton>
                ) : null}
                <NeonButton
                  variant="ghost"
                  className="uf-btn--sm"
                  onClick={async () => {
                    if (!window.confirm("Delete this post?")) return;
                    try {
                      await deletePost({ id: p._id });
                      toast.success("Post deleted.");
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />Delete
                </NeonButton>
              </div>
            </HoloCard>
          ))
        )}
      </div>

      <HoloCard>
        <span className="uf-eyebrow">Compose</span>
        <h3 className="text-lg mt-1">{kind === "announcement" ? "New announcement" : "New post"}</h3>
        <form className="grid gap-3 mt-3" onSubmit={submit}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Title"
            aria-label="Post title"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={5}
            placeholder="What's happening in the group?"
            aria-label="Post body"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] resize-y"
          />
          {isMod ? (
            <div className="flex gap-2">
              {(["post", "announcement"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs uppercase tracking-wider cursor-pointer transition-colors ${
                    kind === k
                      ? "bg-[var(--uf-cyan)]/15 text-[var(--uf-cyan)] border border-[var(--uf-cyan)]/40"
                      : "text-uf-muted border border-[color:var(--uf-border)] hover:text-uf-text"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          ) : null}
          <NeonButton variant="primary" type="submit" loading={busy}>
            Publish
          </NeonButton>
        </form>
      </HoloCard>
    </div>
  );
}

// ---- Chat: real-time (Convex reactive subscription) ----

function ChatTab({ groupId, meId }: { groupId: Id<"groups">; meId?: Id<"users"> }) {
  const messages = useQuery(api.groupSpace.listGroupMessages, { groupId });
  const send = useMutation(api.groupSpace.sendGroupMessage);
  const remove = useMutation(api.groupSpace.deleteGroupMessage);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await send({ groupId, body: draft });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <HoloCard>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-[0.16em] text-uf-muted">
          Channel feed
        </span>
        <span className="relative flex h-2 w-2 ml-auto">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--uf-cyan)] opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--uf-cyan)]" />
        </span>
        <span className="text-[11px] text-uf-muted uppercase tracking-wider">live</span>
      </div>
      <div
        ref={scrollRef}
        className="h-[52vh] overflow-y-auto pr-2 flex flex-col gap-2"
        aria-live="polite"
      >
        {messages === undefined ? (
          <div className="flex items-center gap-2 text-uf-muted text-sm py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening channel…
          </div>
        ) : messages.length === 0 ? (
          <div className="uf-empty py-8">No transmissions yet. Say hello.</div>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === meId;
            return (
              <div
                key={m._id}
                className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
              >
                <Avatar name={m.author?.displayName ?? "?"} url={m.author?.avatarUrl} />
                <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap border ${
                      mine
                        ? "bg-[rgba(0,229,255,0.12)] border-[var(--uf-cyan)]/30 text-right"
                        : "bg-[rgba(16,24,39,0.6)] border-[color:var(--uf-border)]"
                    }`}
                  >
                    {m.body}
                  </div>
                  <p className="text-[11px] text-uf-muted mt-0.5 flex items-center gap-1.5 justify-end">
                    {mine ? (
                      <>
                        <button
                          type="button"
                          aria-label="Delete message"
                          className="text-uf-muted hover:text-uf-red cursor-pointer inline-flex items-center"
                          onClick={async () => {
                            try {
                              await remove({ id: m._id });
                            } catch (err) {
                              toast.error((err as Error).message);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                        <span>You · {fmtDate(m.createdAt)}</span>
                      </>
                    ) : (
                      <span>
                        {m.author?.displayName ?? "Unknown"} · {fmtDate(m.createdAt)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 mt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a message to the group…"
          aria-label="Chat message"
          className="flex-1 border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        />
        <NeonButton variant="primary" type="submit" disabled={sending || !draft.trim()}>
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          <span className="sr-only">Send</span>
        </NeonButton>
      </form>
    </HoloCard>
  );
}

// ---- Missions & Events ----

function OpsTab({ groupId, isMod }: { groupId: Id<"groups">; isMod: boolean }) {
  const events = useQuery(api.groupSpace.listGroupEvents, { groupId });
  const createEvent = useMutation(api.groupSpace.createGroupEvent);
  const setStatus = useMutation(api.groupSpace.setGroupEventStatus);
  const deleteEvent = useMutation(api.groupSpace.deleteGroupEvent);
  const toggleSignup = useMutation(api.groupSpace.toggleEventSignup);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"mission" | "event">("mission");
  const [scheduled, setScheduled] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createEvent({
        groupId,
        title,
        description,
        kind,
        scheduledAt: scheduled ? new Date(scheduled).getTime() : undefined,
      });
      toast.success(kind === "mission" ? "Mission launched." : "Event scheduled.");
      setTitle("");
      setDescription("");
      setScheduled("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div className="flex flex-col gap-3">
        {events === undefined ? (
          <div className="uf-skeleton" style={{ height: 160 }} />
        ) : events.length === 0 ? (
          <HoloCard>
            <div className="uf-empty">No missions or events yet. Launch one from the form.</div>
          </HoloCard>
        ) : (
          events.map((ev) => (
            <HoloCard key={ev._id}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <StatusPill variant={ev.kind === "mission" ? "violet" : "info"}>
                  {ev.kind === "mission" ? (
                    <Rocket className="h-3 w-3 inline mr-1" aria-hidden />
                  ) : (
                    <CalendarDays className="h-3 w-3 inline mr-1" aria-hidden />
                  )}
                  {ev.kind}
                </StatusPill>
                <StatusPill variant={STATUS_PILL[ev.status]}>{ev.status.replace("_", " ")}</StatusPill>
                <span className="text-xs text-uf-muted ml-auto">
                  {ev.createdByUser?.displayName ?? "Unknown"} · {fmtDate(ev.createdAt)}
                </span>
              </div>
              <h3 className="text-base font-semibold">{ev.title}</h3>
              <p className="text-sm text-uf-text/85 whitespace-pre-wrap mt-1">{ev.description}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-uf-muted">
                {ev.scheduledAt ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {fmtDate(ev.scheduledAt)}
                  </span>
                ) : (
                  <span>No scheduled time</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {ev.attendeeCount} signed up
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {ev.status === "open" || ev.status === "in_progress" ? (
                  <NeonButton
                    variant={ev.amSignedUp ? "ghost" : "primary"}
                    className="uf-btn--sm"
                    onClick={async () => {
                      try {
                        const res = await toggleSignup({ id: ev._id });
                        toast.success(res.signedUp ? "Signed up." : "Signup cancelled.");
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                    {ev.amSignedUp ? "Cancel signup" : "Sign up"}
                  </NeonButton>
                ) : null}
                {isMod ? (
                  <>
                    {ev.status === "open" ? (
                      <NeonButton
                        variant="ghost"
                        className="uf-btn--sm"
                        onClick={async () => {
                          try {
                            await setStatus({ id: ev._id, status: "in_progress" });
                            toast.success("Marked in progress.");
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      >
                        Start
                      </NeonButton>
                    ) : null}
                    {ev.status === "in_progress" ? (
                      <NeonButton
                        variant="ghost"
                        className="uf-btn--sm"
                        onClick={async () => {
                          try {
                            await setStatus({ id: ev._id, status: "completed" });
                            toast.success("Completed.");
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      >
                        Complete
                      </NeonButton>
                    ) : null}
                    {ev.status !== "cancelled" && ev.status !== "completed" ? (
                      <NeonButton
                        variant="ghost"
                        className="uf-btn--sm"
                        onClick={async () => {
                          try {
                            await setStatus({ id: ev._id, status: "cancelled" });
                            toast.success("Cancelled.");
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      >
                        Cancel
                      </NeonButton>
                    ) : null}
                  </>
                ) : null}
                <NeonButton
                  variant="ghost"
                  className="uf-btn--sm"
                  onClick={async () => {
                    if (!window.confirm("Delete this mission/event?")) return;
                    try {
                      await deleteEvent({ id: ev._id });
                      toast.success("Deleted.");
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />Delete
                </NeonButton>
              </div>
            </HoloCard>
          ))
        )}
      </div>

      <HoloCard>
        <span className="uf-eyebrow">Launch</span>
        <h3 className="text-lg mt-1">New mission or event</h3>
        <form className="grid gap-3 mt-3" onSubmit={submit}>
          <div className="flex gap-2">
            {(["mission", "event"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs uppercase tracking-wider cursor-pointer transition-colors ${
                  kind === k
                    ? "bg-[var(--uf-cyan)]/15 text-[var(--uf-cyan)] border border-[var(--uf-cyan)]/40"
                    : "text-uf-muted border border-[color:var(--uf-border)] hover:text-uf-text"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={kind === "mission" ? "Mission title" : "Event title"}
            aria-label="Mission or event title"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="Briefing / description"
            aria-label="Description"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] resize-y"
          />
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Scheduled time (optional)
            <input
              type="datetime-local"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <NeonButton variant="primary" type="submit" loading={busy}>
            {kind === "mission" ? "Launch mission" : "Schedule event"}
          </NeonButton>
        </form>
      </HoloCard>
    </div>
  );
}

// ---- Members: roster with roles & owner powers ----

type MemberRow = {
  userId: Id<"users">;
  joinedAt: number;
  role: MemberRole;
  displayName: string;
  rank?: string | null;
  avatarUrl?: string | null;
};

function MembersTab({
  groupId,
  members,
  meId,
  myRole,
}: {
  groupId: Id<"groups">;
  members: MemberRow[];
  meId?: Id<"users">;
  myRole: MemberRole | null;
}) {
  const setRole = useMutation(api.groupSpace.setMemberRole);
  const removeMember = useMutation(api.groupSpace.removeGroupMember);
  const transfer = useMutation(api.groupSpace.transferOwnership);
  const [pending, setPending] = useState<string | null>(null);

  const isOwner = myRole === "owner";
  const isMod = myRole === "owner" || myRole === "moderator";

  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setPending(key);
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <HoloCard>
      <span className="uf-eyebrow">Roster</span>
      <h3 className="text-xl mt-1">Members ({members.length})</h3>
      {isOwner ? (
        <p className="text-xs text-uf-muted mt-1">
          <Crown className="h-3 w-3 inline mr-1 text-[var(--uf-amber)]" aria-hidden />
          Owner powers: promote/demote moderators, remove members, transfer ownership.
        </p>
      ) : null}
      <ul className="mt-4 flex flex-col gap-2 list-none p-0 m-0">
        {members.map((m) => {
          const isMe = m.userId === meId;
          const key = `${m.userId}-${m.role}`;
          return (
            <li
              key={key}
              className="flex flex-wrap items-center gap-3 p-2.5 rounded-md border border-[color:var(--uf-border)]"
            >
              <Avatar name={m.displayName} url={m.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {m.displayName}
                  {isMe ? <span className="text-uf-muted font-normal"> (you)</span> : null}
                </p>
                {m.rank ? <p className="text-xs text-uf-muted">{m.rank}</p> : null}
              </div>
              <StatusPill variant={ROLE_PILL[m.role]}>{m.role}</StatusPill>
              {isOwner && !isMe && m.role !== "owner" ? (
                <div className="flex flex-wrap gap-1.5">
                  {m.role === "member" ? (
                    <NeonButton
                      variant="ghost"
                      className="uf-btn--sm"
                      disabled={pending === key}
                      onClick={() =>
                        run(
                          key,
                          () => setRole({ groupId, userId: m.userId, role: "moderator" }),
                          "Promoted to moderator.",
                        )
                      }
                    >
                      <PencilRuler className="h-3.5 w-3.5 mr-1" aria-hidden />
                      Promote
                    </NeonButton>
                  ) : (
                    <NeonButton
                      variant="ghost"
                      className="uf-btn--sm"
                      disabled={pending === key}
                      onClick={() =>
                        run(
                          key,
                          () => setRole({ groupId, userId: m.userId, role: "member" }),
                          "Demoted to member.",
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5 mr-1" aria-hidden />
                      Demote
                    </NeonButton>
                  )}
                  <NeonButton
                    variant="ghost"
                    className="uf-btn--sm"
                    disabled={pending === key}
                    onClick={() =>
                      run(
                        key,
                        () => transfer({ groupId, userId: m.userId }),
                        "Ownership transferred.",
                      )
                    }
                  >
                    <Crown className="h-3.5 w-3.5 mr-1" aria-hidden />
                    Make owner
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    className="uf-btn--sm"
                    disabled={pending === key}
                    onClick={() => {
                      if (!window.confirm(`Remove ${m.displayName} from the group?`)) return;
                      run(
                        key,
                        () => removeMember({ groupId, userId: m.userId }),
                        "Member removed.",
                      );
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden />
                    Remove
                  </NeonButton>
                </div>
              ) : isMod && !isMe && m.role === "member" ? (
                <NeonButton
                  variant="ghost"
                  className="uf-btn--sm"
                  disabled={pending === key}
                  onClick={() => {
                    if (!window.confirm(`Remove ${m.displayName} from the group?`)) return;
                    run(
                      key,
                      () => removeMember({ groupId, userId: m.userId }),
                      "Member removed.",
                    );
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden />
                  Remove
                </NeonButton>
              ) : null}
            </li>
          );
        })}
      </ul>
    </HoloCard>
  );
}
