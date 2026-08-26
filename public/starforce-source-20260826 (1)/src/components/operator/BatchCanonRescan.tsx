import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { NeonButton } from "@/components/uf";
import { toast } from "sonner";
import { Radar } from "lucide-react";

/**
 * One-click "rescan the pending pile" for the canon scanner. Queues a
 * staggered batch of AI scans for every submission that has never been
 * scanned, errored (e.g. the API key was missing), or is still flagged
 * needs_review. Scans are spaced 4s apart to stay under SambaNova's
 * 20 requests/minute developer-tier limit.
 */
export function BatchCanonRescan() {
  const rescan = useMutation(api.canonScannerHelpers.rescanPendingCanon);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const { queued, totalEligible } = await rescan({});
      if (queued === 0) {
        toast.success("Canon scan queue is already current.");
      } else {
        toast.success(
          `Queued ${queued} canon scan${queued === 1 ? "" : "s"} ` +
            `(${totalEligible} eligible). Verdicts will appear shortly.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch rescan failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <NeonButton
      variant="ghost"
      onClick={handleClick}
      loading={busy}
      iconLeft={!busy ? <Radar className="h-4 w-4" aria-hidden /> : undefined}
    >
      Rescan pending canon
    </NeonButton>
  );
}
