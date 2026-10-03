// =========================================================================
// Lab field sets — the single source of truth for the two Creator Lab
// databases:
//   • Species     → Biology Lab  (/biology-lab)   → speciesDatabase table
//   • Technology  → Research Lab (/research-lab)   → technologyDatabase table
//
// Consumed by BOTH sides:
//   • src/convex/labs.ts   — derives the allowed field keys (sanitize allowlist)
//   • LabWorkbench         — renders the grouped form + parses seeded files
//
// Keep this file pure TypeScript (no React imports) so Convex can import it.
// =========================================================================

export type LabField = {
  key: string;
  label: string;
  /** "text" (single line) is the default; "textarea" wraps; "number" coerces. */
  type?: "text" | "textarea" | "number";
  placeholder?: string;
};

export type LabFieldGroup = {
  title: string;
  fields: LabField[];
};

const t = (key: string, label: string, placeholder?: string): LabField => ({
  key,
  label,
  placeholder,
});
const ta = (key: string, label: string, placeholder?: string): LabField => ({
  key,
  label,
  type: "textarea",
  placeholder,
});
const num = (key: string, label: string): LabField => ({
  key,
  label,
  type: "number",
});

// ---------------------------------------------------------------------------
// SPECIES — Biology Lab
// ---------------------------------------------------------------------------

export const SPECIES_NAME_KEY = "speciesName";
export const SPECIES_GROUPS: LabFieldGroup[] = [
  {
    title: "Identity",
    fields: [
      t("speciesName", "Species name", "e.g. Vashti"),
      t("scientificName", "Scientific name", "e.g. Vashti stellaris"),
      t("classification", "Classification", "e.g. Mammalian humanoids"),
      t("originWorld", "Origin world", "e.g. Vashtar III"),
      t("originSector", "Origin sector", "e.g. Corridor 4"),
      t("discoveryDate", "Discovery date", "e.g. 2187-04-19"),
      t("discoveredBy", "Discovered by", "e.g. USS Aurora survey crew"),
    ],
  },
  {
    title: "Biology",
    fields: [
      ta("physiologySummary", "Physiology summary", "How the species is built, end to end."),
      t("averageHeight", "Average height", "e.g. 1.9 m"),
      t("averageMass", "Average mass", "e.g. 90 kg"),
      t("lifespan", "Lifespan", "e.g. 140 standard years"),
      ta("biologicalComposition", "Biological composition"),
      ta("reproductionMethod", "Reproduction method"),
      ta("geneticTraits", "Genetic traits"),
      ta("uniqueFeatures", "Unique features"),
      ta("weaknesses", "Weaknesses"),
      num("threatLevel", "Threat level (0–10)"),
    ],
  },
  {
    title: "Culture & Society",
    fields: [
      ta("cultureSummary", "Culture summary"),
      ta("socialStructure", "Social structure"),
      ta("communicationMethod", "Communication method"),
      ta("religionBeliefs", "Religion & beliefs"),
      t("governmentType", "Government type"),
      t("technologicalLevel", "Technological level", "e.g. Pre-warp"),
      ta("knownConflicts", "Known conflicts"),
      ta("alliances", "Alliances"),
      num("hostilityIndex", "Hostility index (0–10)"),
    ],
  },
  {
    title: "Habitat",
    fields: [
      t("primaryHabitat", "Primary habitat"),
      ta("environmentalRequirements", "Environmental requirements"),
      t("climatePreference", "Climate preference"),
      t("atmosphericRequirements", "Atmospheric requirements"),
      ta("migrationPatterns", "Migration patterns"),
      ta("territorialRange", "Territorial range"),
    ],
  },
  {
    title: "Canon Integration",
    fields: [ta("canonNotes", "Canon notes", "How this species ties into existing lore.")],
  },
  {
    title: "Images",
    fields: [
      t("speciesPortrait", "Species portrait (URL)", "https://…"),
      t("habitatImage", "Habitat image (URL)", "https://…"),
    ],
  },
];

// ---------------------------------------------------------------------------
// TECHNOLOGY — Research Lab
// ---------------------------------------------------------------------------

export const TECHNOLOGY_NAME_KEY = "techName";
export const TECHNOLOGY_GROUPS: LabFieldGroup[] = [
  {
    title: "Identity",
    fields: [
      t("techName", "Technology name", "e.g. Phase-Lock Drive"),
      t("classification", "Classification", "e.g. Propulsion"),
      t("manufacturerFaction", "Manufacturer faction", "e.g. Star Force"),
      t("firstAppearance", "First appearance", "e.g. Story / episode / entry title"),
      t("developmentDate", "Development date", "e.g. 2191"),
      t("developedBy", "Developed by", "e.g. Starforge Division"),
    ],
  },
  {
    title: "Technical Specs",
    fields: [
      ta("technicalSummary", "Technical summary"),
      t("powerSource", "Power source"),
      t("materialComposition", "Material composition"),
      t("operatingRange", "Operating range"),
      t("efficiencyRating", "Efficiency rating"),
      t("stabilityRating", "Stability rating"),
      ta("knownLimitations", "Known limitations"),
      ta("requiredConditions", "Required conditions"),
      num("safetyLevel", "Safety level (0–10)"),
    ],
  },
  {
    title: "Functionality",
    fields: [
      t("primaryFunction", "Primary function"),
      ta("secondaryFunctions", "Secondary functions"),
      ta("tacticalApplications", "Tactical applications"),
      ta("civilianApplications", "Civilian applications"),
      ta("knownFailures", "Known failures"),
      ta("knownUpgrades", "Known upgrades"),
      ta("compatibility", "Compatibility"),
    ],
  },
  {
    title: "Canon Integration",
    fields: [ta("canonNotes", "Canon notes", "Where this technology sits in the record.")],
  },
  {
    title: "Images",
    fields: [
      t("blueprintImage", "Blueprint image (URL)", "https://…"),
      t("devicePhoto", "Device photo (URL)", "https://…"),
    ],
  },
];

/** All field keys for a lab, in render order (name key first). */
export function labKeys(groups: LabFieldGroup[]): string[] {
  return groups.flatMap((g) => g.fields.map((f) => f.key));
}

/** Numeric keys for a lab — coerced on ingest (form + seeded file rows). */
export function labNumberKeys(groups: LabFieldGroup[]): string[] {
  return groups
    .flatMap((g) => g.fields)
    .filter((f) => f.type === "number")
    .map((f) => f.key);
}

// ---------------------------------------------------------------------------
// Seed file ingest — CSV / TSV / JSON → normalized rows
// ---------------------------------------------------------------------------

/** "Species Name" / "species_name" / "speciesName" → "speciesname". */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** RFC-ish CSV/TSV parser: quoted fields, escaped quotes, CRLF, blank lines. */
export function parseDelimited(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const delimiter = (
    firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ","
  );
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const out: Record<string, string> = {};
      header.forEach((h, i) => {
        out[h.trim()] = (r[i] ?? "").trim();
      });
      return out;
    });
}

/** Read a File as parsed (but untyped) records — JSON array or delimited text. */
export async function parseSeedFile(
  file: File,
): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  const trimmed = text.trim();
  const looksJson =
    file.name.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{");
  if (looksJson) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed?.rows ?? parsed?.items ?? parsed?.species ?? parsed?.technology ?? []);
    if (!Array.isArray(arr)) {
      throw new Error("JSON must be an array of records (or { rows: [...] }).");
    }
    return arr as Record<string, unknown>[];
  }
  return parseDelimited(text) as Record<string, unknown>[];
}

/**
 * Map raw records onto this lab's fields:
 *   • header matching is forgiving (case/space/underscore insensitive, and
 *     fragment matching so "portrait URL" finds speciesPortrait)
 *   • unknown columns are reported back (not silently dropped), empty cells
 *     are dropped, number fields are coerced
 *   • rows missing the required name column are counted as skipped
 */
export function normalizeSeedRows(
  raw: Record<string, unknown>[],
  groups: LabFieldGroup[],
  nameKey: string,
): { rows: Record<string, unknown>[]; skipped: number; unknownColumns: string[] } {
  const byNorm = new Map<string, string>();
  for (const f of groups.flatMap((g) => g.fields)) byNorm.set(normKey(f.key), f.key);
  const canonNorms = [...byNorm.keys()];
  const numberKeys = new Set(labNumberKeys(groups));
  const unknown = new Set<string>();

  /** Resolve a header to a field key: exact, suffix-stripped, then unique fragment. */
  const resolve = (header: string): string | undefined => {
    const n = normKey(header);
    if (!n) return undefined;
    const exact = byNorm.get(n);
    if (exact) return exact;
    const stripped = n.replace(/(url|uri|link)$/, "");
    if (stripped.length >= 3) {
      const short = byNorm.get(stripped);
      if (short) return short;
      if (stripped.length >= 4) {
        const hits = canonNorms.filter(
          (c) => c.includes(stripped) || stripped.includes(c),
        );
        if (hits.length === 1) return byNorm.get(hits[0]);
      }
    }
    return undefined;
  };

  // Header → field mapping is stable across the file (computed once).
  let headerMap: Map<string, string> | null = null;

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const rec of raw) {
    if (!headerMap) {
      headerMap = new Map();
      for (const k of Object.keys(rec ?? {})) {
        const key = resolve(k);
        if (key) headerMap.set(k, key);
        else unknown.add(k);
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec ?? {})) {
      const key = headerMap.get(k);
      if (!key) continue;
      if (v === null || v === undefined) continue;
      if (numberKeys.has(key)) {
        const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
        if (!Number.isNaN(n) && String(v).trim() !== "") out[key] = n;
        continue;
      }
      const s = String(v).trim();
      if (s) out[key] = s;
    }
    if (!out[nameKey]) {
      skipped++;
      continue;
    }
    rows.push(out);
  }
  return { rows, skipped, unknownColumns: [...unknown] };
}
