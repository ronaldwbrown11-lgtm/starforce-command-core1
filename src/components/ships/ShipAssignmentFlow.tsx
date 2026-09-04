import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import { NeonButton, StatusPill } from "@/components/uf";
import {
  CATEGORY_SILHOUETTE,
  SHIP_ACCENT_HEX,
  SHIP_CATEGORIES,
  SHIP_CLASSES_BY_CATEGORY,
  SHIP_GROUP_SECTIONS,
  SHIP_ROLES,
  getShipAccent,
  type ShipCategory,
} from "@/lib/ships";
import { ShipSilhouette } from "./ShipSilhouette";
import { ShipProfileCard } from "./ShipProfileCard";

const STEPS = ["Category", "Class", "Role", "Group", "Name", "Confirm"] as const;

function cardClass(active: boolean) {
  return (
    "rounded-xl border p-3 text-left transition-colors cursor-pointer " +
    (active
      ? "bg-[rgba(16,24,39,0.7)]"
      : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] hover:border-[rgba(0,229,255,0.4)] hover:bg-[rgba(16,24,39,0.6)]")
  );
}

// ---------------------------------------------------------------------------
// Ship assignment flow — the six onboarding steps (category → class → role →
// group → name → confirm). Used during pilot orientation and as the "change
// ship" editor on the account deck. Cosmetic + identity only.
// ---------------------------------------------------------------------------

export function ShipAssignmentFlow({
  initial,
  onDone,
  className,
}: {
  initial?: { shipClass?: string | null; shipRole?: string | null; shipGroup?: string | null; shipName?: string | null };
  onDone?: (saved: { shipClass: string; shipRole: string; shipGroup: string; shipName?: string }) => void;
  className?: string;
}) {
  const setMyShip = useMutation(api.ships.setMyShip);
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<ShipCategory | null>(
    initial?.shipClass
      ? (SHIP_CATEGORIES.find((c) => SHIP_CLASSES_BY_CATEGORY[c].includes(initial.shipClass!)) ?? null)
      : null,
  );
  const [shipClass, setShipClass] = useState<string | null>(initial?.shipClass ?? null);
  const [role, setRole] = useState<string | null>(initial?.shipRole ?? null);
  const [group, setGroup] = useState<string | null>(initial?.shipGroup ?? null);
  const [shipName, setShipName] = useState(initial?.shipName ?? "");
  const [saving, setSaving] = useState(false);

  const canContinue =
    (step === 0 && !!category) ||
    (step === 1 && !!shipClass) ||
    (step === 2 && !!role) ||
    (step === 3 && !!group) ||
    step === 4; // name is optional

  const pickCategory = (c: ShipCategory) => {
    setCategory(c);
    setShipClass(null);
    setRole(null);
    setGroup(null);
    setStep(1);
  };

  const pickClass = (c: string) => {
    setShipClass(c);
    setRole(null);
    setGroup(null);
    setStep(2);
  };

  const confirm = async () => {
    if (!shipClass || !role || !group) return;
    setSaving(true);
    try {
      const name = shipName.trim();
      await setMyShip({ shipClass, shipRole: role, shipGroup: group, shipName: name || undefined });
      toast.success(`${name ? `“${name}” ` : ""}${shipClass} assigned — welcome aboard.`);
      onDone?.({ shipClass, shipRole: role, shipGroup: group, shipName: name || undefined });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't assign the ship.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={
        "relative overflow-hidden rounded-xl border border-[rgba(0,229,255,0.25)] " +
        "bg-[rgba(10,18,34,0.6)] backdrop-blur-md p-4 sm:p-5 " +
        (className ?? "")
      }
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(420px 180px at 10% 0%, rgba(0,229,255,0.10), transparent 65%), radial-gradient(360px 160px at 90% 100%, rgba(167,139,250,0.08), transparent 60%)",
        }}
      />
      <div className="relative">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="uf-eyebrow flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5 text-uf-cyan" aria-hidden />
              Ship assignment
            </span>
            <h3 className="text-lg font-semibold mt-1">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </h3>
            <p className="text-uf-muted text-xs mt-0.5">
              {step === 0 && "Pick a hull category to open its class roster."}
              {step === 1 && `Choose your ${category ?? ""} class.`}
              {step === 2 && "Select the role your hull serves in the fleet."}
              {step === 3 && "Choose the formation your ship reports to."}
              {step === 4 && "Give your hull a name — optional, changeable anytime."}
              {step === 5 && "Confirm the posting and it's on your record."}
            </p>
          </div>
          <StatusPill variant="info">
            {step + 1}/{STEPS.length}
          </StatusPill>
        </header>

        {/* Step indicator */}
        <div
          className="uf-progress mt-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label={`Ship assignment step ${step + 1} of ${STEPS.length}`}
        >
          <div className="uf-progress__bar" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="mt-4">
          {/* Step 1 — category */}
          {step === 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="listbox" aria-label="Ship categories">
              {SHIP_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={category === c}
                  onClick={() => pickCategory(c)}
                  className={cardClass(category === c)}
                  style={category === c ? { borderColor: "rgba(0,229,255,0.7)", boxShadow: "0 0 14px rgba(0,229,255,0.25)" } : undefined}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-uf-text">{c}</span>
                    <span className="text-[10px] text-uf-muted">
                      {SHIP_CLASSES_BY_CATEGORY[c].length} class
                      {SHIP_CLASSES_BY_CATEGORY[c].length === 1 ? "" : "es"}
                    </span>
                  </span>
                  <ShipSilhouette kind={CATEGORY_SILHOUETTE[c]} accent={SHIP_ACCENT_HEX.cyan} className="h-6 w-full mt-2" />
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — class */}
          {step === 1 && category && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="listbox" aria-label={`${category} classes`}>
              {SHIP_CLASSES_BY_CATEGORY[category].map((c) => {
                const accent = SHIP_ACCENT_HEX[getShipAccent(c)];
                return (
                  <button
                    key={c}
                    type="button"
                    role="option"
                    aria-selected={shipClass === c}
                    onClick={() => pickClass(c)}
                    className={cardClass(shipClass === c)}
                    style={
                      shipClass === c
                        ? { borderColor: accent, boxShadow: `0 0 14px ${accent}33` }
                        : undefined
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-uf-text">{c}</span>
                      {shipClass === c ? (
                        <Check className="h-4 w-4" style={{ color: accent }} aria-hidden />
                      ) : null}
                    </span>
                    <ShipSilhouette shipClass={c} className="h-6 w-full mt-2" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3 — role */}
          {step === 2 && (
            <div className="flex flex-wrap gap-2" role="listbox" aria-label="Ship roles">
              {SHIP_ROLES.map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setRole(active ? null : r)}
                    className={
                      "rounded-full border px-4 py-2 text-sm transition-colors cursor-pointer " +
                      (active
                        ? "border-[rgba(0,229,255,0.7)] bg-[rgba(0,229,255,0.12)] text-uf-text"
                        : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] text-uf-muted hover:text-uf-text hover:border-[rgba(0,229,255,0.4)]")
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 4 — group */}
          {step === 3 && (
            <div className="space-y-4" role="listbox" aria-label="Ship groups">
              {SHIP_GROUP_SECTIONS.map((section) => (
                <fieldset key={section.title}>
                  <legend className="uf-eyebrow">{section.title}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {section.groups.map((g) => {
                      const active = group === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => setGroup(active ? null : g)}
                          className={
                            "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer " +
                            (active
                              ? "border-[rgba(167,139,250,0.7)] bg-[rgba(167,139,250,0.14)] text-uf-text"
                              : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] text-uf-muted hover:text-uf-text hover:border-[rgba(167,139,250,0.4)]")
                          }
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {/* Step 5 — name */}
          {step === 4 && (
            <div className="max-w-md">
              <label htmlFor="ship-name" className="uf-eyebrow">
                Ship name <span className="text-uf-muted">(optional)</span>
              </label>
              <input
                id="ship-name"
                type="text"
                value={shipName}
                onChange={(e) => setShipName(e.target.value)}
                maxLength={60}
                placeholder="e.g. Wraith of Sol"
                className="mt-2 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
              <p className="text-uf-muted text-xs mt-2">
                Leave it blank and your hull flies under its class designation.
              </p>
            </div>
          )}

          {/* Step 6 — confirm */}
          {step === 5 && shipClass && role && group && (
            <div className="max-w-lg">
              <ShipProfileCard ship={{ shipClass, shipRole: role, shipGroup: group, shipName: shipName.trim() || null }} />
              <p className="text-uf-muted text-xs mt-3">
                Cosmetic + identity only — the assignment never changes gameplay
                mechanics. You can switch ships anytime without losing progress.
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <NeonButton
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
            Back
          </NeonButton>
          <div className="flex flex-wrap gap-2">
            {step < STEPS.length - 1 ? (
              <NeonButton
                variant="primary"
                disabled={!canContinue || saving}
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden />
              </NeonButton>
            ) : (
              <NeonButton variant="primary" loading={saving} disabled={!canContinue} onClick={() => void confirm()}>
                <Check className="h-4 w-4 mr-1.5" aria-hidden />
                Assign ship
              </NeonButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}