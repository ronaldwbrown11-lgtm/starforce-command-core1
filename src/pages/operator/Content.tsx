import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { CoverPicker } from "@/components/operator/CoverPicker";
import { FilePicker } from "@/components/operator/FilePicker";
import { toast } from "sonner";
import {
  Archive,
  BookOpen,
  ListChecks,
  Pencil,
  Plus,
  Radio,
  ScrollText,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { TIER_ORDER, tierLabel, tierPillVariant } from "@/lib/tiers";

type Tab = "lore" | "transmissions" | "resources" | "missions";

const MISSION_STATUSES = ["active", "locked", "completed"] as const;
const MISSION_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  locked: "Classified",
  completed: "Completed",
};
const MISSION_STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "default"
> = {
  active: "success",
  locked: "warning",
  completed: "default",
};

const ENTRY_TYPES = ["character", "location", "event", "artifact"] as const;
const RESOURCE_TYPES = [
  "guide",
  "tool",
  "download",
  "onboarding",
  "policy",
] as const;
const TRANSMISSION_TYPES = ["briefing", "mission", "lore-deepdive", "podcast"] as const;

export default function OperatorContent() {
  const [tab, setTab] = useState<Tab>("lore");
  const [editingLore, setEditingLore] = useState<null | any>(null);
  const [editingTransmission, setEditingTransmission] =
    useState<null | any>(null);
  const [editingResource, setEditingResource] = useState<null | any>(null);
  const [editingMission, setEditingMission] = useState<null | any>(null);

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-uf-cyan" aria-hidden />
          Content Desk
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Edit lore entries, transmissions, resources, and mission briefings.
          New entries are created in a draft state; archive soft-removes them
          from front-page surfaces.
        </p>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap" role="tablist" aria-label="Content tabs">
        <TabButton
          tab="lore"
          active={tab === "lore"}
          onClick={() => setTab("lore")}
          icon={<ScrollText className="h-4 w-4" aria-hidden />}
          label="Lore"
        />
        <TabButton
          tab="transmissions"
          active={tab === "transmissions"}
          onClick={() => setTab("transmissions")}
          icon={<Radio className="h-4 w-4" aria-hidden />}
          label="Transmissions"
        />
        <TabButton
          tab="resources"
          active={tab === "resources"}
          onClick={() => setTab("resources")}
          icon={<BookOpen className="h-4 w-4" aria-hidden />}
          label="Resources"
        />
        <TabButton
          tab="missions"
          active={tab === "missions"}
          onClick={() => setTab("missions")}
          icon={<Target className="h-4 w-4" aria-hidden />}
          label="Missions"
        />
      </div>

      {tab === "lore" ? (
        <LorePanel onEdit={setEditingLore} />
      ) : tab === "transmissions" ? (
        <TransmissionsPanel onEdit={setEditingTransmission} />
      ) : tab === "missions" ? (
        <MissionsPanel onEdit={setEditingMission} />
      ) : (
        <ResourcesPanel onEdit={setEditingResource} />
      )}

      {editingLore ? (
        <LoreEditorModal
          initial={editingLore}
          onClose={() => setEditingLore(null)}
        />
      ) : null}
      {editingTransmission ? (
        <TransmissionEditorModal
          initial={editingTransmission}
          onClose={() => setEditingTransmission(null)}
        />
      ) : null}
      {editingResource ? (
        <ResourceEditorModal
          initial={editingResource}
          onClose={() => setEditingResource(null)}
        />
      ) : null}
      {editingMission ? (
        <MissionEditorModal
          initial={editingMission}
          onClose={() => setEditingMission(null)}
        />
      ) : null}
    </OperatorShell>
  );
}

function TabButton({
  tab,
  active,
  onClick,
  icon,
  label,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`uf-btn ${active ? "uf-btn--primary" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Lore
// -----------------------------------------------------------------------------

function LorePanel({ onEdit }: { onEdit: (e: any) => void }) {
  const items = useQuery(api.content.listLore, { limit: 200 });
  const archive = useMutation(api.admin.archiveLore);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (items === undefined) return [];
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.faction ?? "").toLowerCase().includes(q) ||
        (e.sector ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <section aria-labelledby="desklore">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="desklore" className="text-xl font-semibold">
          Lore entries
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          <NeonButton
            variant="primary"
            onClick={() => onEdit({ id: undefined })}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            New lore
          </NeonButton>
        </div>
      </header>
      <HoloCard>
        {items === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : filtered.length === 0 ? (
          <p className="uf-empty">No lore entries match.</p>
        ) : (
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {filtered.map((e) => (
              <li
                key={e._id}
                className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{e.title}</p>
                  <p className="text-uf-muted text-xs flex flex-wrap gap-2 mt-1">
                    {e.faction ? (
                      <StatusPill variant="info">{e.faction}</StatusPill>
                    ) : null}
                    {e.sector ? (
                      <StatusPill variant="violet">{e.sector}</StatusPill>
                    ) : null}
                    {e.entryType ? (
                      <StatusPill variant="default">{e.entryType}</StatusPill>
                    ) : null}
                    {e.classification ? (
                      <StatusPill variant="warning">
                        {e.classification}
                      </StatusPill>
                    ) : null}
                    {e.featured ? (
                      <StatusPill variant="gold">Featured</StatusPill>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <NeonButton variant="ghost" onClick={() => onEdit(e)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Archive "${e.title}"?`))
                        archive({ id: e._id })
                          .then(() => toast.success("Archived."))
                          .catch(() => toast.error("Archive failed."));
                    }}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                  </NeonButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HoloCard>
    </section>
  );
}

function LoreEditorModal({
  initial,
  onClose,
}: {
  initial: any;
  onClose: () => void;
}) {
  const upsert = useMutation(api.admin.upsertLore);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    excerpt: initial?.excerpt ?? "",
    content: initial?.content ?? "",
    faction: initial?.faction ?? "",
    sector: initial?.sector ?? "",
    classification: initial?.classification ?? "",
    entryType: initial?.entryType ?? "",
    tierRequired: initial?.tierRequired ?? "",
  });
  useEffect(() => {
    setForm({
      id: initial?.id,
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      excerpt: initial?.excerpt ?? "",
      content: initial?.content ?? "",
      faction: initial?.faction ?? "",
      sector: initial?.sector ?? "",
      classification: initial?.classification ?? "",
      entryType: initial?.entryType ?? "",
      tierRequired: initial?.tierRequired ?? "",
    });
  }, [initial]);

  async function save() {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error("Title and slug required.");
      return;
    }
    if (!window.confirm(form.id ? "Save changes to this lore entry?" : "Create this lore entry?")) {
      return;
    }
    setBusy(true);
    try {
      await upsert({
        id: form.id,
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content,
        faction: form.faction || undefined,
        sector: form.sector || undefined,
        classification: form.classification || undefined,
        entryType: form.entryType || undefined,
        tierRequired: (form.tierRequired as any) || undefined,
      });
      toast.success(form.id ? "Saved." : "Created.");
      onClose();
    } catch {
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (            <ModalShell title={form.id ? "Edit lore entry" : "New lore entry"} onClose={onClose}>
              {form.id ? (
                <div className="mb-4">
                  <CoverPicker
                    kind="lore"
                    rowId={form.id}
                    currentStorageId={initial?.coverStorageId ?? null}
                    currentUrl={initial?.coverUrl ?? null}
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-3">
        <FieldRow
          label="Title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
        />
        <FieldRow
          label="Slug"
          value={form.slug}
          onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
        />
        <FieldRow
          label="Excerpt"
          value={form.excerpt}
          onChange={(v) => setForm((f) => ({ ...f, excerpt: v }))}
          maxLength={280}
          rows={2}
        />
        <FieldRow
          label="Content"
          value={form.content}
          onChange={(v) => setForm((f) => ({ ...f, content: v }))}
          rows={6}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow
            label="Faction"
            value={form.faction}
            onChange={(v) => setForm((f) => ({ ...f, faction: v }))}
          />
          <FieldRow
            label="Sector"
            value={form.sector}
            onChange={(v) => setForm((f) => ({ ...f, sector: v }))}
          />
          <FieldRow
            label="Classification"
            value={form.classification}
            onChange={(v) =>
              setForm((f) => ({ ...f, classification: v }))
            }
          />
          <SelectRow
            label="Entry type"
            value={form.entryType}
            options={[...ENTRY_TYPES, ""]}
            onChange={(v) => setForm((f) => ({ ...f, entryType: v }))}
          />
          <SelectRow
            label="Tier required"
            value={form.tierRequired}
            options={["", ...TIER_ORDER]}
            onChange={(v) =>
              setForm((f) => ({ ...f, tierRequired: v }))
            }
            renderOption={(v) =>
              v === "" ? "Any tier" : tierLabel(v as any)
            }
            renderSelected={(v) =>
              v === "" ? "Any tier" : (
                <StatusPill variant={tierPillVariant(v as any)}>
                  {tierLabel(v as any)}
                </StatusPill>
              )
            }
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <NeonButton variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </NeonButton>
        <NeonButton
          variant="primary"
          onClick={save}
          loading={busy}
          disabled={busy}
        >
          {form.id ? "Save changes" : "Create entry"}
        </NeonButton>
      </div>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// Transmissions
// -----------------------------------------------------------------------------

function TransmissionsPanel({ onEdit }: { onEdit: (e: any) => void }) {
  const items = useQuery(api.content.listTransmissions, { limit: 100 });
  const archive = useMutation(api.admin.archiveTransmission);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (items === undefined) return [];
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.transmissionType ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <section aria-labelledby="desktransmission">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="desktransmission" className="text-xl font-semibold">
          Transmissions
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          <NeonButton
            variant="primary"
            onClick={() => onEdit({ id: undefined })}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            New transmission
          </NeonButton>
        </div>
      </header>
      <HoloCard>
        {items === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : filtered.length === 0 ? (
          <p className="uf-empty">No transmissions match.</p>
        ) : (
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {filtered.map((t) => (
              <li
                key={t._id}
                className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{t.title}</p>
                  <p className="text-uf-muted text-xs flex flex-wrap gap-2 mt-1">
                    {t.transmissionType ? (
                      <StatusPill variant="info">{t.transmissionType}</StatusPill>
                    ) : null}
                    {t.durationSeconds ? (
                      <StatusPill variant="default">
                        {Math.round(t.durationSeconds / 60)} min
                      </StatusPill>
                    ) : null}
                    {t.featured ? (
                      <StatusPill variant="gold">Pinned</StatusPill>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <NeonButton variant="ghost" onClick={() => onEdit(t)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Archive "${t.title}"?`))
                        archive({ id: t._id })
                          .then(() => toast.success("Unpinned."))
                          .catch(() => toast.error("Archive failed."));
                    }}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                  </NeonButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HoloCard>
    </section>
  );
}

function TransmissionEditorModal({
  initial,
  onClose,
}: {
  initial: any;
  onClose: () => void;
}) {
  const upsert = useMutation(api.admin.upsertTransmission);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    videoUrl: initial?.videoUrl ?? "",
    audioUrl: initial?.audioUrl ?? "",
    transmissionType: initial?.transmissionType ?? "",
    durationSeconds: initial?.durationSeconds ?? "",
  });
  useEffect(() => {
    setForm({
      id: initial?.id,
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      description: initial?.description ?? "",
      videoUrl: initial?.videoUrl ?? "",
      audioUrl: initial?.audioUrl ?? "",
      transmissionType: initial?.transmissionType ?? "",
      durationSeconds: initial?.durationSeconds ?? "",
    });
  }, [initial]);

  async function save() {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error("Title and slug required.");
      return;
    }
    if (!window.confirm(form.id ? "Save this transmission?" : "Create this transmission?")) {
      return;
    }
    setBusy(true);
    try {
      await upsert({
        id: form.id,
        title: form.title,
        slug: form.slug,
        description: form.description,
        videoUrl: form.videoUrl || undefined,
        audioUrl: form.audioUrl || undefined,
        transmissionType: form.transmissionType || undefined,
        durationSeconds: form.durationSeconds
          ? Number(form.durationSeconds)
          : undefined,
      });
      toast.success(form.id ? "Saved." : "Created.");
      onClose();
    } catch {
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={form.id ? "Edit transmission" : "New transmission"}
      onClose={onClose}
    >
      {form.id ? (
        <div className="mb-4 flex flex-col gap-4">
          <CoverPicker
            kind="transmission"
            rowId={form.id}
            currentStorageId={initial?.coverStorageId ?? null}
            currentUrl={initial?.coverUrl ?? null}
          />
          <FilePicker
            kind="video"
            rowId={form.id}
            currentStorageId={initial?.fileStorageId ?? null}
            currentFileName={initial?.fileMeta?.fileName ?? null}
            currentUrl={initial?.fileUrl ?? null}
            currentByteSize={initial?.fileMeta?.byteSize ?? null}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        <FieldRow
          label="Title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
        />
        <FieldRow
          label="Slug"
          value={form.slug}
          onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
        />
        <FieldRow
          label="Description"
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          maxLength={480}
          rows={3}
        />
        <FieldRow
          label="Video URL (optional — external YouTube/Vimeo/link)"
          value={form.videoUrl}
          onChange={(v) => setForm((f) => ({ ...f, videoUrl: v }))}
          placeholder="https://…"
        />
        <FieldRow
          label="Audio URL (optional — podcast episode: direct mp3/ogg/m4a link)"
          value={form.audioUrl}
          onChange={(v) => setForm((f) => ({ ...f, audioUrl: v }))}
          placeholder="https://…/episode.mp3"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectRow
            label="Type"
            value={form.transmissionType}
            options={["", ...TRANSMISSION_TYPES]}
            onChange={(v) =>
              setForm((f) => ({ ...f, transmissionType: v }))
            }
          />
          <FieldRow
            label="Duration (seconds)"
            value={String(form.durationSeconds ?? "")}
            onChange={(v) =>
              setForm((f) => ({ ...f, durationSeconds: v }))
            }
            type="number"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <NeonButton variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </NeonButton>
        <NeonButton
          variant="primary"
          onClick={save}
          loading={busy}
          disabled={busy}
        >
          {form.id ? "Save changes" : "Create transmission"}
        </NeonButton>
      </div>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

function ResourcesPanel({ onEdit }: { onEdit: (e: any) => void }) {
  const items = useQuery(api.content.listResources, { limit: 100 });
  const archive = useMutation(api.admin.archiveResource);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (items === undefined) return [];
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.resourceType ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <section aria-labelledby="deskresources">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="deskresources" className="text-xl font-semibold">
          Resources
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          <NeonButton
            variant="primary"
            onClick={() => onEdit({ id: undefined })}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            New resource
          </NeonButton>
        </div>
      </header>
      <HoloCard>
        {items === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : filtered.length === 0 ? (
          <p className="uf-empty">No resources match.</p>
        ) : (
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {filtered.map((r) => (
              <li
                key={r._id}
                className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{r.title}</p>
                  <p className="text-uf-muted text-xs flex flex-wrap gap-2 mt-1">
                    {r.resourceType ? (
                      <StatusPill variant="info">{r.resourceType}</StatusPill>
                    ) : null}
                    {r.tierRequired ? (
                      <StatusPill
                        variant={tierPillVariant(r.tierRequired as any)}
                      >
                        Tier · {tierLabel(r.tierRequired as any)}
                      </StatusPill>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <NeonButton variant="ghost" onClick={() => onEdit(r)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Delete resource "${r.title}"?`))
                        archive({ id: r._id })
                          .then(() => toast.success("Deleted."))
                          .catch(() => toast.error("Delete failed."));
                    }}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                  </NeonButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HoloCard>
    </section>
  );
}

function ResourceEditorModal({
  initial,
  onClose,
}: {
  initial: any;
  onClose: () => void;
}) {
  const upsert = useMutation(api.admin.upsertResource);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    url: initial?.url ?? "",
    resourceType: initial?.resourceType ?? "",
    tierRequired: initial?.tierRequired ?? "",
  });
  useEffect(() => {
    setForm({
      id: initial?.id,
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      description: initial?.description ?? "",
      url: initial?.url ?? "",
      resourceType: initial?.resourceType ?? "",
      tierRequired: initial?.tierRequired ?? "",
    });
  }, [initial]);

  async function save() {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error("Title and slug required.");
      return;
    }
    if (!window.confirm(form.id ? "Save this resource?" : "Create this resource?")) {
      return;
    }
    setBusy(true);
    try {
      await upsert({
        id: form.id,
        title: form.title,
        slug: form.slug,
        description: form.description,
        url: form.url || undefined,
        resourceType: form.resourceType || undefined,
        tierRequired: (form.tierRequired as any) || undefined,
      });
      toast.success(form.id ? "Saved." : "Created.");
      onClose();
    } catch {
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={form.id ? "Edit resource" : "New resource"}
      onClose={onClose}
    >
      {form.id ? (
        <div className="mb-4">
          <FilePicker
            kind="document"
            rowId={form.id}
            currentStorageId={initial?.fileStorageId ?? null}
            currentFileName={initial?.fileMeta?.fileName ?? null}
            currentUrl={initial?.fileUrl ?? null}
            currentByteSize={initial?.fileMeta?.byteSize ?? null}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        <FieldRow
          label="Title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
        />
        <FieldRow
          label="Slug"
          value={form.slug}
          onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
        />
        <FieldRow
          label="Description"
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          maxLength={320}
          rows={3}
        />
        <FieldRow
          label="URL (optional — external link instead of an uploaded file)"
          value={form.url}
          onChange={(v) => setForm((f) => ({ ...f, url: v }))}
          placeholder="https://…"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectRow
            label="Type"
            value={form.resourceType}
            options={["", ...RESOURCE_TYPES]}
            onChange={(v) =>
              setForm((f) => ({ ...f, resourceType: v }))
            }
          />
          <SelectRow
            label="Tier required"
            value={form.tierRequired}
            options={["", ...TIER_ORDER]}
            onChange={(v) =>
              setForm((f) => ({ ...f, tierRequired: v }))
            }
            renderOption={(v) =>
              v === "" ? "Any tier" : tierLabel(v as any)
            }
            renderSelected={(v) =>
              v === "" ? "Any tier" : (
                <StatusPill variant={tierPillVariant(v as any)}>
                  {tierLabel(v as any)}
                </StatusPill>
              )
            }
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <NeonButton variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </NeonButton>
        <NeonButton
          variant="primary"
          onClick={save}
          loading={busy}
          disabled={busy}
        >
          {form.id ? "Save changes" : "Create resource"}
        </NeonButton>
      </div>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// Missions
// -----------------------------------------------------------------------------

function MissionsPanel({ onEdit }: { onEdit: (e: any) => void }) {
  const items = useQuery(api.content.listMissions, { limit: 200 });
  const archive = useMutation(api.admin.archiveMission);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (items === undefined) return [];
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.location ?? "").toLowerCase().includes(q) ||
        (m.missionStatus ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <section aria-labelledby="deskmissions">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="deskmissions" className="text-xl font-semibold">
          Missions
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          <NeonButton
            variant="primary"
            onClick={() => onEdit({ id: undefined })}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            New mission
          </NeonButton>
        </div>
      </header>
      <HoloCard>
        {items === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : filtered.length === 0 ? (
          <p className="uf-empty">No missions match.</p>
        ) : (
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {filtered.map((m) => (
              <li
                key={m._id}
                className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{m.title}</p>
                  <p className="text-uf-muted text-xs flex flex-wrap gap-2 mt-1">
                    <StatusPill
                      variant={MISSION_STATUS_VARIANT[m.missionStatus ?? ""] ?? "default"}
                    >
                      {MISSION_STATUS_LABEL[m.missionStatus ?? ""] ?? m.missionStatus}
                    </StatusPill>
                    {m.xpReward ? (
                      <StatusPill variant="gold">+{m.xpReward.toLocaleString()} XP</StatusPill>
                    ) : null}
                    {m.tierRequired ? (
                      <StatusPill variant={tierPillVariant(m.tierRequired as any)}>
                        Tier · {tierLabel(m.tierRequired as any)}
                      </StatusPill>
                    ) : null}
                    {m.location ? (
                      <StatusPill variant="info">{m.location}</StatusPill>
                    ) : null}
                    {m.objectives?.length ? (
                      <StatusPill variant="default">
                        {m.objectives.length} objective{m.objectives.length === 1 ? "" : "s"}
                      </StatusPill>
                    ) : null}
                    {m.briefing ? (
                      <StatusPill variant="violet">Briefed</StatusPill>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <NeonButton variant="ghost" onClick={() => onEdit(m)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Archive mission "${m.title}"? This removes the briefing from the public ops board.`))
                        archive({ id: m._id })
                          .then(() => toast.success("Archived."))
                          .catch(() => toast.error("Archive failed."));
                    }}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                  </NeonButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HoloCard>
    </section>
  );
}

function MissionEditorModal({
  initial,
  onClose,
}: {
  initial: any;
  onClose: () => void;
}) {
  const upsert = useMutation(api.admin.upsertMission);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    missionStatus: initial?.missionStatus ?? "active",
    xpReward: initial?.xpReward != null ? String(initial.xpReward) : "",
    tierRequired: initial?.tierRequired ?? "",
    location: initial?.location ?? "",
    durationLabel: initial?.durationLabel ?? "",
    briefing: initial?.briefing ?? "",
    objectives:
      Array.isArray(initial?.objectives) && initial.objectives.length
        ? initial.objectives
        : [""],
    reportGuidance: initial?.reportGuidance ?? "",
  });
  useEffect(() => {
    setForm({
      id: initial?.id,
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      description: initial?.description ?? "",
      missionStatus: initial?.missionStatus ?? "active",
      xpReward: initial?.xpReward != null ? String(initial.xpReward) : "",
      tierRequired: initial?.tierRequired ?? "",
      location: initial?.location ?? "",
      durationLabel: initial?.durationLabel ?? "",
      briefing: initial?.briefing ?? "",
      objectives:
        Array.isArray(initial?.objectives) && initial.objectives.length
          ? initial.objectives
          : [""],
      reportGuidance: initial?.reportGuidance ?? "",
    });
  }, [initial]);

  async function save() {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error("Title and slug required.");
      return;
    }
    if (!window.confirm(form.id ? "Save this briefing?" : "Create this mission briefing?")) {
      return;
    }
    setBusy(true);
    try {
      await upsert({
        id: form.id,
        title: form.title,
        slug: form.slug,
        description: form.description,
        missionStatus: form.missionStatus,
        xpReward: form.xpReward ? Number(form.xpReward) : undefined,
        tierRequired: (form.tierRequired as any) || undefined,
        location: form.location || undefined,
        durationLabel: form.durationLabel || undefined,
        briefing: form.briefing,
        objectives: form.objectives
          .map((o: string) => o.trim())
          .filter((o: string) => o.length > 0),
        reportGuidance: form.reportGuidance || undefined,
      });
      toast.success(form.id ? "Saved." : "Created.");
      onClose();
    } catch {
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={form.id ? "Edit mission briefing" : "New mission briefing"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow
            label="Title"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          />
          <FieldRow
            label="Slug"
            value={form.slug}
            onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
          />
        </div>
        <FieldRow
          label="Description"
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          maxLength={480}
          rows={2}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectRow
            label="Status"
            value={form.missionStatus}
            options={[...MISSION_STATUSES]}
            onChange={(v) => setForm((f) => ({ ...f, missionStatus: v }))}
            renderOption={(v) => MISSION_STATUS_LABEL[v] ?? v}
            renderSelected={(v) => (
              <StatusPill variant={MISSION_STATUS_VARIANT[v] ?? "default"}>
                {MISSION_STATUS_LABEL[v] ?? v}
              </StatusPill>
            )}
          />
          <FieldRow
            label="XP reward"
            value={form.xpReward}
            onChange={(v) => setForm((f) => ({ ...f, xpReward: v }))}
            type="number"
          />
          <SelectRow
            label="Clearance"
            value={form.tierRequired}
            options={["", ...TIER_ORDER]}
            onChange={(v) => setForm((f) => ({ ...f, tierRequired: v }))}
            renderOption={(v) =>
              v === "" ? "Any tier" : tierLabel(v as any)
            }
            renderSelected={(v) =>
              v === "" ? null : (
                <StatusPill variant={tierPillVariant(v as any)}>
                  {tierLabel(v as any)}
                </StatusPill>
              )
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow
            label="Location"
            value={form.location}
            onChange={(v) => setForm((f) => ({ ...f, location: v }))}
            placeholder="e.g. Outer Belt, Sector 7"
          />
          <FieldRow
            label="Duration"
            value={form.durationLabel}
            onChange={(v) => setForm((f) => ({ ...f, durationLabel: v }))}
            placeholder="e.g. 2 standard cycles"
          />
        </div>
        <FieldRow
          label="Situation briefing"
          value={form.briefing}
          onChange={(v) => setForm((f) => ({ ...f, briefing: v }))}
          rows={8}
        />
        <fieldset className="border border-[color:var(--uf-border)] rounded-md p-3">
          <legend className="text-xs uppercase tracking-[0.16em] text-uf-muted px-1 flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5" aria-hidden /> Objectives
          </legend>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {form.objectives.map((o: string, i: number) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-uf-muted text-xs font-mono w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input
                  value={o}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.objectives];
                      next[i] = e.target.value;
                      return { ...f, objectives: next };
                    })
                  }
                  placeholder="Objective"
                  className="w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                />
                <button
                  type="button"
                  aria-label={`Remove objective ${i + 1}`}
                  className="uf-btn uf-btn--ghost p-1.5 shrink-0"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      objectives: f.objectives.filter(
                        (_: string, j: number) => j !== i,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="uf-btn uf-btn--ghost mt-2"
            onClick={() =>
              setForm((f) => ({ ...f, objectives: [...f.objectives, ""] }))
            }
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden />
            Add objective
          </button>
        </fieldset>
        <FieldRow
          label="Report guidance"
          value={form.reportGuidance}
          onChange={(v) => setForm((f) => ({ ...f, reportGuidance: v }))}
          rows={3}
          placeholder="What a good field report includes — shown to members before they report in."
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <NeonButton variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </NeonButton>
        <NeonButton
          variant="primary"
          onClick={save}
          loading={busy}
          disabled={busy}
        >
          {form.id ? "Save changes" : "Create briefing"}
        </NeonButton>
      </div>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// Shared modal primitives
// -----------------------------------------------------------------------------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,22,0.66)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="uf-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <header className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            type="button"
            aria-label="Close"
            className="uf-btn uf-btn--ghost"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  type,
  rows,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="block text-xs uppercase tracking-[0.16em] text-uf-muted">
      {label}
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] font-mono"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type ?? "text"}
          maxLength={maxLength}
          placeholder={placeholder}
          className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        />
      )}
    </label>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
  renderOption,
  renderSelected,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  renderOption?: (v: string) => string;
  renderSelected?: (v: string) => ReactNode;
}) {
  return (
    <label className="block text-xs uppercase tracking-[0.16em] text-uf-muted">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {renderOption ? renderOption(o) : o || "—"}
            </option>
          ))}
        </select>
        {renderSelected && value ? (
          <span className="shrink-0">{renderSelected(value)}</span>
        ) : null}
      </div>
    </label>
  );
}
