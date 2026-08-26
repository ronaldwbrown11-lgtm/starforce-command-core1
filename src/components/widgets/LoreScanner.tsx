import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard } from "../uf/Panel";
import { NeonButton } from "../uf/NeonButton";
import { StatusPill } from "../uf/StatusPill";

export function LoreScanner() {
  const [faction, setFaction] = useState("");
  const [sector, setSector] = useState("");
  const [classification, setClassification] = useState("");
  const [tick, setTick] = useState(0);
  const entry = useQuery(api.content.loreRandom, { faction, sector, classification });

  const scan = () => setTick((v) => v + 1);

  return (
    <section aria-labelledby="uf-lore-scanner-heading" className="uf-panel p-5">
      <header className="flex items-center justify-between mb-4">
        <h3 id="uf-lore-scanner-heading" className="uf-eyebrow">Lore scanner</h3>
        <StatusPill variant="cyan">Open</StatusPill>
      </header>
      <form
        className="grid gap-2 sm:grid-cols-3 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          scan();
        }}
      >
        <label className="text-xs text-uf-muted flex flex-col gap-1">
          Faction
          <input
            value={faction}
            onChange={(e) => setFaction(e.target.value)}
            placeholder="e.g., Terran Reach"
            className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-2 py-1 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>
        <label className="text-xs text-uf-muted flex flex-col gap-1">
          Sector
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="e.g., Sol system-Gemini"
            className="border border-[color:var(--uf-border)] rounded-md px-2 py-1 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>
        <label className="text-xs text-uf-muted flex flex-col gap-1">
          Classification
          <input
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            placeholder="open / restricted"
            className="border border-[color:var(--uf-border)] rounded-md px-2 py-1 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>
      </form>
      <NeonButton variant="primary" onClick={scan}>
        Open the Lore Scanner
      </NeonButton>
      <p className="text-uf-muted text-xs mt-3" aria-live="polite">
        {tick > 0 ? `Scan ${tick} complete.` : "Press the scanner to pull a random entry."}
      </p>
      <div className="mt-4" aria-live="polite">
        {entry === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : entry === null ? (
          <div className="uf-empty">No archive entries match those filters.</div>
        ) : (
          <HoloCard>
            <span className="uf-eyebrow">
              {[entry.faction, entry.sector, entry.classification]
                .filter(Boolean)
                .join(" • ") || "Unclassified"}
            </span>
            <h4 className="text-xl mt-2">{entry.title}</h4>
            <p className="text-sm text-uf-muted mt-2">{entry.excerpt}</p>
            <a
              href={`/lore/${entry.slug}`}
              className="uf-btn uf-btn--ghost mt-4"
            >
              Continue Reading
            </a>
          </HoloCard>
        )}
      </div>
    </section>
  );
}
