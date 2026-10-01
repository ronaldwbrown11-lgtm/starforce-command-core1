import { useEffect, useState } from "react";
import { Download, FileText, Loader2, ExternalLink, X } from "lucide-react";

// =========================================================================
// DocViewer — opens a document ON THE PAGE instead of downloading it.
//
// The file is fetched as a blob (defeating any Content-Disposition:
// attachment on the URL) and rendered inside an inline <iframe>, so PDFs,
// images, and text files read right where the member is. Formats that
// can't preview (DOC/DOCX/…) fall back to open-in-new-tab + download
// links. Used by the Resources cards and the Cadets Manual guide.
// =========================================================================

const PREVIEWABLE = (type: string, name: string): boolean => {
  if (type) {
    if (
      type.startsWith("application/pdf") ||
      type.startsWith("image/") ||
      type.startsWith("text/") ||
      type === "application/json"
    ) {
      return true;
    }
    // Some storage backends serve PDFs as octet-stream — sniff the name.
  }
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ["pdf", "png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "txt", "md", "csv", "json"].includes(ext);
};

export function DocViewer({
  url,
  fileName,
  onClose,
}: {
  url: string | null;
  fileName?: string | null;
  onClose: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported" | "error">("loading");

  // Fetch as blob so the document renders inline — never force-downloads.
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let created: string | null = null;
    setStatus("loading");
    setObjectUrl(null);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const name = fileName ?? url;
        if (!PREVIEWABLE(blob.type, name)) {
          if (!cancelled) setStatus("unsupported");
          return;
        }
        created = URL.createObjectURL(blob);
        if (!cancelled) {
          setObjectUrl(created);
          setStatus("ready");
        } else {
          URL.revokeObjectURL(created);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, fileName]);

  // Escape closes.
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden bg-black/75 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={fileName ?? "Document viewer"}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl min-h-0 h-[calc(100vh-1.5rem)] sm:h-[calc(100vh-3rem)] max-h-full rounded-xl border border-[color:var(--uf-border)] bg-[#0a1020] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-[color:var(--uf-border)]">
          <FileText className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
          <span className="text-sm font-medium truncate min-w-0 flex-1">
            {fileName ?? "Document"}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-uf-muted hover:text-uf-cyan transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">New tab</span>
          </a>
          <a
            href={url}
            download
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-uf-muted hover:text-uf-cyan transition-colors"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">Download</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document"
            className="ml-1 shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text transition-colors"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="p-3 min-h-0 flex-1 overflow-auto">
          {status === "loading" ? (
            <div className="grid place-items-center h-full min-h-[60vh] text-uf-muted text-sm gap-2">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Opening document…
            </div>
          ) : status === "ready" && objectUrl ? (
            <iframe
              src={objectUrl}
              title={fileName ?? "Document"}
              className="w-full h-full min-h-[60vh] rounded-md border border-[color:var(--uf-border)] bg-white"
            />
          ) : status === "unsupported" || status === "error" ? (
            <div className="grid place-items-center h-full min-h-[60vh] text-center px-6">
              <div>
                <p className="text-uf-text text-sm font-medium">
                  This file can&apos;t be previewed in the page.
                </p>
                <p className="text-uf-muted text-xs mt-1">
                  {status === "error"
                    ? "The document could not be loaded — open it in a new tab or download it below."
                    : "Open it in a new tab or download it to read it locally."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="uf-btn uf-btn--primary"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden />
                    Open in new tab
                  </a>
                  <a href={url} download className="uf-btn uf-btn--ghost">
                    <Download className="h-4 w-4 mr-1.5" aria-hidden />
                    Download
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
