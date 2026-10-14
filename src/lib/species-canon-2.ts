// =========================================================================
// Delegate Species of the Orion Triangle — canon charter, part 2 (91–150).
//
// EMPTIED 2026-10-14 by operator request: the charter now covers Species
// Codex Sections I–III (Species 1–50) only — see species-canon-1.ts.
// The former 91–150 entries are excess species, removed from the catalog
// and to be replaced with new canon later. reconcileCanon retires their
// stored rows (deactivates, never deletes) on the next console reseed.
//
// The export is kept so the spread in src/lib/factions.ts stays valid;
// repopulate this array when the replacement charter arrives.
// =========================================================================

import type { FactionSeed } from "./factions";

export const SPECIES_FACTIONS_2: FactionSeed[] = [];
