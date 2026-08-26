import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Link } from "react-router";

type TicketRow = (typeof api.support.listTickets)["_returnType"][number];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "responded", label: "Responded" },
  { id: "closed", label: "Closed" },
] as const;

const STATUS_VARIANT: Record<string, "warning" | "info" | "default"> = {
  open: "warning",
  responded: "info",
  closed: "default",
};

function fmt(ts: number) {
  return new Date(ts).toLocaleString();
}

export default function OperatorSupport() {
  const tickets = useQuery(api.support.listTickets, { limit: 100 });
  const respond = useMutation(api.support.respondToTicket);
  const setStatus = useMutation(api.support.setTicketStatus);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [expandedId, setExpandedId] = useState<Id<"supportTickets"> | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets?.length ?? 0 };
    for (const t of tickets ?? []) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c;
  }, [tickets]);

  const visible = (tickets ?? []).filter(
    (t) => filter === "all" || t.status === filter,
  );

  async function handleRespond(t: TicketRow) {
    const body = draft.trim();
    if (!body) {
      toast.error("Write a reply first.");
      return;
    }
    setBusy(`reply:${t._id}`);
    try {
      await respond({ ticketId: t._id as Id<"supportTickets">, body });
      setDraft("");
      toast.success("Reply sent — submitter notified.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reply failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleStatus(t: TicketRow, status: string) {
    setBusy(`status:${t._id}`);
    try {
      await setStatus({
        ticketId: t._id as Id<"supportTickets">,
        status,
      });
      toast.success(`Ticket marked ${status}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator console</span>
        <h1 className="text-3xl font-semibold mt-2">Support Inbox</h1>
        <p className="text-uf-muted text-sm mt-2 max-w-2xl">
          Tickets filed from /support. Reply to move a ticket to responded and
          notify the submitter; close when resolved.
        </p>
      </header>

      {/* Status filter tabs */}
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="tablist"
        aria-label="Filter tickets by status"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={
                active
                  ? "uf-btn uf-btn--primary"
                  : "uf-btn uf-btn--ghost"
              }
            >
              {f.label}
              <span className="ml-1.5 opacity-80">({counts[f.id] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      {tickets === undefined ? (
        <HoloCard>
          <div className="uf-skeleton" style={{ height: 64 }} />
          <div className="uf-skeleton mt-3" style={{ height: 64 }} />
        </HoloCard>
      ) : visible.length === 0 ? (
        <HoloCard>
          <p className="uf-empty" style={{ padding: 24 }}>
            No {filter === "all" ? "" : filter} tickets.
          </p>
        </HoloCard>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((t) => {
            const isOpen = expandedId === t._id;
            return (
              <HoloCard key={String(t._id)} className="!p-0">
                <button
                  type="button"
                  className="w-full text-left px-5 py-4 flex flex-wrap items-center gap-3"
                  onClick={() => setExpandedId(isOpen ? null : (t._id as Id<"supportTickets">))}
                  aria-expanded={isOpen}
                >
                  <StatusPill variant={STATUS_VARIANT[t.status] ?? "default"}>
                    {t.status}
                  </StatusPill>
                  <span className="font-semibold">{t.topic}</span>
                  <span className="text-uf-muted text-xs truncate flex-1 min-w-0">
                    {t.email}
                    {t.userId ? " · member" : " · guest"}
                  </span>
                  <span className="text-uf-muted text-xs shrink-0">
                    {fmt(t.createdAt)}
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-[color:var(--uf-border)] px-5 py-4 space-y-4">
                    {/* Original message */}
                    <div className="text-sm">
                      <p className="text-uf-muted text-xs uppercase tracking-[0.16em] mb-1">
                        Original message
                      </p>
                      <p className="whitespace-pre-wrap">{t.message}</p>
                    </div>

                    {/* Conversation replies */}
                    {t.replies.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-uf-muted text-xs uppercase tracking-[0.16em]">
                          Conversation ({t.replies.length})
                        </p>
                        {t.replies.map((r, i) => (
                          <div
                            key={i}
                            className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] p-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-uf-cyan text-xs font-semibold">
                                {r.by}
                              </span>
                              <span className="text-uf-muted text-[10px]">
                                {fmt(r.at)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{r.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-uf-muted text-xs">
                        No replies yet — be the first to respond.
                      </p>
                    )}

                    {/* Reply box */}
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Type your reply…"
                        rows={3}
                        className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <NeonButton
                          type="button"
                          variant="primary"
                          loading={busy === `reply:${t._id}`}
                          onClick={() => handleRespond(t)}
                        >
                          Send reply
                        </NeonButton>
                        {t.status !== "closed" ? (
                          <NeonButton
                            type="button"
                            variant="ghost"
                            loading={busy === `status:${t._id}`}
                            onClick={() => handleStatus(t, "closed")}
                          >
                            Mark closed
                          </NeonButton>
                        ) : (
                          <NeonButton
                            type="button"
                            variant="ghost"
                            loading={busy === `status:${t._id}`}
                            onClick={() => handleStatus(t, "open")}
                          >
                            Reopen
                          </NeonButton>
                        )}
                        {t.userId ? (
                          <Link
                            to={`/operator/users/${t.userId}`}
                            className="uf-btn uf-btn--ghost"
                          >
                            View user
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </HoloCard>
            );
          })}
        </div>
      )}
    </OperatorShell>
  );
}
