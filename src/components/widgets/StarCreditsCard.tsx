import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Coins, Check, Zap, Award, Sparkles } from "lucide-react";
import { HoloCard, NeonButton } from "@/components/uf";
import {
  FRAME_CATALOG,
  TITLE_CATALOG,
  BOOST_CATALOG,
  weeklySpotlight,
  type FrameId,
  type TitleId,
  type BoostId,
} from "@/lib/economy";
import { toast } from "sonner";

type Tab = "frames" | "titles" | "boosts";

export function StarCreditsCard({
  credits,
  frame,
  frames,
  title,
  titles,
  xpSurgeUntil,
  creditSurgeUntil,
}: {
  credits: number;
  frame?: string | null;
  frames?: string[];
  title?: string | null;
  titles?: string[];
  xpSurgeUntil?: number | null;
  creditSurgeUntil?: number | null;
}) {
  const buyFrame = useMutation(api.economy.purchaseFrame);
  const buyTitle = useMutation(api.economy.purchaseTitle);
  const clearTitle = useMutation(api.economy.clearTitle);
  const activateBoost = useMutation(api.economy.activateBoost);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("frames");

  const spotlight = weeklySpotlight();
  const now = Date.now();
  const xpActive = !!xpSurgeUntil && xpSurgeUntil > now;
  const creditActive = !!creditSurgeUntil && creditSurgeUntil > now;

  async function handleFrame(frameId: string) {
    setBusy(frameId);
    try {
      const res = await buyFrame({ frame: frameId });
      if (res.newlyOwned) {
        toast.success(`Frame acquired — ${FRAME_CATALOG[frameId as FrameId].label} equipped.`);
      } else {
        toast.success(`Equipped ${FRAME_CATALOG[frameId as FrameId].label}.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleTitle(titleId: string) {
    setBusy(titleId);
    try {
      const res = await buyTitle({ title: titleId });
      if (res.newlyOwned) {
        toast.success(`Title acquired — ${TITLE_CATALOG[titleId as TitleId].label} equipped.`);
      } else {
        toast.success(`Equipped ${TITLE_CATALOG[titleId as TitleId].label}.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleClearTitle() {
    setBusy("clear");
    try {
      await clearTitle({});
      toast.success("Title cleared.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't clear title.");
    } finally {
      setBusy(null);
    }
  }

  async function handleBoost(boostId: string) {
    setBusy(boostId);
    try {
      const res = await activateBoost({ boost: boostId });
      const until = new Date(res.activeUntil).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      toast.success(`${BOOST_CATALOG[boostId as BoostId].label} active until ${until}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed.");
    } finally {
      setBusy(null);
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "frames", label: "Frames" },
    { key: "titles", label: "Titles" },
    { key: "boosts", label: "Boosts" },
  ];

  return (
    <HoloCard>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="uf-eyebrow">Star Credits</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--uf-gold)]/60 bg-[rgba(230,168,23,0.08)] px-3 py-1 text-sm font-semibold"
          style={{ color: "var(--uf-gold)" }}
        >
          <Coins className="h-4 w-4" aria-hidden />
          {credits.toLocaleString()}
        </span>
      </div>
      <p className="text-uf-muted text-xs mb-4">
        Earned for published stories, approved lore, certified discoveries,
        mission reports, and comments. Spend them in the Cosmetic Lab below.
      </p>

      {(xpActive || creditActive) && (
        <div className="flex flex-wrap gap-2 mb-4" role="status">
          {xpActive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.08)] px-2.5 py-1 text-xs text-[var(--uf-cyan)]">
              <Zap className="h-3 w-3" aria-hidden /> XP Surge · until{" "}
              {new Date(xpSurgeUntil as number).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
          {creditActive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(230,168,23,0.5)] bg-[rgba(230,168,23,0.08)] px-2.5 py-1 text-xs" style={{ color: "var(--uf-gold)" }}>
              <Zap className="h-3 w-3" aria-hidden /> Credit Surge · until{" "}
              {new Date(creditSurgeUntil as number).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      )}

      {/* Week rotation spotlight */}
      <div className="mb-4 rounded-md border border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.06)] p-3">
        <span className="uf-eyebrow flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> This cycle's spotlight · {spotlight.weekKey}
        </span>
        <p className="text-xs text-uf-muted mt-1.5">
          <strong style={{ color: FRAME_CATALOG[spotlight.frame].colors[0] }}>
            {FRAME_CATALOG[spotlight.frame].label}
          </strong>{" "}
          and{" "}
          <strong style={{ color: TITLE_CATALOG[spotlight.title].color }}>
            {TITLE_CATALOG[spotlight.title].label}
          </strong>{" "}
          are featured. Rotation changes every ISO week for the whole fleet.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex flex-wrap gap-1.5 mb-3 rounded-lg border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.5)] p-1 w-fit"
        role="tablist"
        aria-label="Cosmetic Lab categories"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              tab === t.key
                ? "bg-[rgba(0,229,255,0.12)] text-[var(--uf-cyan)]"
                : "text-uf-muted hover:text-uf-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "frames" && (
        <ul className="list-none p-0 m-0 grid grid-cols-2 gap-3">
          {Object.entries(FRAME_CATALOG).map(([id, spec]) => {
            const owned = (frames ?? []).includes(id);
            const equipped = frame === id;
            const isSpotlight = id === spotlight.frame;
            return (
              <li
                key={id}
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] p-3"
                aria-label={`${spec.label} — ${spec.description}`}
              >
                <div
                  aria-hidden
                  className="h-9 w-9 rounded-full mx-auto"
                  style={{
                    background: `conic-gradient(from 220deg, ${spec.colors[0]}, ${spec.colors[1]}, ${spec.colors[2]}, ${spec.colors[0]})`,
                    boxShadow: `0 0 12px ${spec.colors[0]}66`,
                  }}
                />
                <p className="text-center text-xs font-semibold mt-2" style={{ color: spec.colors[0] }}>
                  {spec.label}
                  {isSpotlight && <Sparkles className="inline h-3 w-3 ml-1 -mt-0.5" aria-label="Spotlight item" />}
                </p>
                <p className="text-center text-[10px] text-uf-muted mt-0.5 leading-snug">
                  {owned ? "Owned" : `${spec.cost.toLocaleString()} credits`}
                </p>
                <div className="mt-2 flex justify-center">
                  {equipped ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: spec.colors[0] }}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden /> Equipped
                    </span>
                  ) : (
                    <NeonButton
                      variant="ghost"
                      className="!px-3 !py-1 !text-xs"
                      loading={busy === id}
                      disabled={!owned && credits < spec.cost}
                      onClick={() => handleFrame(id)}
                    >
                      {owned ? "Equip" : "Buy"}
                    </NeonButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "titles" && (
        <div>
          {title && TITLE_CATALOG[title] && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] px-3 py-2">
              <span className="text-xs text-uf-muted">
                Equipped:{" "}
                <strong style={{ color: TITLE_CATALOG[title].color }}>
                  {TITLE_CATALOG[title].label}
                </strong>
              </span>
              <NeonButton
                variant="ghost"
                className="!px-2.5 !py-1 !text-xs"
                loading={busy === "clear"}
                onClick={handleClearTitle}
              >
                Clear
              </NeonButton>
            </div>
          )}
          <ul className="list-none p-0 m-0 grid gap-3">
            {Object.entries(TITLE_CATALOG).map(([id, spec]) => {
              const owned = (titles ?? []).includes(id);
              const equipped = title === id;
              const missionLine = spec.cost === null;
              const isSpotlight = id === spotlight.title;
              return (
                <li
                  key={id}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] p-3"
                  aria-label={`${spec.label} — ${spec.description}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: spec.color }}>
                        <Award className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {spec.label}
                        {isSpotlight && <Sparkles className="h-3 w-3" aria-label="Spotlight item" />}
                      </p>
                      <p className="text-[11px] text-uf-muted mt-0.5 leading-snug">{spec.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {equipped ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: spec.color }}>
                          <Check className="h-3.5 w-3.5" aria-hidden /> Equipped
                        </span>
                      ) : missionLine && !owned ? (
                        <span className="text-[10px] uppercase tracking-wider text-uf-muted">Command award</span>
                      ) : (
                        <NeonButton
                          variant="ghost"
                          className="!px-3 !py-1 !text-xs"
                          loading={busy === id}
                          disabled={!owned && (missionLine || credits < (spec.cost ?? 0))}
                          onClick={() => handleTitle(id)}
                        >
                          {owned ? "Equip" : `${spec.cost?.toLocaleString()} ★`}
                        </NeonButton>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "boosts" && (
        <ul className="list-none p-0 m-0 grid gap-3">
          {Object.entries(BOOST_CATALOG).map(([id, spec]) => {
            const activeUntil =
              id === "xp_surge" ? xpSurgeUntil : creditSurgeUntil;
            const active = !!activeUntil && activeUntil > now;
            return (
              <li
                key={id}
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] p-3"
                aria-label={`${spec.label} — ${spec.description}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: spec.color }}>
                      <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {spec.label}
                    </p>
                    <p className="text-[11px] text-uf-muted mt-0.5 leading-snug">{spec.description}</p>
                    {active && (
                      <p className="text-[11px] mt-1" style={{ color: spec.color }}>
                        Active until{" "}
                        {new Date(activeUntil as number).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" "}· buying extends
                      </p>
                    )}
                  </div>
                  <NeonButton
                    variant="ghost"
                    className="!px-3 !py-1 !text-xs shrink-0"
                    loading={busy === id}
                    disabled={credits < spec.cost}
                    onClick={() => handleBoost(id)}
                  >
                    {spec.cost.toLocaleString()} ★
                  </NeonButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </HoloCard>
  );
}
