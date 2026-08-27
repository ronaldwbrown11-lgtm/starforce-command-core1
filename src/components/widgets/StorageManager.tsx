import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, NeonButton } from "@/components/uf";
import {
  Upload,
  Trash2,
  FileText,
  Image,
  Music,
  HardDrive,
  Download,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-4 w-4" aria-hidden />;
  if (type.startsWith("audio/")) return <Music className="h-4 w-4" aria-hidden />;
  return <FileText className="h-4 w-4" aria-hidden />;
}

function isImage(type: string) {
  return type.startsWith("image/");
}
function isAudio(type: string) {
  return type.startsWith("audio/");
}

type PendingFile = {
  file: File;
  previewUrl: string | null;
};

export function StorageManager() {
  const getUploadUrl = useAction(api.storage.getUploadUrl);
  const confirmUpload = useAction(api.storage.confirmUploadFromClient);
  const deleteFile = useAction(api.storage.deleteFile);
  const getDownloadUrl = useAction(api.storage.getDownloadUrl);
  const usage = useQuery(api.storageHelper.getUsage);

  const [pending, setPending] = useState<PendingFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const usedBytes = usage?.usedBytes ?? 0;
  const quotaBytes = usage?.quotaBytes ?? 0;
  const files = usage?.files ?? [];
  const percent = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;

  // --- File selection (no auto-upload) ---
  const handlePick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      // Revoke previous preview if any
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      const previewUrl = isImage(file.type) ? URL.createObjectURL(file) : null;
      setPending({ file, previewUrl });
    };
    input.click();
  };

  const handleCancel = () => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  };

  // --- Save (upload + confirm) ---
  const handleSave = async () => {
    if (!pending) return;
    const { file } = pending;
    setUploading(true);
    try {
      const { uploadUrl, r2Key, fileName, fileSize, fileType } = await getUploadUrl({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
      });

      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      await confirmUpload({ r2Key, fileName, fileSize, fileType });
      toast.success(`Saved: ${fileName}`);
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // --- Download ---
  const handleDownload = async (r2Key: string, fileName: string) => {
    setDownloadingKey(r2Key);
    try {
      const { url } = await getDownloadUrl({ r2Key });
      // Open in new tab (images, PDFs) or trigger download
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloadingKey(null);
    }
  };

  // --- Delete ---
  const handleDelete = async (r2Key: string, fileName: string) => {
    try {
      await deleteFile({ r2Key });
      toast.success(`Deleted: ${fileName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <HoloCard>
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-uf-cyan" aria-hidden />
          <span className="uf-eyebrow">Storage</span>
        </div>
        {!pending && (
          <NeonButton variant="ghost" onClick={handlePick}>
            <Upload className="h-4 w-4" aria-hidden />
            Upload file
          </NeonButton>
        )}
      </header>

      {/* Usage meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-uf-muted">{formatBytes(usedBytes)} used</span>
          <span className="text-uf-muted">{formatBytes(quotaBytes)} quota</span>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(16,24,39,0.6)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percent}%`,
              background:
                percent > 90
                  ? "var(--uf-magenta)"
                  : percent > 70
                    ? "var(--uf-gold)"
                    : "var(--uf-cyan)",
            }}
          />
        </div>
        <p className="text-xs text-uf-muted mt-1">
          {percent.toFixed(0)}% used — {files.length} file{files.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Pending file — preview + save/cancel */}
      {pending && (
        <div className="mb-4 rounded-md border border-[color:var(--uf-cyan)] bg-[rgba(0,229,255,0.04)] p-4">
          <p className="text-sm font-semibold mb-2">{pending.file.name}</p>
          {pending.previewUrl && (
            <img
              src={pending.previewUrl}
              alt={pending.file.name}
              className="max-h-48 rounded-md object-contain mb-3"
            />
          )}
          <p className="text-xs text-uf-muted mb-3">
            {formatBytes(pending.file.size)} · {pending.file.type || "unknown type"}
          </p>
          <div className="flex gap-2">
            <NeonButton
              variant="primary"
              onClick={handleSave}
              disabled={uploading}
            >
              {uploading ? (
                <>Saving…</>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Save file
                </>
              )}
            </NeonButton>
            <NeonButton
              variant="ghost"
              onClick={handleCancel}
              disabled={uploading}
            >
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </NeonButton>
          </div>
        </div>
      )}

      {/* File list */}
      {files.length === 0 && !pending ? (
        <p className="text-sm text-uf-muted">
          No files uploaded yet. Click "Upload file" to add your first.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {files.map((f) => (
            <li
              key={f._id}
              className="rounded-md border border-[color:var(--uf-border)] overflow-hidden transition-colors hover:border-[color:var(--uf-cyan)]"
            >
              {/* Image thumbnail */}
              {isImage(f.fileType) && (
                <div className="w-full h-32 bg-black flex items-center justify-center overflow-hidden">
                  <FilePreview r2Key={f.r2Key} fileName={f.fileName} fileType={f.fileType} />
                </div>
              )}

              {/* Audio player */}
              {isAudio(f.fileType) && (
                <div className="p-3 bg-[rgba(16,24,39,0.4)]">
                  <AudioPreview r2Key={f.r2Key} fileName={f.fileName} />
                </div>
              )}

              {/* Info row */}
              <div className="flex items-center gap-3 p-3">
                <span className="shrink-0 text-uf-muted">
                  {fileIcon(f.fileType)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.fileName}</p>
                  <p className="text-xs text-uf-muted">
                    {formatBytes(f.fileSize)} ·{" "}
                    {new Date(f.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(f.r2Key, f.fileName)}
                  disabled={downloadingKey === f.r2Key}
                  className="shrink-0 p-1.5 rounded-md text-uf-muted hover:text-uf-cyan hover:bg-[rgba(0,229,255,0.08)] transition-colors"
                  aria-label={`Download ${f.fileName}`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(f.r2Key, f.fileName)}
                  className="shrink-0 p-1.5 rounded-md text-uf-muted hover:text-[var(--uf-magenta)] hover:bg-[rgba(255,61,112,0.1)] transition-colors"
                  aria-label={`Delete ${f.fileName}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </HoloCard>
  );
}

// ---------------------------------------------------------------------------
// Inline preview sub-components — fetch a pre-signed URL on mount and render.
// ---------------------------------------------------------------------------

function FilePreview({
  r2Key,
  fileName,
  fileType,
}: {
  r2Key: string;
  fileName: string;
  fileType: string;
}) {
  const getDownloadUrl = useAction(api.storage.getDownloadUrl);
  const [url, setUrl] = useState<string | null>(null);

  // Fetch signed URL on mount
  useState(() => {
    getDownloadUrl({ r2Key })
      .then(({ url }) => setUrl(url))
      .catch(() => {});
  });

  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center text-uf-muted text-xs">
        Loading preview…
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={fileName}
      className="max-h-full max-w-full object-contain"
      loading="lazy"
    />
  );
}

function AudioPreview({ r2Key, fileName }: { r2Key: string; fileName: string }) {
  const getDownloadUrl = useAction(api.storage.getDownloadUrl);
  const [url, setUrl] = useState<string | null>(null);

  useState(() => {
    getDownloadUrl({ r2Key })
      .then(({ url }) => setUrl(url))
      .catch(() => {});
  });

  if (!url) {
    return <p className="text-xs text-uf-muted">Loading audio…</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <Music className="h-5 w-5 text-uf-cyan shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-uf-muted truncate mb-1">{fileName}</p>
        <audio src={url} controls preload="metadata" className="w-full h-8" />
      </div>
    </div>
  );
}
