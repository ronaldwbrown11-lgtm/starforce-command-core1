import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Bell, ExternalLink } from "lucide-react";
import { StatusPill } from "../uf/StatusPill";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

/**
 * Header bell + popover. Reads live from `api.social.listNotifications`
 * (Convex reactive queries). When the user clicks an unread row, we
 * mark-read and toast, then stay on the same page.
 *
 * Accessibility: aria-haspopup="dialog", aria-expanded binds the
 * button, popover is built with role="dialog" + aria-modal + Escape
 * + focus return. Mark-read actions expose aria-busy on the row.
 */
export function HeaderNotifications() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-text hover:bg-[rgba(0,229,255,0.06)]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" aria-hidden />
        <UnreadBadge />
      </button>
      {open ? (
        <PortalAnchor ref={popoverRef}>
          <NotificationsPopover onDismiss={() => setOpen(false)} />
        </PortalAnchor>
      ) : null}
    </div>
  );
}

import { forwardRef, type ReactNode } from "react";

const PortalAnchor = forwardRef<HTMLDivElement, { children: ReactNode }>(
  function PortalAnchor({ children }, ref) {
    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-label="Notifications"
        className="uf-panel popover-enter absolute right-0 mt-2 w-[360px] p-3 z-50"
      >
        {children}
      </div>
    );
  },
);

function UnreadBadge() {
  const unread = useQuery(api.social.unreadNotificationCount, {});
  if (!unread) return null;
  return (
    <span
      aria-label={`${unread} unread`}
      className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold"
      style={{
        background: "var(--uf-red)",
        color: "white",
        boxShadow: "var(--uf-glow-danger)",
      }}
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}

function NotificationsPopover({ onDismiss }: { onDismiss: () => void }) {
  const items = useQuery(api.social.listNotifications, { limit: 10 });
  const mark = useMutation(api.social.markNotificationRead);
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  const unread = (items ?? []).filter((n) => !n.readAt).length;

  // Mark a notification read, then navigate to its target when it has one.
  async function onSelect(n: NonNullable<typeof items>[number]) {
    setPending(n._id);
    try {
      if (!n.readAt) await mark({ id: n._id as Id<"notifications"> });
      if (n.url) {
        onDismiss();
        navigate(n.url);
      }
    } catch {
      toast.error("Couldn't mark as read.");
    } finally {
      setPending(null);
    }
  }

  async function onMarkAll() {
    if (!items) return;
    const unreadIds = items
      .filter((n) => !n.readAt)
      .map((n) => n._id as Id<"notifications">);
    setPending("all");
    try {
      await Promise.all(unreadIds.map((id) => mark({ id }).catch(() => null)));
      toast.success(`${unreadIds.length} marked read.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-uf-cyan uf-eyebrow">Notifications</h2>
        {unread > 0 ? (
          <button
            type="button"
            className="uf-btn uf-btn--ghost"
            aria-busy={pending === "all"}
            onClick={onMarkAll}
          >
            {pending === "all" ? "Marking…" : "Mark all read"}
          </button>
        ) : (
          <StatusPill variant="default">All caught up</StatusPill>
        )}
      </header>
      <div className="text-uf-muted text-xs" aria-live="polite">
        {unread > 0 ? `${unread} unread` : "No new notifications"}
      </div>
      <ul className="flex flex-col gap-1 max-h-80 overflow-auto pr-1 list-none p-0 m-0">
        {items === undefined ? (
          <li>
            <div className="uf-skeleton" style={{ height: 48 }} />
          </li>
        ) : items.length === 0 ? (
          <li className="uf-empty" style={{ padding: 16 }}>No notifications yet.</li>
        ) : (
          items.map((n) => (
            <li key={n._id}>
              <button
                type="button"
                className="uf-card !p-2 w-full text-left flex items-start justify-between gap-2"
                aria-busy={pending === n._id}
                disabled={pending === n._id}
                onClick={() => onSelect(n)}
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm ${n.readAt ? "text-uf-muted" : "text-uf-text"}`}
                  >
                    {n.title}
                  </p>
                  {n.body ? (
                    <p className="text-uf-muted text-xs mt-0.5 line-clamp-2">{n.body}</p>
                  ) : null}
                  <time
                    className="text-uf-muted text-[10px] mt-0.5 inline-block"
                    dateTime={new Date(n.createdAt).toISOString()}
                  >
                    {new Date(n.createdAt).toLocaleString()}
                  </time>
                </div>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  <StatusPill variant={n.readAt ? "default" : "info"}>
                    {n.readAt ? "Read" : "New"}
                  </StatusPill>
                  {n.url ? (
                    <ExternalLink
                      className="h-3 w-3 text-uf-muted"
                      aria-label="Opens linked page"
                    />
                  ) : null}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
      <footer className="pt-1 border-t border-[color:var(--uf-border)] mt-1 flex justify-between">
        <button
          type="button"
          className="uf-btn uf-btn--ghost"
          onClick={onDismiss}
        >
          Close
        </button>
        <Link to="/activity" className="uf-btn" onClick={onDismiss}>
          Open full feed
        </Link>
      </footer>
    </div>
  );
}
