import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Megaphone, Send } from "lucide-react";
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
  const sendBroadcast = useMutation(api.admin.sendBroadcast);
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
      toast.success(`Broadcast delivered to ${res.delivered} member${res.delivered === 1 ? "" : "s"}.`);
      setTitle("");
      setBody("");
    } catch (e) {
      toast.error("Broadcast failed.");
    } finally {
      setBusy(false);
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
                    <StatusPill variant="violet">
                      {audienceLabel(meta?.audience ?? { type: "all" })}
                    </StatusPill>
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
} {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}
