import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import {
  Award,
  Check,
  Image as ImageIcon,
  Loader2,
  Medal,
  Package,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Operator → Honors & Locker. Manage the awards catalog (service ribbons,
// badges, medals — with uploaded imagery), confer/revoke honors on members,
// and mint the Quartermaster's Locker collectibles (blueprints, insignia,
// manuals, artifacts) with covers + payload files, grant and transfer them.
// Every action is audit-logged.
// ---------------------------------------------------------------------------

const HONOR_CATEGORY_LABEL: Record<string, string> = {
  ribbon: "Service Ribbon",
  badge: "Achievement Badge",
  medal: "Medal",
};

const VAULT_KIND_LABEL: Record<string, string> = {
  blueprint: "Blueprint Schematic",
  insignia: "Unit Insignia Patch",
  manual: "Technical Manual",
  artifact: "Artifact",
};

export default function OperatorHonors() {
  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Honors & Quartermaster's Locker</h1>
        <p className="text-uf-muted text-sm mt-1">
          Confer service ribbons, badges, and medals on members, and mint collectible
          assets for their Lockers. All actions are capability-gated and audit-logged.
        </p>
      </header>
      <HonorsSection />
      <VaultSection />
      <ConferSection />
    </OperatorShell>
  );
}

// ===========================================================================
// Honors catalog
// ===========================================================================

function HonorsSection() {
  const honors = useQuery(api.honors.listHonorsAdmin, {}) ?? [];
  const createHonor = useMutation(api.honors.createHonor);
  const deleteHonor = useMutation(api.honors.deleteHonor);
  const updateHonor = useMutation(api.honors.updateHonor);
  const attachImage = useMutation(api.honors.attachHonorImage);
  const removeImage = useMutation(api.honors.removeHonorImage);
  const genUpload = useMutation(api.assets.generateUploadUrl);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<"ribbon" | "badge" | "medal">("ribbon");
  const [description, setDescription] = useState("");
  const [precedence, setPrecedence] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("create");
    try {
      await createHonor({
        name,
        category,
        description,
        precedence: precedence ? Number(precedence) : undefined,
      });
      toast.success("Honor added to the catalog.");
      setName("");
      setDescription("");
      setPrecedence("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(honorId: string, file: File) {
    setBusy(`img:${honorId}`);
    try {
      const url = await genUpload({ purpose: "honor_image" });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      await attachImage({
        id: honorId as Id<"honors">,
        storageId: storageId as Id<"_storage">,
        mimeType: file.type,
        byteSize: file.size,
        altText: file.name,
      });
      toast.success("Insignia image attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
      setUploadFor(null);
    }
  }

  return (
    <section aria-labelledby="op-honors" className="mb-10">
      <h2 id="op-honors" className="uf-eyebrow mb-3">
        Awards catalog
      </h2>
      <HoloCard className="mb-4">
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-uf-muted flex flex-col gap-1">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="e.g., Void Cartographer's Ribbon"
              className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs text-uf-muted flex flex-col gap-1">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="bg-[rgba(16,24,39,0.5)] border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm"
            >
              <option value="ribbon">Service Ribbon</option>
              <option value="badge">Achievement Badge</option>
              <option value="medal">Medal</option>
            </select>
          </label>
          <label className="text-xs text-uf-muted flex flex-col gap-1 md:col-span-2">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={1000}
              placeholder="What it honors and why it's conferred."
              className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs text-uf-muted flex flex-col gap-1">
            Precedence (lower = higher honor)
            <input
              value={precedence}
              onChange={(e) => setPrecedence(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="e.g., 10"
              className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <div className="flex items-end">
            <NeonButton variant="primary" type="submit" disabled={busy === "create"}>
              <Award className="h-4 w-4" aria-hidden /> Add honor
            </NeonButton>
          </div>
        </form>
      </HoloCard>

      {honors.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">No honors yet — create the first ribbon above.</div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {honors.map((h) => (
            <li key={h._id}>
              <HoloCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="shrink-0 w-14 h-9 rounded border border-[color:var(--uf-border)] overflow-hidden bg-[rgba(16,24,39,0.5)] grid place-items-center">
                      {h.hasImage ? (
                        <HonorImage honorId={h._id} />
                      ) : (
                        <Medal className="h-4 w-4 text-uf-muted" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{h.name}</h3>
                        <StatusPill variant={h.category === "medal" ? "gold" : h.category === "badge" ? "violet" : "cyan"}>
                          {HONOR_CATEGORY_LABEL[h.category]}
                        </StatusPill>
                        {!h.active && <StatusPill variant="danger">Retired</StatusPill>}
                      </div>
                      <p className="text-sm text-uf-muted mt-1">{h.description}</p>
                      <p className="text-xs text-uf-muted mt-1 uppercase tracking-[0.16em]">
                        {h.holders} holder{h.holders === 1 ? "" : "s"} · precedence {h.precedence ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <input
                      ref={uploadFor === h._id ? fileRef : undefined}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                      className="sr-only"
                      aria-label={`Upload image for ${h.name}`}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(h._id, f);
                        e.target.value = "";
                      }}
                    />
                    <NeonButton
                      variant="ghost"
                      onClick={() => {
                        setUploadFor(h._id);
                        // Let the render attach the ref before triggering.
                        setTimeout(() => fileRef.current?.click(), 0);
                      }}
                      disabled={busy === `img:${h._id}`}
                    >
                      {busy === `img:${h._id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden />
                      )}
                      {h.hasImage ? "Replace art" : "Upload art"}
                    </NeonButton>
                    <NeonButton
                      variant="ghost"
                      onClick={async () => {
                        setBusy(`ret:${h._id}`);
                        try {
                          await updateHonor({ id: h._id as Id<"honors">, active: !h.active });
                          toast.success(h.active ? "Honor retired — no new awards." : "Honor reactivated.");
                        } catch {
                          toast.error("Update failed.");
                        } finally {
                          setBusy(null);
                        }
                      }}
                      disabled={busy === `ret:${h._id}`}
                    >
                      {h.active ? <X className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                      {h.active ? "Retire" : "Reactivate"}
                    </NeonButton>
                    <NeonButton
                      variant="ghost"
                      aria-label={`Delete ${h.name}`}
                      onClick={async () => {
                        if (!window.confirm(`Delete "${h.name}" and revoke it from ${h.holders} member(s)? This cannot be undone.`)) return;
                        setBusy(`del:${h._id}`);
                        try {
                          await deleteHonor({ id: h._id as Id<"honors"> });
                          toast.success("Honor deleted.");
                        } catch {
                          toast.error("Delete failed.");
                        } finally {
                          setBusy(null);
                        }
                      }}
                      disabled={busy === `del:${h._id}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </NeonButton>
                  </div>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HonorImage({ honorId }: { honorId: string }) {
  const url = useQuery(api.honors.honorImageUrl, { id: honorId as Id<"honors"> });
  if (!url) return <ImageIcon className="h-4 w-4 text-uf-muted" aria-hidden />;
  return <img src={url} alt="" className="w-full h-full object-cover" />;
}

// ===========================================================================
// Quartermaster's Locker
// ===========================================================================

function VaultSection() {
  const items = useQuery(api.honors.listVaultAdmin, {}) ?? [];
  const createItem = useMutation(api.honors.createVaultItem);
  const deleteItem = useMutation(api.honors.deleteVaultItem);
  const updateItem = useMutation(api.honors.updateVaultItem);
  const attachCover = useMutation(api.honors.attachVaultCover);
  const attachFile = useMutation(api.honors.attachVaultFile);
  const genUpload = useMutation(api.assets.generateUploadUrl);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"blueprint" | "insignia" | "manual" | "artifact">("blueprint");
  const [description, setDescription] = useState("");
  const [classification, setClassification] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("create");
    try {
      await createItem({ name, kind, description, classification: classification || undefined });
      toast.success("Item minted — attach art and payload below.");
      setName("");
      setDescription("");
      setClassification("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(honorItemId: string, file: File, target: "cover" | "file") {
    setBusy(`${target}:${honorItemId}`);
    try {
      const url = await genUpload({ purpose: target === "cover" ? "honor_image" : "vault_file" });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      if (target === "cover") {
        await attachCover({
          id: honorItemId as Id<"vaultItems">,
          storageId: storageId as Id<"_storage">,
          mimeType: file.type,
          byteSize: file.size,
          altText: file.name,
        });
        toast.success("Cover art attached.");
      } else {
        await attachFile({
          id: honorItemId as Id<"vaultItems">,
          storageId: storageId as Id<"_storage">,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
        });
        toast.success("Payload file attached — holders can download it.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="op-vault" className="mb-10">
      <h2 id="op-vault" className="uf-eyebrow mb-3">
        Quartermaster's Locker — collectible assets
      </h2>
      <HoloCard className="mb-4">
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-uf-muted flex flex-col gap-1">
            Item name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
              placeholder="e.g., VRS Drydock Blueprint — Sheet 4"
              className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs text-uf-muted flex flex-col gap-1">
            Kind
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="bg-[rgba(16,24,39,0.5)] border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm"
            >
              <option value="blueprint">Blueprint Schematic</option>
              <option value="insignia">Unit Insignia Patch</option>
              <option value="manual">Classified Technical Manual</option>
              <option value="artifact">Artifact</option>
            </select>
          </label>
          <label className="text-xs text-uf-muted flex flex-col gap-1 md:col-span-2">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={2000}
              placeholder="What it depicts and why collectors want it."
              className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs text-uf-muted flex flex-col gap-1">
            Classification label (optional)
            <input
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              maxLength={60}
              placeholder="e.g., Command Eyes Only"
              className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <div className="flex items-end">
            <NeonButton variant="primary" type="submit" disabled={busy === "create"}>
              <Package className="h-4 w-4" aria-hidden /> Mint item
            </NeonButton>
          </div>
        </form>
      </HoloCard>

      {items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">No collectibles yet — mint the first asset above.</div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {items.map((it) => (
            <VaultRow
              key={it._id}
              item={it}
              busy={busy}
              upload={upload}
              onToggleActive={async () => {
                setBusy(`act:${it._id}`);
                try {
                  await updateItem({ id: it._id as Id<"vaultItems">, active: !it.active });
                  toast.success(it.active ? "Item retired." : "Item reactivated.");
                } catch {
                  toast.error("Update failed.");
                } finally {
                  setBusy(null);
                }
              }}
              onDelete={async () => {
                if (!window.confirm(`Delete "${it.name}" and remove it from ${it.holders} locker(s)? This cannot be undone.`)) return;
                setBusy(`del:${it._id}`);
                try {
                  await deleteItem({ id: it._id as Id<"vaultItems"> });
                  toast.success("Item deleted.");
                } catch {
                  toast.error("Delete failed.");
                } finally {
                  setBusy(null);
                }
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function VaultRow({
  item,
  busy,
  upload,
  onToggleActive,
  onDelete,
}: {
  item: {
    _id: string;
    itemId: string;
    name: string;
    kind: string;
    description: string;
    classification: string | null;
    active: boolean;
    hasCover: boolean;
    hasFile: boolean;
    fileMeta: { fileName: string; byteSize: number } | null;
    holders: number;
  };
  busy: string | null;
  upload: (itemId: string, file: File, target: "cover" | "file") => Promise<void>;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const coverRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <li>
      <HoloCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <StatusPill variant="violet">{VAULT_KIND_LABEL[item.kind] ?? item.kind}</StatusPill>
              {item.classification && <StatusPill variant="danger">{item.classification}</StatusPill>}
              {!item.active && <StatusPill variant="warning">Retired</StatusPill>}
            </div>
            <p className="text-sm text-uf-muted mt-1">{item.description}</p>
            <p className="text-xs text-uf-muted mt-1 uppercase tracking-[0.16em]">
              {item.holders} in locker{item.holders === 1 ? "" : "s"} ·{" "}
              {item.hasFile ? `payload: ${item.fileMeta?.fileName ?? "attached"}` : "no payload file"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <input
              ref={coverRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
              className="sr-only"
              aria-label={`Upload cover for ${item.name}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(item._id, f, "cover");
                e.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              aria-label={`Upload payload for ${item.name}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(item._id, f, "file");
                e.target.value = "";
              }}
            />
            <NeonButton variant="ghost" onClick={() => coverRef.current?.click()} disabled={busy === `cover:${item._id}`}>
              {busy === `cover:${item._id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImageIcon className="h-4 w-4" aria-hidden />}
              {item.hasCover ? "Replace art" : "Cover art"}
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy === `file:${item._id}`}>
              {busy === `file:${item._id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              {item.hasFile ? "Replace file" : "Payload"}
            </NeonButton>
            <NeonButton variant="ghost" onClick={onToggleActive} disabled={busy === `act:${item._id}`}>
              {item.active ? <X className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {item.active ? "Retire" : "Reactivate"}
            </NeonButton>
            <NeonButton variant="ghost" onClick={onDelete} disabled={busy === `del:${item._id}`} aria-label={`Delete ${item.name}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </NeonButton>
          </div>
        </div>
      </HoloCard>
    </li>
  );
}

// ===========================================================================
// Confer / grant panel
// ===========================================================================

function ConferSection() {
  const [mode, setMode] = useState<"honor" | "vault">("honor");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<{ _id: string; displayName: string } | null>(null);
  const members = useQuery(api.honors.listMembersForAward, { q: debounced });
  const held = useQuery(
    api.honors.listMemberAwards,
    mode === "honor" && selected ? { userId: selected._id as Id<"users"> } : "skip",
  );
  const honors = useQuery(api.honors.listHonorsAdmin, {}) ?? [];
  const vaultItems = useQuery(api.honors.listVaultAdmin, {}) ?? [];

  const grantHonor = useMutation(api.honors.grantHonor);
  const revokeHonor = useMutation(api.honors.revokeHonor);
  const grantVault = useMutation(api.honors.grantVaultItem);
  const revokeVault = useMutation(api.honors.revokeVaultItem);
  const transferVault = useMutation(api.honors.transferVaultItem);

  const [awardId, setAwardId] = useState("");
  const [citation, setCitation] = useState("");
  const [vaultItemId, setVaultItemId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Debounce the member search.
  useState(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  });

  return (
    <section aria-labelledby="op-confer">
      <h2 id="op-confer" className="uf-eyebrow mb-3">
        Confer & grant
      </h2>
      <HoloCard>
        <div className="flex gap-2 mb-4" role="tablist" aria-label="Grant type">
          <NeonButton
            variant={mode === "honor" ? "primary" : "ghost"}
            aria-pressed={mode === "honor"}
            onClick={() => setMode("honor")}
          >
            <Medal className="h-4 w-4" aria-hidden /> Honor
          </NeonButton>
          <NeonButton
            variant={mode === "vault" ? "primary" : "ghost"}
            aria-pressed={mode === "vault"}
            onClick={() => setMode("vault")}
          >
            <Package className="h-4 w-4" aria-hidden /> Locker asset
          </NeonButton>
        </div>

        {/* Member picker */}
        <label className="text-xs text-uf-muted flex flex-col gap-1 mb-3">
          Find member
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-uf-muted shrink-0" aria-hidden />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                const t = setTimeout(() => setDebounced(e.target.value), 300);
                void t;
              }}
              placeholder="Type a callsign…"
              className="flex-1 bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </div>
        </label>
        {!selected && members && members.length > 0 && (
          <ul className="grid gap-1 mb-4 md:grid-cols-2 list-none p-0 m-0">
            {members.map((m) => (
              <li key={m._id}>
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[rgba(0,229,255,0.08)] border border-[color:var(--uf-border)] cursor-pointer"
                >
                  {m.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <StatusPill variant="cyan">Member: {selected.displayName}</StatusPill>
            <NeonButton variant="ghost" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" aria-hidden /> Change
            </NeonButton>
          </div>
        )}

        {mode === "honor" ? (
          <div className="grid gap-3">
            <label className="text-xs text-uf-muted flex flex-col gap-1">
              Honor
              <select
                value={awardId}
                onChange={(e) => setAwardId(e.target.value)}
                className="bg-[rgba(16,24,39,0.5)] border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm"
              >
                <option value="">— Select honor —</option>
                {honors.filter((h) => h.active).map((h) => (
                  <option key={h.awardId} value={h.awardId}>
                    {h.name} ({HONOR_CATEGORY_LABEL[h.category]})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-uf-muted flex flex-col gap-1">
              Citation (optional)
              <input
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                maxLength={500}
                placeholder="For distinguished charting of the Vedae approach…"
                className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <div>
              <NeonButton
                variant="primary"
                disabled={!selected || !awardId || busy === "grant"}
                onClick={async () => {
                  if (!selected || !awardId) return;
                  setBusy("grant");
                  try {
                    await grantHonor({ userId: selected._id as Id<"users">, awardId, citation: citation || undefined });
                    toast.success("Honor conferred — member notified.");
                    setCitation("");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Grant failed.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden /> Confer honor
              </NeonButton>
            </div>

            {selected && held && held.length > 0 && (
              <div className="mt-2">
                <p className="uf-eyebrow mb-2">Currently held</p>
                <ul className="space-y-1 list-none p-0 m-0">
                  {held.map((row) => {
                    const h = honors.find((x) => x.awardId === row.awardId);
                    return (
                      <li key={row._id} className="flex items-center justify-between gap-3 text-sm border-b border-[color:var(--uf-border)] pb-1 last:border-0">
                        <span>
                          {h?.name ?? row.awardId}
                          {row.citation ? <span className="text-uf-muted"> — “{row.citation}”</span> : null}
                        </span>
                        <NeonButton
                          variant="ghost"
                          onClick={async () => {
                            setBusy(`rev:${row._id}`);
                            try {
                              await revokeHonor({ userId: selected._id as Id<"users">, awardId: row.awardId });
                              toast.success("Honor revoked.");
                            } catch {
                              toast.error("Revoke failed.");
                            } finally {
                              setBusy(null);
                            }
                          }}
                          disabled={busy === `rev:${row._id}`}
                        >
                          <X className="h-4 w-4" aria-hidden /> Revoke
                        </NeonButton>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="text-xs text-uf-muted flex flex-col gap-1">
              Locker asset
              <select
                value={vaultItemId}
                onChange={(e) => setVaultItemId(e.target.value)}
                className="bg-[rgba(16,24,39,0.5)] border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm"
              >
                <option value="">— Select asset —</option>
                {vaultItems.filter((v) => v.active).map((v) => (
                  <option key={v.itemId} value={v.itemId}>
                    {v.name} ({VAULT_KIND_LABEL[v.kind] ?? v.kind})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <NeonButton
                variant="primary"
                disabled={!selected || !vaultItemId || busy === "g"}
                onClick={async () => {
                  if (!selected || !vaultItemId) return;
                  setBusy("g");
                  try {
                    await grantVault({ userId: selected._id as Id<"users">, itemId: vaultItemId });
                    toast.success("Asset delivered to the member's Locker.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Grant failed.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Package className="h-4 w-4" aria-hidden /> Grant asset
              </NeonButton>
              <NeonButton
                variant="ghost"
                disabled={!selected || !vaultItemId || busy === "r"}
                onClick={async () => {
                  if (!selected || !vaultItemId) return;
                  setBusy("r");
                  try {
                    await revokeVault({ userId: selected._id as Id<"users">, itemId: vaultItemId });
                    toast.success("Asset removed from the member's Locker.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Revoke failed.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <X className="h-4 w-4" aria-hidden /> Remove from locker
              </NeonButton>
            </div>
            <p className="text-xs text-uf-muted">
              Trades are operator-brokered: to move an asset between members, remove it from
              one locker and grant it to the other — the item is never duplicated.
            </p>
          </div>
        )}
      </HoloCard>
    </section>
  );
}
