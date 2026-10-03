import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteShell } from "@/components/uf";
import { LabWorkbench, type LabRecord } from "@/components/labs/LabWorkbench";
import { SPECIES_GROUPS, SPECIES_NAME_KEY } from "@/lib/labFields";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";

// Mirrors the capability list used across the operator surface.
const OPERATOR_ROLES = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

// =========================================================================
// Biology Lab (/biology-lab) — the species database behind the Creator Hub's
// "Add Species" card. Full intake form, operator seed bay (CSV/JSON), and
// the reviewable dossier list. All data lives in `speciesDatabase`.
// =========================================================================

export default function BiologyLab() {
  usePageMeta({
    title: "Biology Lab — Star Force Base 1198",
    description:
      "The species database of the Ultra Force canon: physiology, culture, habitat, and canon notes for every species on file.",
  });

  const { isAuthenticated, user } = useAuth();
  const records = useQuery(api.labs.listSpecies, {});
  const create = useMutation(api.labs.createSpecies);
  const seed = useMutation(api.labs.seedSpecies);
  const review = useMutation(api.labs.reviewSpecies);
  const remove = useMutation(api.labs.removeSpecies);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const isOperator =
    user?.role === "admin" ||
    (!!user?.opRole && OPERATOR_ROLES.includes(user.opRole));

  return (
    <SiteShell>
      <LabWorkbench
        eyebrow="Biology Lab"
        title="Species database of the fleet."
        lead="Physiology, culture, habitat, and canon standing for every species charted by the Ultra Force — the reference you draft characters and events against."
        nameKey={SPECIES_NAME_KEY}
        nameLabel="Species name"
        groups={SPECIES_GROUPS}
        records={(records ?? []) as unknown as LabRecord[]}
        isAuthenticated={isAuthenticated}
        isOperator={isOperator}
        busy={busy}
        seeding={seeding}
        onCreate={async (values) => {
          setBusy(true);
          try {
            const res = await create({ row: values });
            return res.status as "approved" | "pending";
          } finally {
            setBusy(false);
          }
        }}
        onSeed={async (rows) => {
          setSeeding(true);
          try {
            return await seed({ rows });
          } finally {
            setSeeding(false);
          }
        }}
        onReview={async (id, approve) => {
          await review({ id: id as Id<"speciesDatabase">, approve });
        }}
        onRemove={async (id) => {
          await remove({ id: id as Id<"speciesDatabase"> });
        }}
      />
    </SiteShell>
  );
}
