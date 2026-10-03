import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteShell } from "@/components/uf";
import { LabWorkbench, type LabRecord } from "@/components/labs/LabWorkbench";
import { TECHNOLOGY_GROUPS, TECHNOLOGY_NAME_KEY } from "@/lib/labFields";
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
// Research Lab (/research-lab) — the technology database behind the Creator
// Hub's "Add Technology" card. Full intake form, operator seed bay
// (CSV/JSON), and the reviewable dossier list. Data lives in
// `technologyDatabase`.
// =========================================================================

export default function ResearchLab() {
  usePageMeta({
    title: "Research Lab — Star Force Base 1198",
    description:
      "The technology database of the Ultra Force canon: specs, functionality, tactical and civilian applications, and canon standing for every system on file.",
  });

  const { isAuthenticated, user } = useAuth();
  const records = useQuery(api.labs.listTechnology, {});
  const create = useMutation(api.labs.createTechnology);
  const seed = useMutation(api.labs.seedTechnology);
  const review = useMutation(api.labs.reviewTechnology);
  const remove = useMutation(api.labs.removeTechnology);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const isOperator =
    user?.role === "admin" ||
    (!!user?.opRole && OPERATOR_ROLES.includes(user.opRole));

  return (
    <SiteShell>
      <LabWorkbench
        eyebrow="Research Lab"
        title="Technology database of the fleet."
        lead="Specifications, functionality, and field standing for every system the Ultra Force has built, captured, or reverse-engineered — the reference you draft tech against."
        nameKey={TECHNOLOGY_NAME_KEY}
        nameLabel="Technology name"
        groups={TECHNOLOGY_GROUPS}
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
          await review({ id: id as Id<"technologyDatabase">, approve });
        }}
        onRemove={async (id) => {
          await remove({ id: id as Id<"technologyDatabase"> });
        }}
      />
    </SiteShell>
  );
}
