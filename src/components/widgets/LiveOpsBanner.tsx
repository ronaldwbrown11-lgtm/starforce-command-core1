import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { CalendarClock, Radio } from "lucide-react";
import { countdownLabel, formatStardate, useCountdown } from "@/hooks/use-countdown";
import { NeonButton, StatusPill } from "../uf";

// ---------------------------------------------------------------------------
// Scheduled live ops (#41): polls api.events.listUpcomingEvents and renders a
// countdown banner for the fleet's next operation. Once an op is underway it
// flips to an "OPERATION ACTIVE" state with a countdown to close. Everything
// here is defined by the update method (Convex reactive query + a 1 Hz tick),
// never faked realtime.
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000; // matches events.ts fallback

export function LiveOpsBanner() {
  const data = useQuery(api.events.listUpcomingEvents, { limit: 6 });

  if (data === undefined) {
    return (
      <section aria-label="Loading operation status" className="uf-panel p-4">
        <div className="uf-skeleton" style={{ height: 48 }} />
      </section>
    );
  }

  const now = Date.now();
  const live = data.events.find((e) => {
    if (e.status === "cancelled" || e.status === "ended") return false;
    const end = e.endsAt ?? e.scheduledAt + DEFAULT_WINDOW_MS;
    return e.scheduledAt <= now && now < end;
  });
  const next = !live ? data.next : null;

  if (!live && !next) return null;

  if (live) {
    const endAt = live.endsAt ?? live.scheduledAt + DEFAULT_WINDOW_MS;
    return <OpBannerCard kind="live" event={live} target={endAt} />;
  }
  if (next) {
    return <OpBannerCard kind="next" event={next} target={next.scheduledAt} />;
  }
  return null;
}

function OpBannerCard({
  kind,
  event,
  target,
}: {
  kind: "live" | "next";
  event: {
    _id: string;
    title: string;
    description: string;
    kind: string;
    kindLabel: string;
    scheduledAt: number;
    endsAt?: number | null;
    location?: string | null;
    link?: string | null;
    status: string;
  };
  target: number;
}) {
  const cd = useCountdown(target);
  const active = kind === "live";
  const href = event.link ?? "/events";

  return (
    <section
      aria-label={active ? `Active operation: ${event.title}` : `Next operation: ${event.title}`}
      className={
        "relative overflow-hidden rounded-md border p-4 md:p-5 " +
        (active
          ? "border-[rgba(255,179,0,0.45)] shadow-[0_0_24px_rgba(255,179,0,0.10)]"
          : "border-[rgba(0,229,255,0.30)] shadow-[0_0_24px_rgba(0,229,255,0.08)]")
      }
      style={{
        background: active
          ? "radial-gradient(520px 200px at 12% 0%, rgba(255,179,0,0.14), transparent 65%), linear-gradient(160deg, rgba(16,24,39,0.6), rgba(5,8,22,0.35))"
          : "radial-gradient(520px 200px at 12% 0%, rgba(0,229,255,0.12), transparent 65%), linear-gradient(160deg, rgba(16,24,39,0.6), rgba(5,8,22,0.35))",
      }}
    >
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={
              "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md " +
              (active ? "bg-[rgba(255,179,0,0.15)]" : "bg-[rgba(0,229,255,0.12)]")
            }
          >
            {active ? (
              <Radio
                className="h-4 w-4 text-uf-gold"
                style={{ color: "var(--uf-gold)" }}
                aria-hidden
              />
            ) : (
              <CalendarClock className="h-4 w-4 text-uf-cyan" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill variant={active ? "gold" : "info"}>
                {active ? "Operation active" : "Next operation"}
              </StatusPill>
              <StatusPill variant="default">{event.kindLabel}</StatusPill>
              <span className="text-uf-muted text-xs hidden sm:inline">
                {event.location ?? "Command network"}
              </span>
            </div>
            <h3 className="text-lg font-semibold mt-1.5 truncate">{event.title}</h3>
            <p className="text-uf-muted text-sm mt-0.5 line-clamp-2 max-w-[62ch]">
              {event.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <span
              className={
                "text-[10px] uppercase tracking-[0.16em] " +
                (active ? "text-[color:var(--uf-gold)]" : "text-uf-cyan")
              }
            >
              {active
                ? cd.expired
                  ? "Underway now"
                  : "Closes in"
                : cd.expired
                  ? "Launching"
                  : "Starts in"}
            </span>
            {cd.expired && !active ? (
              <p className="font-mono text-lg font-semibold mt-0.5 text-uf-cyan">
                T-minus zero
              </p>
            ) : cd.expired ? (
              <p className="font-mono text-lg font-semibold mt-0.5 text-uf-text">
                {formatStardate(event.scheduledAt)}
              </p>
            ) : (
              <p
                className="font-mono text-lg font-semibold mt-0.5 tabular-nums"
                aria-label={`${active ? "Closes" : "Starts"} in ${countdownLabel(cd)}`}
                style={{ color: active ? "var(--uf-gold)" : "var(--uf-cyan)" }}
              >
                {countdownLabel(cd)}
              </p>
            )}
            <p className="text-uf-muted text-[10px] mt-0.5">
              {formatStardate(event.scheduledAt)}
            </p>
          </div>
          <Link to={href}>
            <NeonButton variant={active ? "gold" : "primary"}>
              {active ? "Join operation" : "Open calendar"}
            </NeonButton>
          </Link>
        </div>
      </div>
    </section>
  );
}
