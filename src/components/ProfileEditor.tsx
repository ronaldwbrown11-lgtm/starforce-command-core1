import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NeonButton } from "@/components/uf";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { TIER_FLAIR_PRESETS, type TierId } from "@/lib/tiers";

const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export type ProfileEditorFields = {
  displayName?: string | null;
  rank?: string | null;
  fleet?: string | null;
  bio?: string | null;
  flair?: string | null;
  avatarStorageId?: Id<"_storage"> | null;
};

/**
 * Shared inline editor for a member's public dossier: display name, rank,
 * fleet, bio, and avatar. Single source of truth for identity editing — the
 * profile page and the account page both render this, so the two can't drift.
 */
export function ProfileEditor({
  initial,
  submitLabel = "Save profile",
  onSaved,
  onCancel,
  paidMember = false,
  tier = null,
}: {
  initial: ProfileEditorFields;
  submitLabel?: string;
  onSaved?: () => void;
  onCancel?: () => void;
  // Whether the editing member is on a paid tier — unlocks the flair field.
  paidMember?: boolean;
  // The member's tier — unlocks tier-flavored flair presets.
  tier?: TierId | null;
}) {
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUserUploadUrl = useMutation(api.users.generateUserUploadUrl);

  const [nameDraft, setNameDraft] = useState(initial.displayName ?? "");
  const [rankDraft, setRankDraft] = useState(initial.rank ?? "");
  const [fleetDraft, setFleetDraft] = useState(initial.fleet ?? "");
  const [bioDraft, setBioDraft] = useState(initial.bio ?? "");
  const [flairDraft, setFlairDraft] = useState(initial.flair ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const presets =
    tier && tier !== "free" ? TIER_FLAIR_PRESETS[tier] ?? [] : [];

  const handleSave = async () => {
    const name = nameDraft.trim();
    if (!name) {
      toast.error("Display name cannot be empty.");
      return;
    }
    try {
      setSaving(true);
      await updateProfile({
        displayName: name,
        rank: rankDraft.trim() || undefined,
        fleet: fleetDraft.trim() || undefined,
        bio: bioDraft.trim() || undefined,
        ...(paidMember ? { flair: flairDraft.trim() || undefined } : {}),
      });
      toast.success("Dossier updated — the fleet sees it now.");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (file: File) => {
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(`Avatar is ${(file.size / (1024 * 1024)).toFixed(1)} MB; max 4 MB.`);
      return;
    }
    if (!AVATAR_MIME.includes(file.type)) {
      toast.error(`Unsupported type (${file.type}). Use JPEG, PNG, WebP, or AVIF.`);
      return;
    }
    try {
      setAvatarBusy(true);
      const url = await generateUserUploadUrl({ purpose: "avatar" });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      await updateProfile({ avatarStorageId: storageId as Id<"_storage"> });
      toast.success("Avatar updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarBusy(true);
      await updateProfile({ avatarStorageId: null });
      toast.success("Avatar removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
        Display name
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          maxLength={60}
          placeholder="Your callsign"
          className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        />
      </label>
      <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
        Rank
        <input
          value={rankDraft}
          onChange={(e) => setRankDraft(e.target.value)}
          maxLength={40}
          placeholder="e.g. Commander"
          className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        />
      </label>
      <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
        Fleet
        <input
          value={fleetDraft}
          onChange={(e) => setFleetDraft(e.target.value)}
          maxLength={60}
          placeholder="e.g. 7th Expeditionary"
          className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        />
      </label>
      <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
        Flair
        {paidMember ? (
          <>
            {presets.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Flair presets">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFlairDraft(p)}
                    aria-pressed={flairDraft === p}
                    className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
                      flairDraft === p
                        ? "border-[rgba(0,229,255,0.6)] bg-[rgba(0,229,255,0.12)] text-uf-text"
                        : "border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : null}
            <input
              value={flairDraft}
              onChange={(e) => setFlairDraft(e.target.value)}
              maxLength={40}
              placeholder="e.g. Keeper of the Starforge — or pick a preset above"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </>
        ) : (
          <span className="text-[0.7rem] normal-case tracking-normal text-uf-muted flex items-center gap-1 flex-wrap">
            Custom flair is a paid-member perk.{" "}
            <Link to="/membership" className="text-uf-cyan underline">
              Upgrade to claim yours
            </Link>
          </span>
        )}
      </label>
      <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
        Bio
        <textarea
          value={bioDraft}
          onChange={(e) => setBioDraft(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Who you are in the fleet…"
          className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <NeonButton
          variant="ghost"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarBusy}
        >
          <Camera className="h-4 w-4" aria-hidden />
          {avatarBusy ? "Uploading…" : "Change avatar"}
        </NeonButton>
        {initial.avatarStorageId ? (
          <NeonButton
            variant="danger"
            onClick={handleRemoveAvatar}
            disabled={avatarBusy}
          >
            Remove avatar
          </NeonButton>
        ) : null}
        <input
          ref={avatarInputRef}
          type="file"
          accept={AVATAR_MIME.join(",")}
          aria-label="Upload avatar"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleAvatarFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="flex gap-2">
        <NeonButton
          variant="primary"
          className="flex-1"
          onClick={handleSave}
          loading={saving}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
            </>
          ) : (
            submitLabel
          )}
        </NeonButton>
        <NeonButton variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </NeonButton>
      </div>
    </div>
  );
}
