import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useSearchParams } from "react-router";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { FleetAffiliation } from "@/components/widgets/FleetAffiliation";
import { useAuth } from "@/hooks/use-auth";

import { usePageMeta } from "@/hooks/use-page-meta";
type ThreadRow = {
  threadId: string;
  otherUser: null | {
    _id: string;
    displayName?: string;
    rank?: string;
    tier?: string;
    fleet?: string;
    avatarUrl?: string;
  };
  updatedAt: number;
  lastReadAt: number | null;
  unread: boolean;
  lastMessage: null | {
    _id: string;
    body: string;
    createdAt: number;
    senderId: string;
  };
};

type MessageRow = {
  _id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: number;
};

export default function Messages() {
  const { isAuthenticated, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const activeThreadId = params.get("thread") as string | null;
  const recipientHint = params.get("recipient") as string | null;
  const [draft, setDraft] = useState("");
  const threads = useQuery(api.messages.listMyThreads);
  const threadMsgs = useQuery(
    api.messages.messagesInThread,
    activeThreadId
      ? ({ threadId: activeThreadId as any } as any)
      : ("skip" as const),
  );
  const send = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markThreadRead);
  const heart = useMutation(api.social.heartbeat);

  useEffect(() => {
    if (isAuthenticated) heart({});
  }, [isAuthenticated, heart]);

  // Mark active thread as read whenever new messages arrive.
  useEffect(() => {
    if (!activeThreadId || !threadMsgs || !threadMsgs.length) return;
    markRead({ threadId: activeThreadId as any });
  }, [activeThreadId, threadMsgs, markRead]);

  // Auto-create a thread when arriving with ?recipient=X
  useEffect(() => {
    if (!recipientHint || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const { threadId } = await send({
          body: "— opened a channel —",
          recipientId: recipientHint as any,
        });
        if (cancelled) return;
        setParams({ thread: threadId as string }, { replace: true });
      } catch {
        // Ignore — UI shows auth prompt.
      }
    })();
  usePageMeta({ title: "Comms Channel — Star Force Base 1198", description: "Secure messaging between fleet personnel.", noindex: false });

    return () => {
      cancelled = true;
    };
  }, [recipientHint, isAuthenticated, send, setParams]);

  const active: ThreadRow | null = useMemo(() => {
    if (!threads) return null;
    return (threads as ThreadRow[]).find((t) => t.threadId === activeThreadId) ?? null;
  }, [threads, activeThreadId]);

  // Auto-scroll to bottom on new messages.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [threadMsgs?.length]);

  if (!isAuthenticated) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Inbox"
          title="Private channels."
          lead="Sign in to send and receive operator-to-operator transmissions."
          primary={{ label: "Sign in", href: "/auth", variant: "primary" }}
          secondary={{ label: "Browse directory", href: "/members", variant: "ghost" }}
        />
      </SiteShell>
    );
  }

  async function transmit() {
    if (!draft.trim()) return;
    if (!activeThreadId) return;
    try {
      await send({ body: draft, threadId: activeThreadId as any });
      setDraft("");
    } catch {
      // Mutation errors surfaced via Convex's error UI; ignore here.
    }
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow="Inbox"
        title="Private channels."
        lead="Two-pane comms. Threads update live. Continue on your own time."
        primary={{ label: "Browse directory", href: "/members", variant: "primary" }}
        secondary={{ label: "Open activity", href: "/activity", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <ThreadsSidebar
            threads={(threads as ThreadRow[] | undefined) ?? null}
            activeThreadId={activeThreadId}
            onPick={(id) => setParams({ thread: id })}
          />
          <ChatPane
            active={active}
            messages={(threadMsgs as MessageRow[] | undefined) ?? null}
            draft={draft}
            setDraft={setDraft}
            onSend={transmit}
            meId={(user as any)?._id ?? null}
          />
        </div>
      </section>
    </SiteShell>
  );
}

function ThreadsSidebar({
  threads,
  activeThreadId,
  onPick,
}: {
  threads: ThreadRow[] | null;
  activeThreadId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <aside
      className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] overflow-hidden"
      aria-label="Conversations"
    >
      <header className="px-4 py-3 flex items-center justify-between border-b border-[color:var(--uf-border)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">
          Conversations
        </h2>
        <Link to="/members" className="text-uf-cyan text-xs underline">
          + Start
        </Link>
      </header>
      <ul className="list-none p-0 m-0 divide-y divide-[color:var(--uf-border)] max-h-[70vh] overflow-y-auto">
        {threads === null ? (
          <li className="p-4">
            <div className="uf-skeleton" style={{ height: 64 }} />
          </li>
        ) : threads.length === 0 ? (
          <li className="p-4 text-uf-muted text-sm">
            No conversations yet. Open a member's profile and tap "Send
            comms".
          </li>
        ) : (
          threads.map((t) => (
            <li key={t.threadId}>
              <button
                type="button"
                onClick={() => onPick(t.threadId)}
                aria-current={
                  t.threadId === activeThreadId ? "true" : undefined
                }
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[rgba(0,229,255,0.06)] focus:outline-none focus:bg-[rgba(0,229,255,0.08)]"
                style={
                  t.unread
                    ? {
                        boxShadow: "inset 2px 0 0 var(--uf-cyan)",
                      }
                    : undefined
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">
                      {t.otherUser?.displayName ?? "(unknown)"}
                    </span>
                    {t.unread ? (
                      <StatusPill variant="cyan">New</StatusPill>
                    ) : null}
                  </div>
                  <p className="text-uf-muted text-xs truncate mt-1">
                    {t.lastMessage?.body ?? "—"}
                  </p>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

function ChatPane({
  active,
  messages,
  draft,
  setDraft,
  onSend,
  meId,
}: {
  active: ThreadRow | null;
  messages: MessageRow[] | null;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  meId: string | null;
}) {
  const ariaLabel = active?.otherUser?.displayName
    ? `Conversation with ${active.otherUser.displayName}`
    : "Conversation";
  return (
    <section
      aria-label={ariaLabel}
      className="flex flex-col rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] min-h-[60vh] overflow-hidden"
    >
      {!active ? (
        <div className="flex-1 grid place-items-center p-8 text-uf-muted text-sm">
          Select a conversation to read. New messages land here in real time.
        </div>
      ) : (
        <>
          <header className="px-4 py-3 border-b border-[color:var(--uf-border)] flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">
                {active.otherUser?.displayName ?? "(unknown operator)"}
              </h2>
              <div className="flex flex-wrap gap-2 mt-1">
                {active.otherUser?.rank ? (
                  <StatusPill variant="info">{active.otherUser.rank}</StatusPill>
                ) : null}
                {active.otherUser?.tier ? (
                  <StatusPill variant="violet">
                    {active.otherUser.tier}
                  </StatusPill>
                ) : null}
                {active.otherUser?.fleet ? (
                  <FleetAffiliation fleet={active.otherUser.fleet} compact />
                ) : null}
              </div>
            </div>
            {active.otherUser?._id ? (
              <Link to={`/u/${active.otherUser._id}`} className="ml-auto">
                <NeonButton variant="ghost">View dossier</NeonButton>
              </Link>
            ) : null}
          </header>
          <ChatTranscript
            messages={messages}
            meId={meId}
          />
          <form
            className="border-t border-[color:var(--uf-border)] p-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Open a channel…"
              aria-label="Message body"
              className="flex-1 border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
            <NeonButton
              type="submit"
              variant="primary"
              disabled={!draft.trim()}
            >
              Transmit
            </NeonButton>
          </form>
        </>
      )}
    </section>
  );
}

function ChatTranscript({
  messages,
  meId,
}: {
  messages: MessageRow[] | null;
  meId: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages?.length]);
  const ordered: MessageRow[] = useMemo(
    () => (messages ? [...messages].reverse() : []),
    [messages],
  );
  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      aria-busy={messages === null}
      aria-label="Message transcript"
      className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0"
    >
      {messages === null ? (
        <div className="uf-skeleton" style={{ height: 96 }} />
      ) : ordered.length === 0 ? (
        <p className="text-uf-muted text-sm">
          No transmissions yet. Send the first one.
        </p>
      ) : (
        ordered.map((m) => {
          const mine = meId !== null && m.senderId === meId;
          const placeholder = m.body === "— opened a channel —";
          if (placeholder) return null;
          return (
            <div
              key={m._id}
              className={
                "max-w-[75%] rounded-md px-3 py-2 text-sm border " +
                (mine
                  ? "self-end bg-[rgba(0,229,255,0.10)] border-[color:var(--uf-border)]"
                  : "bg-[rgba(16,24,39,0.6)] border-[color:var(--uf-border)]")
              }
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <time
                className="block text-[10px] text-uf-muted mt-1"
                dateTime={new Date(m.createdAt).toISOString()}
              >
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          );
        })
      )}
    </div>
  );
}
