import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { OveragePayload } from "@/lib/tiers";

/**
 * Reusable overage confirmation dialog shared by TierUsageWidget and any
 * other action that consumes AI/storage against a user cap.
 *
 * Pass `payload={null}` to hide the dialog regardless of `open`.
 */
export function OverageConfirmDialog({
  payload,
  open,
  onOpenChange,
  onConfirm,
  confirming,
  confirmLabel = "Confirm overage",
  cancelLabel = "Cancel",
}: {
  payload: OveragePayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirming?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const kind = payload?.kind === "storage" ? "storage" : "AI generations";
  return (
    <AlertDialog open={open && !!payload} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Overage requires confirmation</AlertDialogTitle>
          <AlertDialogDescription>
            {payload && (
              <>
                You're about to push your <strong>{kind}</strong> usage past
                your <strong>{payload.tier}</strong> tier cap.
                <br />
                Current:{" "}
                <strong>
                  {payload.kind === "storage"
                    ? `${payload.current.toFixed(2)} GB`
                    : payload.current.toLocaleString()}
                </strong>{" "}
                · Projection:{" "}
                <strong>
                  {payload.kind === "storage"
                    ? `${payload.projected.toFixed(2)} GB`
                    : payload.projected.toLocaleString()}
                </strong>{" "}
                · Cap:{" "}
                <strong>
                  {payload.kind === "storage"
                    ? `${payload.cap.toFixed(2)} GB`
                    : payload.cap.toLocaleString()}
                </strong>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={(e) => {
              e.preventDefault();
              onOpenChange(false);
            }}
            disabled={confirming}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={confirming}
          >
            {confirming ? "Confirming…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
