import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Rocket, Ship, X } from "lucide-react";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { ShipProfileCard } from "./ShipProfileCard";
import { ShipMissions } from "./ShipMissions";
import { ShipAssignmentFlow } from "./ShipAssignmentFlow";
import { getShipMissionsForClass } from "@/lib/ships";

// ---------------------------------------------------------------------------
// Ship dashboard — the Command Deck module for a pilot's ship identity:
// profile card, ship-class missions with per-class progress, and the change
// ship / clear assignment controls. Switching ships preserves progress.
// ---------------------------------------------------------------------------

export function ShipDashboard({
  user,
  className,
}: {
  user: {
    shipClass?: string | null;
    shipRole?: string | null;
    shipGroup?: string | null;
    shipName?: string | null;
    shipCompletedMissions?: string[];
  };
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const clearShip = useMutation(api.ships.clearMyShip);
  const [clearing, setClearing] = useState(false);

  const missions = getShipMissionsForClass(user.shipClass);
  const doneCount = (user.shipCompletedMissions ?? []).filter((id) =>
    missions.some((m) => m.id === id),
  ).length;

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearShip();
      toast.success("Ship assignment cleared — fly free until you re-post.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear the assignment.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <HoloCard className={className}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="uf-eyebrow flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5 text-uf-cyan" aria-hidden />
            Ship status · Command deck
          </span>
          <h2 className="text-xl font-semibold mt-1.5">Your posting</h2>
          <p className="text-uf-muted text-sm mt-1 max-w-[58ch]">
            Cosmetic + identity only — your hull never changes gameplay. Switch
            ships anytime; per-class mission progress is kept.
          </p>
        </div>
        {user.shipClass ? (
          <StatusPill variant="success">Assigned</StatusPill>
        ) : (
          <StatusPill variant="info">Unassigned</StatusPill>
        )}
      </header>

      <div className="mt-4">
        {editing ? (
          <div className="space-y-3">
            <ShipAssignmentFlow
              initial={{
                shipClass: user.shipClass,
                shipRole: user.shipRole,
                shipGroup: user.shipGroup,
                shipName: user.shipName,
              }}
              onDone={() => setEditing(false)}
            />
            <NeonButton variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4 mr-1.5" aria-hidden />
              Cancel
            </NeonButton>
          </div>
        ) : user.shipClass ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <ShipProfileCard ship={user} />
              {user.shipClass && doneCount < missions.length ? (
                <p className="text-xs text-uf-muted">
                  {missions.length - doneCount} ship mission
                  {missions.length - doneCount === 1 ? "" : "s"} open for your{" "}
                  {user.shipClass}.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <NeonButton variant="primary" onClick={() => setEditing(true)}>
                  <Rocket className="h-4 w-4 mr-1.5" aria-hidden />
                  Change ship
                </NeonButton>
                <NeonButton
                  variant="ghost"
                  loading={clearing}
                  onClick={() => void handleClear()}
                >
                  Clear assignment
                </NeonButton>
              </div>
            </div>
            <ShipMissions
              shipClass={user.shipClass}
              completed={user.shipCompletedMissions ?? []}
              compact
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-4 text-center">
            <p className="text-uf-muted text-sm">
              No hull on record. Assign a ship to appear in the fleet registry
              and unlock ship-class missions.
            </p>
            <div className="mt-3 flex justify-center">
              <NeonButton variant="primary" onClick={() => setEditing(true)}>
                <Rocket className="h-4 w-4 mr-1.5" aria-hidden />
                Assign your ship
              </NeonButton>
            </div>
          </div>
        )}
      </div>
    </HoloCard>
  );
}