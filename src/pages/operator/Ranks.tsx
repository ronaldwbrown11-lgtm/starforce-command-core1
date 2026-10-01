import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Award, Crown, Search, UserCog } from "lucide-react";

// =========================================================================
// Rank Ladder console (operator)
//
//  - Inspect the ladder with holder counts + flag-officer seat stats
//  - Attach an insignia IMAGE to any rank (canonical or operator-created)
//  - Create new rank records for future commissions (with image at creation)
//  - PROMOTE members manually — members can never set their own rank
// =========================================================================

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const inputCls =
  "border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text";

function validateImage(file: File) {
  if (!IMAGE_MIME.includes(file.type)) {
    throw new Error(`Unsupported type (${file.type}). Use JPEG, PNG, WebP, or AVIF.`);
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(`Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB; max 5 MB.`);
  }
}

function RankThumb({
  storageId,
  size = "h-9 w-9",
}: {
  storageId: Id<"_storage"> | null;
  size?: string;
}) {
  const url = useQuery(
    api.assets.coverUrl,
    storageId ? { storageId } : "skip",
  );
  if (!storageId) {
    return (
      <span
        className={`grid ${size} shrink-0 place-items-center rounded-md border border-dashed border-[color:var(--uf-border)] text-[9px] text-uf-muted`}
        aria-hidden
      >
        IMG
      </span>
    );
  }
  if (url === undefined) {
    return <span className={`${size} shrink-0 uf-skeleton rounded-md`} />;
  }
  if (!url) {
    return (
      <span
        className={`grid ${size} shrink-0 place-items-center rounded-md border border-[color:var(--uf-border)] text-[9px] text-uf-muted`}
        aria-hidden
      >
        ?
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={`${size} shrink-0 rounded-md border border-[color:var(--uf-border)] object-cover`}
    />
  );
}

export default function OpRanks() {
  const overview = useQuery(api.rankAdmin.overview);
  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const setRankImage = useMutation(api.rankAdmin.setRankImage);
  const createRank = useMutation(api.rankAdmin.createRank);
  const updateRank = useMutation(api.rankAdmin.updateRank);
  const setMemberRank = useMutation(api.rankAdmin.setMemberRank);

  // Manual promotion search
  const [searchQ, setSearchQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const members = useQuery(
    api.rankAdmin.searchMembers,
    submittedQ ? { q: submittedQ } : "skip",
  );
  const [selectedRanks, setSelectedRanks] = useState<Record<string, string>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Rank image upload (per-row, one shared input)
  const uploadTargetRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Create-rank form
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTier, setNewTier] = useState(12);
  const [newMinXp, setNewMinXp] = useState(0);
  const [newBlurb, setNewBlurb] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);

  // Label rename
  const [renameKey, setRenameKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const uploadToStorage = async (file: File): Promise<Id<"_storage">> => {
    validateImage(file);
    const url = await generateUploadUrl({ purpose: "rank_image" });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const { storageId } = (await res.json()) as { storageId: string };
    return storageId as Id<"_storage">;
  };

  const handlePickImage = (rankKey: string) => {
    uploadTargetRef.current = rankKey;
    imageInputRef.current?.click();
  };

  const handleImageFile = async (file: File) => {
    const target = uploadTargetRef.current;
    if (!target) return;
    try {
      setUploadingKey(target);
      const storageId = await uploadToStorage(file);
      await setRankImage({ rankKey: target, imageStorageId: storageId });
      toast.success("Rank insignia updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingKey(null);
      uploadTargetRef.current = null;
    }
  };

  const removeImage = async (rankKey: string) => {
    try {
      setUploadingKey(rankKey);
      await setRankImage({ rankKey, imageStorageId: null });
      toast.success("Insignia removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setUploadingKey(null);
    }
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      toast.error("Rank label required.");
      return;
    }
    try {
      setSavingCreate(true);
      let imageStorageId: Id<"_storage"> | undefined;
      if (newImage) imageStorageId = await uploadToStorage(newImage);
      const res = await createRank({
        label: newLabel.trim(),
        tier: newTier,
        minXp: newMinXp,
        blurb: newBlurb.trim() || undefined,
        imageStorageId,
      });
      toast.success(`Rank "${newLabel.trim()}" created — key: ${res.key}`);
      setNewLabel("");
      setNewBlurb("");
      setNewMinXp(0);
      setNewImage(null);
      setShowCreate(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const saveRename = async (key: string) => {
    if (!renameValue.trim()) return;
    try {
      await updateRank({ key, label: renameValue.trim() });
      toast.success("Rank label updated.");
      setRenameKey(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const searchMembers = (e: FormEvent) => {
    e.preventDefault();
    setSubmittedQ(searchQ.trim());
  };

  const applyRank = async (userId: string, name: string) => {
    const target = selectedRanks[userId];
    if (!target) {
      toast.error("Pick a target rank first.");
      return;
    }
    try {
      setApplyingId(userId);
      const res = await setMemberRank({
        userId: userId as Id<"users">,
        rankKey: target,
      });
      toast.success(
        res.unchanged
          ? `${name} already holds that rank.`
          : `${name} → ${res.label} ✓`,
      );
      // Results stay mounted; labels refresh reactively from the queries.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Promotion failed.");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <OperatorShell>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Rank Ladder</h1>
        <p className="text-uf-muted text-sm mb-6">
          The Capped Star Force progression ladder: attach insignia images,
          create rank records for future commissions, and promote members
          manually. Members can never set their own rank — promotions come
          from the checklist/XP engine or from this console.
        </p>

        {/* Seat + roster stats */}
        <div className="flex flex-wrap gap-2 mb-6">
          <StatusPill variant="gold">
            <Crown className="h-3.5 w-3.5 inline mr-1 -mt-0.5" aria-hidden />
            {overview ? `${overview.activeSeats}/${overview.seatCap}` : "…"} Rear
            Admiral seats
          </StatusPill>
          <StatusPill variant="violet">
            {overview ? overview.waiting : "…"} waiting (eligible)
          </StatusPill>
          <StatusPill variant="warning">
            {overview ? overview.inactiveFlagOfficers : "…"} inactive flag officers
          </StatusPill>
          <StatusPill variant="info">
            {overview ? overview.totalMembers : "…"} members
          </StatusPill>
        </div>

        {/* ============ LADDER TABLE ============ */}
        <HoloCard className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="uf-eyebrow flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" aria-hidden /> Ladder & insignia
            </h2>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="uf-btn uf-btn--ghost"
            >
              {showCreate ? "Close" : "＋ Create rank"}
            </button>
          </div>

          {showCreate ? (
            <form
              onSubmit={submitCreate}
              className="mb-5 rounded-md border border-[rgba(0,229,255,0.3)] bg-[rgba(0,229,255,0.05)] p-4 grid gap-3 sm:grid-cols-2"
            >
              <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1 sm:col-span-2">
                Rank label
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Fleet Admiral"
                  className={inputCls}
                />
              </label>
              <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
                Tier number
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={newTier}
                  onChange={(e) => setNewTier(Number(e.target.value))}
                  className={inputCls}
                />
              </label>
              <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
                Min total XP (display — manual assignment)
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={newMinXp}
                  onChange={(e) => setNewMinXp(Number(e.target.value))}
                  className={inputCls}
                />
              </label>
              <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1 sm:col-span-2">
                Blurb
                <input
                  value={newBlurb}
                  onChange={(e) => setNewBlurb(e.target.value)}
                  maxLength={200}
                  placeholder="Shown under the rank in the ladder table"
                  className={inputCls}
                />
              </label>
              <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1 sm:col-span-2">
                Insignia image (JPEG/PNG/WebP/AVIF · max 5 MB)
                <input
                  type="file"
                  accept={IMAGE_MIME.join(",")}
                  onChange={(e) => setNewImage(e.target.files?.[0] ?? null)}
                  className="text-sm text-uf-muted file:mr-3 file:rounded-md file:border-0 file:bg-[rgba(0,229,255,0.15)] file:px-3 file:py-1.5 file:text-xs file:text-uf-cyan"
                />
              </label>
              <div className="sm:col-span-2 flex gap-2">
                <NeonButton variant="primary" type="submit" loading={savingCreate}>
                  Create rank
                </NeonButton>
                <NeonButton variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </NeonButton>
              </div>
              <p className="text-uf-muted text-xs sm:col-span-2">
                Custom ranks are assigned manually from this console — the XP
                ladder never awards them. Canonical ladder thresholds (the six
                XP ranks) are doctrine and stay enforced by the progression
                engine.
              </p>
            </form>
          ) : null}

          {overview === undefined ? (
            <div className="uf-skeleton" style={{ height: 240 }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-uf-muted text-xs border-b border-[color:var(--uf-border)]">
                    <th className="py-2 pr-3 font-medium">Insignia</th>
                    <th className="py-2 pr-3 font-medium">Rank</th>
                    <th className="py-2 pr-3 font-medium">Key</th>
                    <th className="py-2 pr-3 font-medium">Tier</th>
                    <th className="py-2 pr-3 font-medium text-right">Min XP</th>
                    <th className="py-2 pr-3 font-medium text-right">Holders</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.ranks.map((r) => (
                    <tr
                      key={r.key}
                      className="border-b border-[color:var(--uf-border)] last:border-0 align-middle"
                    >
                      <td className="py-2.5 pr-3">
                        <RankThumb storageId={r.imageStorageId} />
                      </td>
                      <td className="py-2.5 pr-3">
                        {renameKey === r.key ? (
                          <span className="flex items-center gap-1.5">
                            <input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              maxLength={40}
                              className={inputCls + " py-1"}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void saveRename(r.key)}
                              className="text-xs text-uf-cyan underline"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenameKey(null)}
                              className="text-xs text-uf-muted underline"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span
                              className={
                                r.flagOfficer
                                  ? "font-medium text-[color:var(--uf-gold)]"
                                  : "font-medium text-uf-text"
                              }
                            >
                              {r.label}
                            </span>
                            <StatusPill variant={r.canonical ? "cyan" : "violet"}>
                              {r.canonical ? "ladder" : "custom"}
                            </StatusPill>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-uf-muted">
                        {r.key}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-uf-muted">
                        {r.tier}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-right">
                        {r.minXp.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-right text-uf-muted">
                        {r.holderCount}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void handlePickImage(r.key)}
                          disabled={uploadingKey === r.key}
                          className="mr-2 text-xs text-uf-cyan underline underline-offset-2 disabled:opacity-50"
                        >
                          {uploadingKey === r.key
                            ? "Uploading…"
                            : r.imageStorageId
                              ? "Replace image"
                              : "Add image"}
                        </button>
                        {r.imageStorageId ? (
                          <button
                            type="button"
                            onClick={() => void removeImage(r.key)}
                            disabled={uploadingKey === r.key}
                            className="mr-2 text-xs text-uf-muted underline underline-offset-2 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setRenameKey(r.key);
                            setRenameValue(r.label);
                          }}
                          className="text-xs text-uf-muted underline underline-offset-2"
                        >
                          Rename
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept={IMAGE_MIME.join(",")}
            aria-label="Upload rank insignia"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageFile(file);
              e.target.value = "";
            }}
          />
        </HoloCard>

        {/* ============ MANUAL PROMOTION ============ */}
        <HoloCard>
          <h2 className="uf-eyebrow mb-1 flex items-center gap-1.5">
            <UserCog className="h-3.5 w-3.5" aria-hidden /> Manual promotion
          </h2>
          <p className="text-uf-muted text-xs mb-3">
            Find a member and set their commission directly. Changes show
            immediately on the member&apos;s profile; promoting to Rear Admiral
            consumes one of the {overview?.seatCap ?? 10} active seats (the hard
            cap is enforced).
          </p>

          <form onSubmit={searchMembers} className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-uf-muted"
                aria-hidden
              />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search by callsign or email…"
                className={inputCls + " w-full pl-9"}
              />
            </div>
            <NeonButton variant="primary" type="submit">
              Search
            </NeonButton>
          </form>

          {members === undefined ? null : members.length === 0 ? (
            <p className="text-uf-muted text-sm">
              {submittedQ ? "No members match that search." : "Search to find a member."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-uf-text truncate">
                      {m.name}
                      {m.email ? (
                        <span className="text-uf-muted text-xs"> · {m.email}</span>
                      ) : null}
                    </span>
                    <span className="block text-[11px] text-uf-muted">
                      {m.rankLabel} · {m.xp.toLocaleString()} XP
                    </span>
                  </span>
                  <select
                    value={selectedRanks[m.id] ?? m.rankKey ?? ""}
                    onChange={(e) =>
                      setSelectedRanks((s) => ({ ...s, [m.id]: e.target.value }))
                    }
                    className={inputCls + " max-w-[220px]"}
                    aria-label={`Target rank for ${m.name}`}
                  >
                    {overview?.ranks.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label} (T{r.tier})
                      </option>
                    ))}
                  </select>
                  <NeonButton
                    variant="primary"
                    onClick={() => void applyRank(m.id, m.name)}
                    loading={applyingId === m.id}
                    disabled={applyingId === m.id}
                  >
                    Apply
                  </NeonButton>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
      </div>
    </OperatorShell>
  );
}
