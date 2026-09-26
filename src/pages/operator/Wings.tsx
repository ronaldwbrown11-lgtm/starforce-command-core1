import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Check, Copy, Feather, Search, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Operator → Wings. Issue single-use claim tokens when a member genuinely
// earns their wings. The token is minted here, stored in the site's own
// wingClaims table, and handed to the member as a /wings?claim=<token>
// ceremony link. The Fleet Registry verifies the token and holds the
// PERMANENT member→fighter assignment — this console only writes to our side.
// ---------------------------------------------------------------------------

type UserDoc = {
  _id: string;
  displayName?: string;
  name?: string;
  email?: string;
};

function ceremonyLink(token: string): string {
  return `${window.location.origin}/wings?claim=${encodeURIComponent(token)}`;
}

export default function OperatorWings() {
  const users = useQuery(api.operator.listUsersForOperator, { limit: 60 }) ?? [];
  const claims = useQuery(api.wings.listClaims, {}) ?? [];
  const issueWings = useMutation(api.wings.issueWings);

  // ---- issue form state ----------------------------------------------------
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [lockedUser, setLockedUser] = useState<UserDoc | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const q = search.trim().toLowerCase();
  const matches = q
    ? users.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(q) ||
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q),
      )
    : [];

  function pick(u: UserDoc) {
    setLockedUser(u);
    setMemberId(u._id);
    setMemberName(u.displayName ?? u.name ?? "");
    setSearch("");
  }

  function clearPick() {
    setLockedUser(null);
    setMemberId("");
    setMemberName("");
  }

  async function issue() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await issueWings({
        memberId,
        memberName,
        reason: reason.trim() || undefined,
      });
      const link = ceremonyLink(res.token);
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success(
        `Wings issued to ${res.token ? memberName : "member"} — ceremony link copied.`,
      );
      setLastIssued({ link, memberName });
      clearPick();
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issuance failed.");
    } finally {
      setBusy(false);
    }
  }

  const [lastIssued, setLastIssued] = useState<{ link: string; memberName: string } | null>(null);

  const canIssue =
    memberId.trim().length > 0 &&
    memberId.trim().length <= 64 &&
    memberName.trim().length > 0 &&
    memberName.trim().length <= 80;

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Wings</h1>
        <p className="text-uf-muted text-sm mt-1">
          Award the wings: issue a single-use claim token that opens the
          choose-your-fighter ceremony. The choice the member makes is permanent
          on the Fleet Registry — issue deliberately.
        </p>
      </header>

      {lastIssued ? (
        <HoloCard className="p-5 mb-6 border-[rgba(255,204,0,0.4)]" glow>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold flex items-center gap-2">
                <Feather className="h-4 w-4 text-[#ffcc00]" />
                Wings issued to {lastIssued.memberName}
              </h2>
              <p className="text-sm text-uf-muted mt-1">
                Ceremony link (copied to clipboard, valid 24h, single-use):
              </p>
              <p className="mt-2 font-mono text-xs break-all text-uf-text select-all">
                {lastIssued.link}
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <NeonButton
                variant="ghost"
                iconLeft={<Copy className="h-4 w-4" />}
                onClick={() => {
                  navigator.clipboard.writeText(lastIssued.link);
                  toast.success("Link copied.");
                }}
              >
                Copy
              </NeonButton>
              <NeonButton variant="ghost" iconLeft={<X className="h-4 w-4" />} onClick={() => setLastIssued(null)}>
                Dismiss
              </NeonButton>
            </div>
          </div>
        </HoloCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Issue form ---- */}
        <HoloCard className="p-6">
          <h2 className="uf-eyebrow">Issue wings</h2>

          {lockedUser ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[color:var(--uf-border)] px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {lockedUser.displayName ?? lockedUser.name ?? "Unnamed member"}
                </p>
                <p className="text-xs text-uf-muted truncate">
                  {lockedUser.email ?? lockedUser._id}
                </p>
              </div>
              <StatusPill variant="success">
                <Check className="h-3 w-3" /> locked
              </StatusPill>
              <NeonButton variant="ghost" onClick={clearPick}>
                Change
              </NeonButton>
            </div>
          ) : (
            <div className="mt-4">
              <label className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                Find member
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-uf-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by display name or email…"
                  className="uf-input w-full pl-9"
                />
              </div>
              {q && matches.length > 0 ? (
                <ul className="mt-2 rounded-md border border-[color:var(--uf-border)] divide-y divide-[color:var(--uf-border)] max-h-56 overflow-y-auto">
                  {matches.slice(0, 10).map((u) => (
                    <li key={u._id}>
                      <button
                        type="button"
                        onClick={() => pick(u)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[rgba(0,229,255,0.06)] cursor-pointer"
                      >
                        <span className="text-sm font-medium">
                          {u.displayName ?? u.name ?? "Unnamed member"}
                        </span>
                        {u.email ? (
                          <span className="block text-xs text-uf-muted">{u.email}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {!lockedUser ? (
            <>
              <label className="text-xs uppercase tracking-[0.16em] text-uf-muted mt-5 block">
                Or enter manually
              </label>
              <input
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="Member id (max 64 chars)"
                maxLength={64}
                className="uf-input w-full mt-1"
              />
              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Member name (max 80 chars)"
                maxLength={80}
                className="uf-input w-full mt-2"
              />
            </>
          ) : null}

          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted mt-5 block">
            Reason (shown at the ceremony)
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Won the Operation Nightspur lore contest"
            maxLength={200}
            className="uf-input w-full mt-1"
          />

          <div className="mt-6">
            <NeonButton
              variant="gold"
              onClick={issue}
              disabled={!canIssue}
              loading={busy}
              iconLeft={<Feather className="h-4 w-4" />}
            >
              Issue wings
            </NeonButton>
            <p className="text-xs text-uf-muted mt-2">
              Minting a token does not consume eligibility — the member chooses
              (permanently) when they open their link.
            </p>
          </div>
        </HoloCard>

        {/* ---- Ledger ---- */}
        <HoloCard className="p-6">
          <h2 className="uf-eyebrow">Recent issuances</h2>
          {claims.length === 0 ? (
            <p className="text-sm text-uf-muted mt-4">
              No wings issued yet. Tokens appear here the moment they are minted.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[color:var(--uf-border)]">
              {claims.map((c) => (
                <li key={c._id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.memberName}</p>
                    <p className="text-xs text-uf-muted truncate">
                      {c.reason || "No reason recorded"} ·{" "}
                      {new Date(c.issuedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {c.consumed ? (
                      <StatusPill variant="info">consumed</StatusPill>
                    ) : (
                      <button
                        type="button"
                        title="Copy ceremony link"
                        className="uf-btn uf-btn--ghost h-8 w-8 p-0 cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(ceremonyLink(c.token));
                          toast.success("Link copied.");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
      </div>
    </OperatorShell>
  );
}
