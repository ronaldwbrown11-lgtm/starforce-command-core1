import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";

export function MemberSpotlight() {
  const u = useQuery(api.social.memberSpotlight);
  const { user: me } = useAuth();

  if (u === undefined) {
    return (
      <section aria-label="Member spotlight" className="uf-panel p-5">
        <div className="uf-skeleton" style={{ height: 140 }} />
      </section>
    );
  }
  if (u === null) {
    return (
      <section aria-label="Member spotlight" className="uf-panel p-5">
        <div className="uf-empty">No spotlight this week.</div>
      </section>
    );
  }
  const xp = u.xp ?? 0;
  const initials = (u.displayName ?? "?").charAt(0).toUpperCase();
  const isMe = me?._id === u._id;

  return (
    <section
      aria-labelledby="uf-spotlight-heading"
      className="uf-panel p-5"
      data-uf-widget="member-spotlight"
    >
      <header className="flex items-center justify-between mb-3 gap-2">
        <h3 id="uf-spotlight-heading" className="uf-eyebrow">
          {isMe ? "You are on the bridge" : "Bridge spotlight"}
        </h3>
        <StatusPill variant="gold">Commander of the week</StatusPill>
      </header>
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="h-14 w-14 rounded-full flex items-center justify-center font-semibold text-2xl shrink-0"
          style={{
            background:
              "conic-gradient(from 210deg, var(--uf-cyan), var(--uf-violet), var(--uf-magenta), var(--uf-cyan))",
            color: "#001018",
            boxShadow: "0 0 18px rgba(0,229,255,0.35)",
          }}
        >
          <span
            style={{
              background: "var(--uf-void)",
              color: "var(--uf-text)",
              width: 50,
              height: 50,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initials}
          </span>
        </div>
        <div className="min-w-0">
          <h4 className="text-lg font-semibold truncate">{u.displayName}</h4>
          {u.fleet ? (
            <p className="text-uf-muted text-xs">{u.fleet}</p>
          ) : null}
          {u.bio ? (
            <p className="text-sm text-uf-muted mt-2 line-clamp-3">{u.bio}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 mt-2">
            {u.rank ? <StatusPill variant="info">{u.rank}</StatusPill> : null}
            {u.tier ? <StatusPill variant="violet">{u.tier}</StatusPill> : null}
            {isMe ? <StatusPill variant="success">That's you</StatusPill> : null}
          </div>
          <p className="text-xs text-uf-muted mt-2">{xp.toLocaleString()} XP</p>
        </div>
      </div>
    </section>
  );
}
