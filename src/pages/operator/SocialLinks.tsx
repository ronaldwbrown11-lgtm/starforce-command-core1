import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { ExternalLink, GripVertical, Plus, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

const ICON_OPTIONS = [
  "twitter", "facebook", "instagram", "youtube", "discord",
  "github", "linkedin", "twitch", "reddit", "globe", "mail", "link",
];

export default function SocialLinksPage() {
  const links = useQuery(api.socialLinks.listAll);
  const createLink = useMutation(api.socialLinks.create);
  const updateLink = useMutation(api.socialLinks.update);
  const removeLink = useMutation(api.socialLinks.remove);

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("globe");

  if (links === undefined) {
    return (
      <OperatorShell>
        <div className="p-6"><div className="uf-skeleton" style={{ height: 200 }} /></div>
      </OperatorShell>
    );
  }

  const handleCreate = async () => {
    if (!label.trim() || !url.trim()) {
      toast.error("Label and URL are required");
      return;
    }
    await createLink({
      label: label.trim(),
      url: url.trim(),
      icon,
      order: links.length,
      enabled: true,
    });
    setLabel("");
    setUrl("");
    setIcon("globe");
    toast.success("Social link created");
  };

  const toggleEnabled = async (id: Id<"socialLinks">, current: boolean) => {
    await updateLink({ id, enabled: !current });
  };

  const handleDelete = async (id: Id<"socialLinks">) => {
    await removeLink({ id });
    toast.success("Social link deleted");
  };

  return (
    <OperatorShell>
      <div className="p-6 max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <a href="/" className="inline-flex min-h-[88px] items-center gap-3 rounded-md border border-cyan-700/50 bg-cyan-950/40 px-8 text-lg font-bold text-cyan-100 transition-colors hover:bg-cyan-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Return to public site
          </a>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Social Links</h1>
        <p className="text-uf-muted text-sm mb-6">
          Manage the social/community links shown in the site footer. Toggle visibility without deleting.
        </p>

        {/* Create form */}
        <HoloCard className="mb-6">
          <h2 className="uf-eyebrow mb-3">Add new link</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
            <label className="text-xs uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
              Label
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Discord"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
              URL
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://discord.gg/..."
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
              Icon
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              >
                {ICON_OPTIONS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </label>
            <NeonButton variant="primary" onClick={handleCreate} className="h-20 w-20 min-h-20 min-w-20 rounded-full p-0 text-[0px]" aria-label="Add social link" title="Add social link">
              <Plus className="h-9 w-9" aria-hidden /><span className="sr-only">Add link</span>
            </NeonButton>
          </div>
        </HoloCard>

        {/* Existing links */}
        <h2 className="uf-eyebrow mb-3">Current links ({links.length})</h2>
        {links.length === 0 ? (
          <div className="uf-empty">No social links configured yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <div
                key={link._id}
                className="uf-card !p-4 flex items-center gap-3"
              >
                <GripVertical className="h-4 w-4 text-uf-muted shrink-0" />
                <span className="text-sm font-medium text-uf-text min-w-[80px]">{link.label}</span>
                <span className="text-xs text-uf-muted truncate flex-1">{link.url}</span>
                <StatusPill variant={link.enabled ? "success" : "default"}>
                  {link.icon}
                </StatusPill>
                <button
                  type="button"
                  onClick={() => toggleEnabled(link._id, link.enabled)}
                  className={`uf-btn uf-btn--ghost text-xs ${link.enabled ? "text-uf-green" : "text-uf-muted"}`}
                >
                  {link.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(link._id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  aria-label={`Delete ${link.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </OperatorShell>
  );
}
