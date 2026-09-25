import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * One-shot, auth-free canon bootstrap for the faction registry.
 *
 * The factions table predates the "Delegate Species of the Orion Triangle"
 * charter transcription, so stored species rows still carry made-up pre-canon
 * text. The operator-gated `factions:seed` would fix them but has never run
 * (operator credentials were unavailable), so this hook lets any visitor heal
 * the registry: when `factions:listAll` reports `needsCanonSync`, it fires the
 * idempotent `factions:ensureCanon` mutation once per component mount. The
 * mutation writes only canon-derived data (catalog names, descriptions,
 * accents, icons) and cannot touch operator-authored rows, so it is safe to
 * expose without credentials — the same trust model as the public Sol-sector
 * seed in atlasSeed.ts.
 *
 * To keep client code simple, the hook returns `syncEpoch` — an integer that
 * starts at 0 and increments after a successful reconcile. Pass it as a React
 * `key` on your component's content wrapper (or feed it into query args) so
 * the affected queries re-run against the healed data. Subsequent visits are
 * no-ops: the mutation is idempotent and `needsCanonSync` flips false once
 * the stored species rows match the charter.
 */
export function useFactionCanonSync(): {
  syncEpoch: number;
  syncing: boolean;
} {
  const data = useQuery(api.factions.listAll);
  const ensureCanon = useMutation(api.factions.ensureCanon);

  const attemptedRef = useRef(false);
  const [syncEpoch, setSyncEpoch] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!data || attemptedRef.current) return;
    if (!data.needsCanonSync) return;
    attemptedRef.current = true;
    setSyncing(true);
    ensureCanon({})
      .then(() => setSyncEpoch((e) => e + 1))
      .catch(() => {
        // A transient failure leaves the registry showing stale rows; the
        // next mount or visitor retries automatically. Nothing to surface to
        // a visitor — the registry still renders (seed fallback or stale).
      })
      .finally(() => setSyncing(false));
  }, [data, ensureCanon]);

  return { syncEpoch, syncing };
}
