import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";
import { NeonButton } from "../uf/NeonButton";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function NotificationsPanel({
  limit = 8,
  showMarkAll = true,
}: {
  limit?: number;
  showMarkAll?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const items = useQuery(api.social.listNotifications, { limit });
  const mark = useMutation(api.social.markNotificationRead);
  const [busy, setBusy] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <section
        aria-labelledby="uf-notifications-heading"
        className="uf-panel p-5"
        data-uf-widget="notifications-panel"
      >
        <header className="flex items-center justify-between mb-3">
          <h3 id="uf-notifications-heading" className="uf-eyebrow">Notifications</h3>
          <StatusPill variant="default">Sign in</StatusPill>
        </header>
        <p className="text-uf-muted text-sm">
          Sign in to see new transmissions and story approvals.
        </p>
      </section>
    );
  }

  const unread = items?.filter((n) => !n.readAt).length ?? 0;

  async function markOne(id: string) {
    setBusy(id);
    try {
      await mark({ id: id as any });
    } catch {
      toast.error("Couldn't mark as read.");
    } finally {
      setBusy(null);
    }
  }
  async function markAll() {
    if (!items) return;
    const unreadIds = items.filter((n) => !n.readAt).map((n) => n._id);
    setBusy("all");
    try {
      await Promise.all(unreadIds.map((id) => mark({ id: id as any }).catch(() => null)));
      toast.success(`${unreadIds.length} marked read.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="uf-notifications-heading"
      className="uf-panel p-5"
      data-uf-widget="notifications-panel"
    >
      <header className="flex items-center justify-between mb-3 gap-2">
        <h3 id="uf-notifications-heading" className="uf-eyebrow">Notifications</h3>
        <StatusPill variant={unread > 0 ? "info" : "default"} aria-live="polite">
          {unread > 0 ? `${unread} unread` : "All read"}
        </StatusPill>
      </header>

      {items === undefined ? (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <div className="uf-skeleton" style={{ height: 50 }} />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="uf-empty">No new transmissions.</p>
      ) : (
        <>
          {showMarkAll && unread > 0 ? (
            <div className="mb-3 flex justify-end">
              <NeonButton
                variant="ghost"
                onClick={markAll}
                loading={busy === "all"}
                aria-label={`Mark ${unread} notifications as read`}
              >
                Mark all read
              </NeonButton>
            </div>
          ) : null}
          <ul className="flex flex-col gap-2 list-none p-0 m-0" role="list">
            {items.slice(0, limit).map((n) => {
              const isUnread = !n.readAt;
              return (
                <li key={n._id}>
                  <button
                    type="button"
                    className="uf-card !p-3 w-full text-left flex items-start justify-between gap-2"
                    onClick={() => isUnread && markOne(n._id)}
                    aria-busy={busy === n._id}
                    disabled={busy === n._id}
                    aria-pressed={!isUnread}
                    aria-label={`${isUnread ? "Mark as read: " : ""}${n.title}${n.body ? ". " + n.body : ""}`}
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${isUnread ? "text-uf-text" : "text-uf-muted"}`}
                      >
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="text-uf-muted text-xs mt-1">{n.body}</p>
                      ) : null}
                      <time
                        className="text-uf-muted text-xs"
                        dateTime={new Date(n.createdAt).toISOString()}
                      >
                        {new Date(n.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <StatusPill variant={isUnread ? "info" : "default"}>
                      {isUnread ? "New" : "Read"}
                    </StatusPill>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
