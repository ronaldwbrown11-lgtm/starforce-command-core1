import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Megaphone, Send, Webhook } from "lucide-react";
import { TIER_ORDER, tierLabel, tierPillVariant } from "@/lib/tiers";

const OP_ROLES = [
  { value: "operator", label: "Operator" },
  { value: "senior_operator", label: "Senior Operator" },
  { value: "story_editor", label: "Story Editor" },
  { value: "lore_archivist", label: "Lore Archivist" },
  { value: "community_moderator", label: "Community Mod" },
] as const;

type Audience =
  | { type: "all" }
  | { type: "tier"; tier: (typeof TIER_ORDER)[number] }
  | { type: "opRole"; opRole: (typeof OP_ROLES)[number]["value"] };

export default function OperatorBroadcasts() {
  const history = useQuery(api.admin.listBroadcastHistory, { limit: 25 });
  const bridge = useQuery(api.discordBridge.bridgeStatus);
  const sendBroadcast = useMutation(api.admin.sendBroadcast);
  const testBridge = useAction(api.discordBridgeActions.testBridgeConnection);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "tier" | "opRole">(
    "all",
  );
  const [audienceTier, setAudienceTier] = useState<
    (typeof TIER_ORDER)[number]
  >("free");
  const [audienceRole, setAudienceRole] = useState<
    (typeof OP_ROLES)[number]["value"]
  >("operator");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const audience: Audience =
    audienceType === "all"
      ? { type: "all" }
      : audienceType === "tier"
        ? { type: "tier", tier: audienceTier }
        : { type: "opRole", opRole: audienceRole };

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    if (!window.confirm(
      `Send broadcast to ${audienceLabel(audience)}? This is delivered immediately as ${audienceLabel(audience)}.`,
    )) {
      return;
    }
    setBusy(true);
    try {
      const res = await sendBroadcast({ title, body, audience });
      toast.success(
        `Broadcast delivered to ${res.delivered} member${res.delivered === 1 ? "" : "s"}. Discord mirror status appears in the history row below.`,
        { duration: 6000 },
      );
      setTitle("");
      setBody("");
    } catch (e) {
      toast.error("Broadcast failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTestBridge() {
    setTesting(true);
    try {
      const res = await testBridge();
      if (res.posted) {
        toast.success("Test transmission posted — check the Discord announcements channel.");
      } else {
        toast.error(`Discord mirror is off: ${res.reason ?? "unknown"}`);
      }
    } catch {
      toast.error("Test failed — check the bridge setup below.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-uf-cyan" aria-hidden />
          Broadcast Comms
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Send an announcement to every member, a single tier, or a single
          operator role. Each message lands as a <code>broadcast</code>{" "}
          notification immediately.
        </p>
      </header>

      <section aria-labelledby="bridge-status" className="mb-8">
        <HoloCard>
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="bridge-status"
              className="flex items-center gap-2 text-xl font-semibold"
            >
              <Webhook className="h-5 w-5 text-uf-cyan" aria-hidden />
              Discord presence bridge
            </h2>
            {bridge === undefined ? (
              <StatusPill variant="default">Checking…</StatusPill>
            ) : bridge.configured ? (
              <StatusPill variant="success">Online — mirroring to Discord</StatusPill>
            ) : (
              <StatusPill variant="gold">Not configured</StatusPill>
            )}
          </header>

          {bridge?.configured ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm text-uf-muted">
                Every broadcast is mirrored to the announcements channel via the
                configured webhook. Each history row below reports whether the
                mirror landed.
              </p>
              <NeonButton
                variant="primary"
                loading={testing}
                disabled={testing}
                onClick={handleTestBridge}
                className="shrink-0"
              >
                <Send className="h-4 w-4" aria-hidden />
                Test transmission
              </NeonButton>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="text-sm text-uf-muted">
                  <span className="font-medium text-uf-text">What this is:</span>{" "}
                  announcements posted here are mirrored to a Discord channel as
                  a webhook embed — no bot, no self-hosted process, nothing to
                  keep online. It is a one-time setup.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <NeonButton
                    variant="default"
                    loading={testing}
                    disabled={testing}
                    onClick={handleTestBridge}
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Test after configuring
                  </NeonButton>
                </div>
              </div>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {[
                  [
                    "Create the webhook",
                    "On Discord, open your server → Server Settings → Integrations → Webhooks → New Webhook. Pick the announcements channel and copy the Webhook URL.",
                  ],
                  [
                    "Store it as DISCORD_WEBHOOK_URL",
                    "Paste the URL into the project's Keys/API keys tab as DISCORD_WEBHOOK_URL (server-side env var, never in the client bundle).",
                  ],
                  [
                    "Verify",
                    "Return here and press “Test after configuring” — a test transmission posts to the channel when the URL is live.",
                  ],
                ].map(([step, copy], i) => (
                  <li
                    key={step}
                    className="flex gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                  >
                    <span
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[rgba(0,229,255,0.12)] text-xs font-bold text-uf-cyan"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm">
                      <span className="font-semibold">{step}.</span>{" "}
                      <span className="text-uf-muted">{copy}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </HoloCard>
      </section>

      <section aria-labelledby="broadcast-compose" className="mb-8">
        <header className="mb-3">
          <h2 id="broadcast-compose" className="text-xl font-semibold">
            Compose
          </h2>
        </header>
        <HoloCard>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="b-title"
                className="text-xs uppercase tracking-[0.16em] text-uf-muted"
              >
                Title
              </label>
              <input
                id="b-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mission Brief · Sol system-Gemini"
                className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                maxLength={120}
              />
            </div>
            <div>
              <span className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                Audience targeting
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`uf-btn ${audienceType === "all" ? "uf-btn--primary" : ""}`}
                  onClick={() => setAudienceType("all")}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  className={`uf-btn ${audienceType === "tier" ? "uf-btn--primary" : ""}`}
                  onClick={() => setAudienceType("tier")}
                >
                  One tier
                </button>
                <button
                  type="button"
                  className={`uf-btn ${audienceType === "opRole" ? "uf-btn--primary" : ""}`}
                  onClick={() => setAudienceType("opRole")}
                >
                  One operator role
                </button>
              </div>
              {audienceType === "tier" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {TIER_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`uf-btn ${audienceTier === id ? "uf-btn--violet" : ""}`}
                      onClick={() => setAudienceTier(id)}
                    >
                      <StatusPill variant={tierPillVariant(id)}>
                        {tierLabel(id)}
                      </StatusPill>
                    </button>
                  ))}
                </div>
              ) : null}
              {audienceType === "opRole" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {OP_ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className={`uf-btn ${audienceRole === r.value ? "uf-btn--violet" : ""}`}
                      onClick={() => setAudienceRole(r.value)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="b-body"
              className="text-xs uppercase tracking-[0.16em] text-uf-muted"
            >
              Body
            </label>
            <textarea
              id="b-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Brief, single-paragraph message. Keep under 700 characters."
              rows={4}
              className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] font-mono"
              maxLength={700}
            />
            <p className="text-uf-muted text-xs mt-1" aria-live="polite">
              {body.length} / 700 characters
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <NeonButton
              variant="primary"
              loading={busy}
              disabled={busy || !title.trim() || !body.trim()}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" aria-hidden />
              Send broadcast
            </NeonButton>
            <StatusPill variant="gold">
              Target: {audienceLabel(audience)}
            </StatusPill>
          </div>
        </HoloCard>
      </section>

      <section aria-labelledby="broadcast-history">
        <header className="mb-3">
          <h2 id="broadcast-history" className="text-xl font-semibold">
            History
          </h2>
        </header>
        {history === undefined ? (
          <div className="uf-skeleton" style={{ height: 200 }} />
        ) : history.length === 0 ? (
          <p className="uf-empty">No broadcasts sent yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {history.map((row) => {
              const meta = parseMeta(row.meta);
              return (
                <li
                  key={row._id}
                  className="border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold truncate">
                        {meta?.title ?? "Untitled broadcast"}
                      </p>
                      <p className="text-uf-muted text-xs">
                        {new Date(row.createdAt).toLocaleString()} ·{" "}
                        {meta?.count ?? 0} delivered
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {meta?.discordMirrored ? (
                        <StatusPill variant="success">Mirrored to Discord</StatusPill>
                      ) : null}
                      {meta?.discordMirrorReason ? (
                        <span
                          className="text-xs text-uf-muted"
                          title={meta.discordMirrorReason}
                        >
                          Mirror skipped
                        </span>
                      ) : null}
                      <StatusPill variant="violet">
                        {audienceLabel(meta?.audience ?? { type: "all" })}
                      </StatusPill>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </OperatorShell>
  );
}

function audienceLabel(a: Audience): string {
  if (a.type === "all") return "Everyone";
  if (a.type === "tier") return `Tier · ${a.tier}`;
  if (a.type === "opRole") return `Role · ${a.opRole.replace("_", " ")}`;
  return "Unknown";
}

function parseMeta(meta?: string): null | {
  title?: string;
  count?: number;
  audience?: Audience;
  discordMirrored?: boolean;
  discordMirrorReason?: string;
} {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}
