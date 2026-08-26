import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { CalendarClock, MapPin, Radio, Clock } from "lucide-react";

const KIND_VARIANT: Record<
  string,
  "info" | "warning" | "success" | "danger" | "default" | "violet" | "gold" | "cyan"
> = {
  lore_lab: "info",
  faction_meeting: "violet",
  arc: "gold",
  live_qa: "success",
  release: "warning",
  community: "default",
};

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[72px]">
      <span
        className="text-3xl md:text-4xl font-semibold tabular-nums"
        style={{ color: "var(--uf-cyan)", textShadow: "0 0 18px rgba(0,229,255,0.45)" }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-uf-muted">{label}</span>
    </div>
  );
}

function useCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  const diff = target ? Math.max(0, target - now) : 0;
  return useMemo(
    () => ({
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff % 86_400_000) / 3_600_000),
      minutes: Math.floor((diff % 3_600_000) / 60_000),
      seconds: Math.floor((diff % 60_000) / 1000),
    }),
    [diff],
  );
}

export default function Events() {
  const data = useQuery(api.events.listUpcomingEvents, {});
  const next = data?.next ?? null;
  const { days, hours, minutes, seconds } = useCountdown(next?.scheduledAt ?? null);

  usePageMeta({
    title: "Operations Calendar — Star Force 1198",
    description:
      "Lore Lab writing sessions, faction meetings, story arcs, live Q&As, and countdowns for major lore releases.",
  });

  const live = (data?.events ?? []).filter((e) => e.status === "live");
  const upcoming = (data?.events ?? []).filter(
    (e) => e.status !== "live" && e.status !== "ended",
  );
  const ended = (data?.events ?? []).filter((e) => e.status === "ended");

  return (
    <SiteShell>
      <PageHero
        eyebrow="Fleet Operations"
        title="The Operations Calendar"
        lead="Weekly Lore Lab sessions, monthly faction meetings, seasonal story arcs, and live transmissions — with a countdown to the next event."
        secondary={{ label: "Community Hub", href: "/community", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        {next ? (
          <HoloCard className="mb-8 text-center">
            <span className="uf-eyebrow">Next operation</span>
            <h2 className="text-2xl font-semibold mt-2">{next.title}</h2>
            <p className="text-uf-muted text-sm mt-1 max-w-xl mx-auto">
              {new Date(next.scheduledAt).toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <div
              className="flex justify-center gap-4 md:gap-8 mt-6"
              role="timer"
              aria-label={`Time until ${next.title}`}
              aria-live="polite"
            >
              <CountdownUnit value={days} label="Days" />
              <CountdownUnit value={hours} label="Hours" />
              <CountdownUnit value={minutes} label="Minutes" />
              <CountdownUnit value={seconds} label="Seconds" />
            </div>
          </HoloCard>
        ) : null}

        {live.length > 0 ? (
          <div className="mb-8">
            <span className="uf-eyebrow">On air now</span>
            <ul className="mt-3 flex flex-col gap-3 list-none p-0 m-0">
              {live.map((e) => (
                <li key={e._id}>
                  <HoloCard className="!p-4 flex flex-wrap items-center gap-4">
                    <Radio className="h-5 w-5 animate-pulse text-[var(--uf-green)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold">{e.title}</h3>
                      <p className="text-uf-muted text-sm">{e.description}</p>
                    </div>
                    <StatusPill variant="success">Live now</StatusPill>
                    {e.link ? (
                      <a
                        href={e.link}
                        target="_blank"
                        rel="noreferrer"
                        className="uf-pill hover:shadow-[var(--uf-glow-cyan)]"
                      >
                        Join
                      </a>
                    ) : null}
                  </HoloCard>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <span className="uf-eyebrow">Upcoming</span>
        {upcoming.length === 0 && live.length === 0 ? (
          <div className="uf-empty">
            No operations scheduled. The bridge is quiet — check back soon.
          </div>
        ) : (
          <ul className="mt-3 grid gap-4 md:grid-cols-2 list-none p-0 m-0">
            {upcoming.map((e) => (
              <li key={e._id}>
                <HoloCard className="h-full flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <StatusPill variant={KIND_VARIANT[e.kind] ?? "default"}>
                      {e.kindLabel}
                    </StatusPill>
                    <time
                      className="text-xs text-uf-muted tabular-nums"
                      dateTime={new Date(e.scheduledAt).toISOString()}
                    >
                      {new Date(e.scheduledAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-[var(--uf-cyan)]" aria-hidden />
                    {e.title}
                  </h3>
                  <p className="text-uf-muted text-sm flex-1">{e.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-uf-muted mt-1">
                    {e.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden /> {e.location}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {new Date(e.scheduledAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {e.link ? (
                      <a
                        href={e.link}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto uf-pill hover:shadow-[var(--uf-glow-cyan)]"
                      >
                        Details
                      </a>
                    ) : null}
                  </div>
                </HoloCard>
              </li>
            ))}
          </ul>
        )}

        {ended.length > 0 ? (
          <div className="mt-10">
            <span className="uf-eyebrow">Recently completed</span>
            <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
              {ended.slice(0, 4).map((e) => (
                <li
                  key={e._id}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.5)] px-4 py-2.5 text-sm text-uf-muted flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="text-uf-text">{e.title}</span>
                  <span>
                    {new Date(e.scheduledAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <StatusPill variant="default">Ended</StatusPill>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
