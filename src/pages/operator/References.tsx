import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill } from "@/components/uf";
import { VOICE, VOICE_RULES } from "@/lib/voice";
import { TIER_ORDER, TIERS, tierLabel, tierPillVariant } from "@/lib/tiers";

export default function OperatorReferences() {
  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">{VOICE.operatorEyebrow}</span>
        <h1 className="text-3xl font-semibold mt-2">{VOICE.heroTitle} — Reference Desk</h1>
        <p className="text-uf-muted text-sm mt-2 max-w-2xl">
          {VOICE.heroLead}
        </p>
      </header>

      <section aria-labelledby="references-voice" className="uf-grid uf-grid--2 mb-6">
        <HoloCard>
          <span className="uf-eyebrow">Hero voice</span>
          <h2 id="references-voice" className="text-xl font-semibold mt-1">Canonical hero copy</h2>
          <p className="text-uf-muted text-xs uppercase tracking-[0.16em] mt-3">Title (used on /, /membership, /operator)</p>
          <p className="text-base mt-1">{VOICE.heroTitle}</p>
          <p className="text-uf-muted text-xs uppercase tracking-[0.16em] mt-4">Lead</p>
          <p className="text-base mt-1">{VOICE.heroLead}</p>
          <p className="text-uf-muted text-xs uppercase tracking-[0.16em] mt-4">Eyebrow variants</p>
          <ul className="mt-1 space-y-1 text-sm list-none p-0">
            <li><StatusPill variant="info">{VOICE.heroEyebrow}</StatusPill> public surfaces</li>
            <li><StatusPill variant="violet">{VOICE.memberEyebrow}</StatusPill> pricing & accounts</li>
            <li><StatusPill variant="gold">{VOICE.operatorEyebrow}</StatusPill> operator surfaces</li>
          </ul>
        </HoloCard>

        <HoloCard>
          <span className="uf-eyebrow">Style rules</span>
          <h2 className="text-xl font-semibold mt-1">Voice do / don&apos;t</h2>
          <ul className="mt-3 space-y-2 list-none p-0 text-sm">
            {VOICE_RULES.map((r) => (
              <li key={r.rule} className="flex items-start gap-2">
                <StatusPill variant={r.ok ? "success" : "danger"}>
                  {r.ok ? "Do" : "Don't"}
                </StatusPill>
                <span>{r.rule}</span>
              </li>
            ))}
          </ul>
        </HoloCard>
      </section>

      <section aria-labelledby="references-tiers" className="mb-6">
        <header className="mb-4">
          <span className="uf-eyebrow">Tier glossary</span>
          <h2 id="references-tiers" className="text-2xl font-semibold mt-1">
            Membership tier reference
          </h2>
          <p className="text-uf-muted text-xs mt-1">
            Source of truth: <code className="text-uf-cyan">src/lib/tiers.ts</code>.
          </p>
        </header>
        <HoloCard className="!p-0 overflow-x-auto">
          <table className="uf-data-grid" style={{ minWidth: 720 }}>
            <caption className="uf-sr-only">Membership tiers reference</caption>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">AI / month</th>
                <th scope="col">Storage</th>
                <th scope="col">Max upload</th>
                <th scope="col">Flag</th>
              </tr>
            </thead>
            <tbody>
              {TIER_ORDER.map((id) => {
                const t = TIERS[id];
                return (
                  <tr key={id}>
                    <th scope="row">
                      <StatusPill variant={tierPillVariant(id)}>{tierLabel(id)}</StatusPill>
                    </th>
                    <td>{t.aiGenerations.toLocaleString()}</td>
                    <td>{t.storageGb} GB</td>
                    <td>{t.maxUploadMb} MB</td>
                    <td>
                      <StatusPill
                        variant={
                          t.flag === "top"
                            ? "gold"
                            : t.flag === "priority"
                              ? "violet"
                              : t.flag === "standard"
                                ? "info"
                                : "default"
                        }
                      >
                        {t.flag}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </HoloCard>
      </section>

      <section aria-labelledby="references-cta" className="mb-6">
        <header className="mb-6">
          <span className="uf-eyebrow">CTA conventions</span>
          <h2 id="references-cta" className="text-2xl font-semibold mt-1">Standard CTA labels</h2>
        </header>
        <div className="uf-grid uf-grid--3">
          {[
            { label: "Open", example: "Open the Lore Scanner" },
            { label: "Begin", example: "Begin reading" },
            { label: "Continue", example: "Continue Mission" },
            { label: "See", example: "See tiers" },
            { label: "Become", example: "Become G.I.A Agent" },
            { label: "Take", example: "Take Command" },
          ].map((c) => (
            <HoloCard key={c.label}>
              <span className="uf-eyebrow">Verb</span>
              <p className="text-lg font-semibold mt-1">{c.label}</p>
              <p className="text-uf-muted text-sm mt-2">{c.example}</p>
            </HoloCard>
          ))}
        </div>
      </section>
    </OperatorShell>
  );
}
