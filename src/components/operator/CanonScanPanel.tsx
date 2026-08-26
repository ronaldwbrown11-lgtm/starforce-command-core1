import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { StatusPill, NeonButton } from "@/components/uf";
import { toast } from "sonner";
import { Loader2, Radar, RefreshCw } from "lucide-react";

type CanonConflict = {
  claim: string;
  canonRef?: string;
  severity?: string;
};

export type CanonScan = {
  verdict?: string;
  confidence?: number | null;
  summary?: string | null;
  conflicts?: CanonConflict[] | null;
  model?: string | null;
  error?: string | null;
};

const VERDICT_LABEL: Record<string, string> = {
  canon: "Canon-aligned",
  conflict: "Canon conflict",
  needs_review: "Needs review",
};

const VERDICT_VARIANT: Record<
  string,
  "success" | "danger" | "warning" | "info"
> = {
  canon: "success",
  conflict: "danger",
  needs_review: "warning",
};

const SEVERITY_VARIANT: Record<string, "default" | "warning" | "danger"> = {
  minor: "default",
  major: "warning",
  critical: "danger",
};

export function CanonScanPanel({
  scan,
  kind,
  id,
}: {
  scan?: CanonScan | null;
  kind: "story" | "lore";
  id: Id<"stories"> | Id<"loreLibrary">;
}) {
  const rescan = useMutation(api.canonScannerHelpers.rescanCanon);
  const [busy, setBusy] = useState(false);

  async function handleRescan() {
    setBusy(true);
    try {
      const target =
        kind === "story"
          ? { kind: "story" as const, id: id as Id<"stories"> }
          : { kind: "lore" as const, id: id as Id<"loreLibrary"> };
      await rescan({ target });
      toast.success("Canon scan queued — the verdict will refresh shortly.");
    } catch {
      toast.error("Rescan failed.");
    } finally {
      setBusy(false);
    }
  }

  const verdict = scan?.verdict ?? "needs_review";
  const variant = VERDICT_VARIANT[verdict] ?? "info";

  return (
    <div
      className="mt-3 rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] p-4"
      data-uf-widget="canon-scan"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-[0.16em] text-uf-muted flex items-center gap-1.5">
          <Radar className="h-3.5 w-3.5 text-uf-cyan" aria-hidden />
          Canon Scanner
        </span>
        <div className="flex items-center gap-2">
          <StatusPill variant={variant} aria-live="polite">
            {VERDICT_LABEL[verdict] ?? verdict}
          </StatusPill>
          <NeonButton variant="ghost" onClick={handleRescan} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            Rescan
          </NeonButton>
        </div>
      </header>

      {!scan ? (
        <p className="text-xs text-uf-muted">
          No verdict yet — this submission is queued for its first canon scan.
        </p>
      ) : scan.error ? (
        <p className="text-xs text-uf-muted leading-relaxed">
          <span className="text-uf-text/80">Scan unavailable:</span>{" "}
          {scan.error}
        </p>
      ) : (
        <>
          {scan.summary ? (
            <p className="text-sm text-uf-text/90 leading-relaxed">
              {scan.summary}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-uf-muted">
            {typeof scan.confidence === "number" ? (
              <span>
                Confidence:{" "}
                <span className="text-uf-text/80">
                  {Math.round(scan.confidence * 100)}%
                </span>
              </span>
            ) : null}
            {scan.model ? <span>Model: {scan.model}</span> : null}
          </div>
          {scan.conflicts && scan.conflicts.length ? (
            <ul className="flex flex-col gap-2 list-none p-0 m-0 mt-3">
              {scan.conflicts.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.4)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      variant={SEVERITY_VARIANT[c.severity ?? ""] ?? "default"}
                    >
                      {c.severity ?? "minor"}
                    </StatusPill>
                    <span className="text-sm text-uf-text/90">{c.claim}</span>
                  </div>
                  {c.canonRef ? (
                    <p className="text-xs text-uf-muted mt-1">
                      Conflicts with: {c.canonRef}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
