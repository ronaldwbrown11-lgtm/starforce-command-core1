import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { SiteShell, PageHero, HoloCard, NeonButton } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router";
import { toast } from "sonner";
import { parseOverageError, type OveragePayload } from "@/lib/tiers";
import { OverageConfirmDialog } from "@/components/usage/OverageConfirmDialog";
import { FileText, Loader2, X } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
const MANUSCRIPT_MAX_BYTES = 15 * 1024 * 1024;
const MANUSCRIPT_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

type ManuscriptAttachment = {
  storageId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Submit() {
  const { isAuthenticated } = useAuth();
  const submit = useMutation(api.operator.submitStory);
  const generateUserUploadUrl = useMutation(api.users.generateUserUploadUrl);
  const previewAi = useQuery(api.usage.previewAiGeneration, { count: 1 });
  const consumeAi = useMutation(api.usage.consumeAi);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [series, setSeries] = useState("");
  const [factions, setFactions] = useState("");
  const [overage, setOverage] = useState<OveragePayload | null>(null);
  const [overageOpen, setOverageOpen] = useState(false);
  const [busy, setBusy] = useState<"preview" | "consume" | "submit" | null>(null);
  const [pendingConfirmPayload, setPendingConfirmPayload] =
    useState<OveragePayload | null>(null);
  const [manuscript, setManuscript] = useState<ManuscriptAttachment | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManuscriptFile = useCallback(
    async (file: File) => {
      if (file.size > MANUSCRIPT_MAX_BYTES) {
        toast.error(`File is ${(file.size / (1024 * 1024)).toFixed(1)} MB; max 15 MB.`);
        return;
      }
      if (!MANUSCRIPT_MIME.includes(file.type)) {
        toast.error("Unsupported file type. Use PDF, DOC, DOCX, TXT, or MD.");
        return;
      }
      try {
        setFileBusy(true);
        const url = await generateUserUploadUrl({ purpose: "manuscript" });
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: string };
        setManuscript({
          storageId,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
        });
        toast.success("Manuscript attached.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setFileBusy(false);
      }
    },
    [generateUserUploadUrl],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!title.trim()) {
        toast.error("Title is required.");
        return;
      }
      if (!content.trim() && !manuscript) {
        toast.error("Add story content or attach a manuscript file.");
        return;
      }

      // 1. Live preview (read-only) tells the user up front if the action will overage.
      if (previewAi && previewAi.wouldExceed) {
        setPendingConfirmPayload({
          code: "ultraforce_overage_requires_confirm",
          kind: "ai",
          current: previewAi.current,
          projected: previewAi.projected,
          cap: previewAi.cap,
          tier: previewAi.tier,
        });
        setOverageOpen(true);
        return;
      }

      // 2. Otherwise consume normally. If the consume throws overage despite the
      //    preview reading clean (e.g., a race with another action), surface the
      //    same dialog so the user can confirm.
      await consumeAndSubmit({ confirmOverage: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, excerpt, content, series, factions, previewAi, manuscript],
  );

  const consumeAndSubmit = useCallback(
    async (opts: { confirmOverage: boolean }) => {
      try {
        setBusy("consume");
        await consumeAi({ count: 1, confirmOverage: opts.confirmOverage });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed.";
        const parsed = parseOverageError(msg);
        if (parsed && !opts.confirmOverage) {
          setPendingConfirmPayload(parsed);
          setOverageOpen(true);
          setBusy(null);
          return;
        }
        toast.error("Failed to record AI generation.");
        setBusy(null);
        return;
      }
      await performSubmit();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, excerpt, content, series, factions, manuscript],
  );

  const performSubmit = useCallback(async () => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    try {
      setBusy("submit");
      await submit({
        title,
        slug,
        excerpt,
        content,
        series: series || undefined,
        factions: factions
          ? factions.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        classification: "open",
        tags: [],
        attachmentStorageId: manuscript ? (manuscript.storageId as any) : undefined,
        attachmentMeta: manuscript
          ? {
              fileName: manuscript.fileName,
              mimeType: manuscript.mimeType,
              byteSize: manuscript.byteSize,
            }
          : undefined,
      });
      toast.success("Submission received. You'll hear back within a week.");
      setTitle("");
      setExcerpt("");
      setContent("");
      setSeries("");
      setFactions("");
      setManuscript(null);
    } catch (err) {
      toast.error("Submission failed.");
    } finally {
      setBusy(null);
    }
  }, [submit, title, excerpt, content, series, factions, manuscript]);

  async function handleConfirmOverage() {
    setOverageOpen(false);
    const payload = pendingConfirmPayload;
    if (!payload) return;
    setPendingConfirmPayload(null);
    setOverage({
      code: payload.code,
      kind: payload.kind,
      current: payload.current,
      projected: payload.projected,
      cap: payload.cap,
      tier: payload.tier,
    });
    await consumeAndSubmit({ confirmOverage: true });
    setOverage(null);
  }
  usePageMeta({ title: "Submit Story — Star Force Base 1198", description: "Submit your story for review by the editorial team.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Submit"
        title="Transmit your story."
        lead="Paste your story below or attach a manuscript (PDF, DOC, DOCX, TXT, MD — up to 15 MB). Submissions land in the operator review queue."
        primary={{ label: "Back to stories", href: "/stories", variant: "ghost" }}
        secondary={{ label: "Your account", href: "/account", variant: "ghost" }}
      />
      <section className="uf-section max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12">
        {!isAuthenticated ? (
          <HoloCard>
            <p className="text-uf-muted text-sm">
              Sign in to submit a story.{" "}
              <Link to="/auth" className="text-uf-cyan">Open auth</Link>.
            </p>
          </HoloCard>
        ) : (
          <>
            <HoloCard>
              <form
                className="grid gap-3"
                onSubmit={handleSubmit}
                data-uf-form="story-submit"
              >
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Excerpt
                  <input
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="One or two sentences."
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                    Series
                    <input
                      value={series}
                      onChange={(e) => setSeries(e.target.value)}
                      placeholder="Helion Files"
                      className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                    Factions (comma separated)
                    <input
                      value={factions}
                      onChange={(e) => setFactions(e.target.value)}
                      placeholder="Terran Reach, Helion Verge"
                      className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                    />
                  </label>
                </div>
                <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-4 bg-[rgba(16,24,39,0.35)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={MANUSCRIPT_MIME.join(",")}
                      aria-label="Upload manuscript"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleManuscriptFile(file);
                        e.target.value = "";
                      }}
                    />
                    <NeonButton
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fileBusy}
                    >
                      {fileBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading…
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" aria-hidden /> Attach manuscript
                        </>
                      )}
                    </NeonButton>
                    <span className="text-uf-muted text-[11px] uppercase tracking-[0.16em]">
                      PDF · DOC · DOCX · TXT · MD · ≤ 15 MB
                    </span>
                  </div>
                  {manuscript ? (
                    <p
                      className="mt-3 flex items-center justify-between gap-2 rounded-md border border-[color:var(--uf-border)] px-3 py-2 text-sm"
                      role="status"
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <FileText className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
                        <span className="truncate">{manuscript.fileName}</span>
                        <span className="text-uf-muted shrink-0">
                          ({formatBytes(manuscript.byteSize)})
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Remove manuscript"
                        className="text-uf-muted hover:text-uf-red shrink-0"
                        onClick={() => setManuscript(null)}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </p>
                  ) : null}
                </div>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Content (optional if a manuscript is attached)
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] min-h-48"
                  />
                </label>
                {previewAi ? (
                  <p className="text-xs text-uf-muted" role="status" aria-live="polite">
                    Drafts: {previewAi.current.toLocaleString()} /{" "}
                    {previewAi.cap < 0 ? "∞" : previewAi.cap.toLocaleString()} (
                    {previewAi.cap < 0
                      ? 0
                      : Math.min(
                          999,
                          Math.round((previewAi.current / Math.max(1, previewAi.cap)) * 100),
                        )}
                    %) used this period.
                  </p>
                ) : null}
                <NeonButton
                  variant="primary"
                  type="submit"
                  loading={busy !== null}
                  disabled={busy !== null}
                >
                  Submit Story
                </NeonButton>
              </form>
            </HoloCard>
            <p className="text-uf-muted text-xs mt-4">
              Submissions count against your monthly AI generation cap; approaching
              the cap prompts a confirm step. Reviewers see your manuscript on the
              Story Approval desk.
            </p>
          </>
        )}
      </section>

      <OverageConfirmDialog
        payload={pendingConfirmPayload ?? overage}
        open={overageOpen}
        onOpenChange={(o) => {
          setOverageOpen(o);
          if (!o) setPendingConfirmPayload(null);
        }}
        onConfirm={async () => {
          await handleConfirmOverage();
        }}
        confirming={busy === "consume"}
      />
    </SiteShell>
  );
}
