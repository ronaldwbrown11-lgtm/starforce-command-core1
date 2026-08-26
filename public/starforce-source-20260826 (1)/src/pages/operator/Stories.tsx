import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { CanonScanPanel } from "@/components/operator/CanonScanPanel";
import { BatchCanonRescan } from "@/components/operator/BatchCanonRescan";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  StickyNote,
  User,
} from "lucide-react";

type AttachmentMeta = {
  fileName: string;
  mimeType: string;
  byteSize: number;
};

type ReviewAction = "approve" | "request_changes" | "reject" | "schedule";

const TEXT_MIME = new Set(["text/plain", "text/markdown"]);
const PDF_MIME = "application/pdf";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Inline reader for plain-text / markdown manuscripts: fetches the storage
 * URL and renders the body so the reviewer can read it without leaving the
 * desk. Falls back to the download link if the fetch is blocked by CORS.
 */
function ManuscriptText({ url, meta }: { url: string; meta: AttachmentMeta }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.text();
        if (!cancelled) setText(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="mt-2">
      {text !== null ? (
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-uf-text/90 max-h-[45vh] overflow-y-auto rounded-md border border-[color:var(--uf-border)] bg-[rgba(4,8,15,0.6)] p-4 font-sans">
          {text}
        </pre>
      ) : failed ? (
        <p className="text-xs text-uf-muted">
          Inline preview unavailable (file blocked preview).{" "}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download={meta.fileName}
            className="text-uf-cyan hover:underline"
          >
            Open file instead
          </a>
          .
        </p>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-uf-muted text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading manuscript text…
        </span>
      )}
    </div>
  );
}

function ManuscriptLink({
  storageId,
  meta,
}: {
  storageId: Id<"_storage">;
  meta?: AttachmentMeta;
}) {
  const url = useQuery(
    api.assets.coverUrl,
    storageId ? { storageId } : "skip",
  );
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1 text-uf-muted text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading manuscript…
      </span>
    );
  }
  const isText = meta ? TEXT_MIME.has(meta.mimeType) : false;
  const isPdf = meta?.mimeType === PDF_MIME;

  // Plain text / markdown: read inline right here on the desk.
  if (isText && meta) {
    return (
      <div>
        <p className="flex items-center gap-1.5 text-sm text-uf-cyan">
          <FileText className="h-4 w-4 shrink-0" aria-hidden />
          Manuscript · {meta.fileName} ({formatBytes(meta.byteSize)})
        </p>
        <ManuscriptText url={url} meta={meta} />
      </div>
    );
  }

  // PDF: open in a new tab so the reviewer can actually read it.
  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-uf-cyan hover:underline text-sm"
      >
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
        Open manuscript
        {meta?.fileName ? ` · ${meta.fileName}` : ""}
      </a>
    );
  }

  // DOC / DOCX / unknown: download.
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={meta?.fileName ?? true}
      className="inline-flex items-center gap-1.5 text-uf-cyan hover:underline text-sm"
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      Download manuscript
      {meta?.fileName ? ` · ${meta.fileName}` : ""}
    </a>
  );
}

export default function OperatorStoryApproval() {
  const items = useQuery(api.operator.storyApprovalQueue, { limit: 25 });
  const act = useMutation(api.operator.storyApprovalAction);
  const [pending, setPending] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const authorIds = useMemo(
    () => Array.from(new Set((items ?? []).map((s) => s.authorId))),
    [items],
  );
  const names = useQuery(
    api.operator.userDisplayNames,
    authorIds.length ? { ids: authorIds } : "skip",
  );

  async function doAction(
    id: Id<"stories">,
    action: ReviewAction,
    note?: string,
  ) {
    setPending(`${id}_${action}`);
    try {
      await act({ id, action, note: note?.trim() || undefined });
      toast.success(
        action === "approve"
          ? "Story published to the archive."
          : action === "reject"
            ? "Submission rejected."
            : action === "request_changes"
              ? "Changes requested — note sent to the author."
              : "Story scheduled for publication.",
      );
      setNotes((prev) => ({ ...prev, [id]: "" }));
      setNotesOpen((open) => (open === id ? null : open));
    } catch {
      toast.error("Action failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="uf-eyebrow">Operator Console</span>
            <h1 className="text-3xl font-semibold mt-2">Story Approval</h1>
          </div>
          <BatchCanonRescan />
        </div>
        <p className="text-uf-muted text-sm mt-1">
          Workflow: draft → submitted → in_review → changes_requested → approved → published → archived.
          Open <span className="text-uf-cyan">Read story</span> to review the full text and any attached
          manuscript before deciding.
        </p>
      </header>
      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 220 }} />
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">No pending submissions.</div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {items.map((s) => {
            const isReading = reading === s._id;
            const showNotes = notesOpen === s._id;
            const note = notes[s._id] ?? "";
            return (
              <li key={s._id}>
                <HoloCard>
                  <div className="flex items-start justify-between mb-2 gap-4">
                    <div className="min-w-0">
                      <span className="uf-eyebrow">Story</span>
                      <h3 className="text-lg mt-1">{s.title}</h3>
                      <p className="text-uf-muted text-xs mt-1">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" aria-hidden />
                          {names ? (names[s.authorId] ?? "Author") : "…"}
                        </span>
                        {"  •  "}
                        Series: {s.series ?? "—"} • {(s.factions ?? []).join(", ") || "—"} •{" "}
                        Submitted:{" "}
                        {s.submittedAt
                          ? new Date(s.submittedAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                    <StatusPill variant="info">{s.status}</StatusPill>
                  </div>
                  <p className="text-sm text-uf-muted mt-2">{s.excerpt}</p>

                  <CanonScanPanel scan={s.canonScan} kind="story" id={s._id} />

                  {/* Full-text reader */}
                  {isReading ? (
                    <div className="mt-4 rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] p-5">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(s.tags ?? []).map((t: string) => (
                          <StatusPill key={t} variant="default">
                            #{t}
                          </StatusPill>
                        ))}
                        {s.classification ? (
                          <StatusPill variant="warning">{s.classification}</StatusPill>
                        ) : null}
                        {s.readMinutes ? (
                          <StatusPill variant="default">~{s.readMinutes} min read</StatusPill>
                        ) : null}
                        {(s.sectors ?? []).slice(0, 3).map((sec: string) => (
                          <StatusPill key={sec} variant="violet">
                            {sec}
                          </StatusPill>
                        ))}
                      </div>
                      {s.content?.trim() ? (
                        <article
                          className="whitespace-pre-wrap text-sm leading-relaxed text-uf-text/90 max-h-[60vh] overflow-y-auto pr-2"
                          aria-label={`Full text of ${s.title}`}
                        >
                          {s.content}
                        </article>
                      ) : (
                        <div className="uf-empty">
                          No pasted content — this submission used a manuscript file only.
                        </div>
                      )}
                      {s.attachmentStorageId ? (
                        <div className="mt-4 pt-3 border-t border-[color:var(--uf-border)]">
                          <ManuscriptLink
                            storageId={s.attachmentStorageId}
                            meta={s.attachmentMeta}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Review note input */}
                  {showNotes ? (
                    <div className="mt-3 rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] p-3">
                      <label
                        htmlFor={`note-${s._id}`}
                        className="text-[11px] uppercase tracking-[0.16em] text-uf-muted flex items-center gap-1.5"
                      >
                        <StickyNote className="h-3.5 w-3.5" aria-hidden />
                        Review note (attached to your next action)
                      </label>
                      <textarea
                        id={`note-${s._id}`}
                        value={note}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [s._id]: e.target.value }))
                        }
                        rows={2}
                        placeholder={
                          s.status === "submitted" || s.status === "in_review"
                            ? "e.g. Great premise — tighten act two, then resubmit."
                            : "Optional note for the author…"
                        }
                        className="mt-2 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-3 py-2 text-sm resize-y"
                      />
                      <p className="text-[11px] text-uf-muted mt-1">
                        {note.trim()
                          ? "The note is written to the audit log and included in the author's notification."
                          : "Empty note = no feedback attached."}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 mt-3">
                    <NeonButton
                      variant="ghost"
                      onClick={() => setReading(isReading ? null : s._id)}
                    >
                      <BookOpen className="h-4 w-4 mr-1.5" aria-hidden />
                      {isReading ? "Close reader" : "Read story"}
                      {isReading ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1" aria-hidden />
                      )}
                    </NeonButton>
                    <NeonButton
                      variant="ghost"
                      onClick={() => setNotesOpen(showNotes ? null : s._id)}
                    >
                      <StickyNote className="h-4 w-4 mr-1.5" aria-hidden />
                      {showNotes ? "Hide note" : note.trim() ? "Edit note" : "Add note"}
                    </NeonButton>
                    <NeonButton
                      variant="primary"
                      disabled={pending === `${s._id}_approve`}
                      onClick={() => doAction(s._id, "approve", note)}
                    >
                      Approve
                    </NeonButton>
                    <NeonButton
                      variant="ghost"
                      disabled={pending === `${s._id}_request_changes`}
                      onClick={() => doAction(s._id, "request_changes", note)}
                    >
                      Request Changes
                    </NeonButton>
                    <NeonButton
                      variant="danger"
                      disabled={pending === `${s._id}_reject`}
                      onClick={async () => {
                        if (
                          window.confirm(
                            "Reject this submission? This will be audit-logged" +
                              (note.trim() ? " with your note" : ""),
                          )
                        ) {
                          await doAction(s._id, "reject", note);
                        }
                      }}
                    >
                      Reject
                    </NeonButton>
                    <NeonButton
                      variant="violet"
                      disabled={pending === `${s._id}_schedule`}
                      onClick={async () => {
                        if (
                          window.confirm(
                            "Schedule this story for future publication?",
                          )
                        ) {
                          await doAction(s._id, "schedule", note);
                        }
                      }}
                    >
                      Schedule
                    </NeonButton>
                  </div>
                </HoloCard>
              </li>
            );
          })}
        </ul>
      )}
    </OperatorShell>
  );
}
