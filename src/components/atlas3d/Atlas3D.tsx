import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import AtlasCanvas from "./AtlasCanvas";
import AtlasHUD from "./AtlasHUD";
import type { AtlasLevel, AtlasSnapshot } from "./types";

// =========================================================================
// Atlas3D — root component. Loads the snapshot from Convex, owns the
// navigation state (level + current quadrant/sector/system), wires the
// keyboard shortcuts, and renders the R3F canvas + HUD.
// =========================================================================

const KEY_TARGET: Record<string, AtlasLevel> = {
  g: "galaxy",
  q: "quadrant",
  s: "sector",
  y: "system",
};

export default function Atlas3D() {
  const { isAuthenticated } = useAuth();
  const snapshot = useQuery(api.atlas3d.loadAtlasSnapshot) as AtlasSnapshot | undefined;

  const submitNewSystem = useMutation(api.atlas3d.submitNewSystem);
  const upsertQuadrant = useMutation(api.atlas3d.upsertQuadrant);
  const upsertSector = useMutation(api.atlas3d.upsertSector);
  const upsertSystem = useMutation(api.atlas3d.upsertSystem);
  const deleteQuadrant = useMutation(api.atlas3d.deleteQuadrant);
  const deleteSectorM = useMutation(api.atlas3d.deleteSector);
  const deleteSystemM = useMutation(api.atlas3d.deleteSystem);
  const deleteGateM = useMutation(api.atlas3d.deleteGate);
  const upsertGate = useMutation(api.atlas3d.upsertGate);
  const upsertLane = useMutation(api.atlas3d.upsertLane);
  const seedAtlasM = useMutation(api.atlas3d.seedAtlas);
  const repairAnchorsM = useMutation(api.atlas3d.seedAtlas);
  const canonStatus = useQuery(api.atlas3d.canonAnchorStatus);
  const listSubmissions = useQuery(api.atlas3d.listSubmissions, {});
  const approveSubmission = useMutation(api.atlas3d.approveSubmission);
  const rejectSubmission = useMutation(api.atlas3d.rejectSubmission);

  const [level, setLevel] = useState<AtlasLevel>("galaxy");
  const [quadrantKey, setQuadrantKey] = useState<string | null>(null);
  const [sectorKey, setSectorKey] = useState<string | null>(null);
  const [systemKey, setSystemKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ key: string; name: string } | null>(null);

  // ---- drill-down handlers -------------------------------------------------
  const pickQuadrant = (key: string) => {
    setQuadrantKey(key);
    setLevel("quadrant");
    setSectorKey(null);
    setSystemKey(null);
  };
  const pickSector = (key: string) => {
    const sector = snapshot?.sectors.find((s) => s.key === key);
    setSectorKey(key);
    setLevel("sector");
    setSystemKey(null);
    if (sector) setQuadrantKey(sector.quadrantKey);
  };
  const pickSystem = (key: string) => {
    if (level === "galaxy") {
      // Galaxy-level real-star anchors aren't charted sectors; hovering
      // shows their info panel. Only charted systems drill into system view.
      setSystemKey(key);
      return;
    }
    setSystemKey(key);
    setLevel("system");
  };

  const goUp = () => {
    if (level === "system") setLevel("sector");
    else if (level === "sector") setLevel("quadrant");
    else if (level === "quadrant") setLevel("galaxy");
  };

  // ---- Smart level jumping (HUD buttons + G/Q/S/Y keys) -------------------
  // Every level button is always enabled: if you jump to a level you haven't
  // drilled into yet, we auto-pick a sensible target (the quadrant holding
  // Sol → its first sector → that sector's first system) instead of doing
  // nothing. This is why "only G worked" before.
  const jumpTo = (lv: AtlasLevel) => {
    if (!snapshot) return;
    if (lv === "galaxy") {
      setLevel("galaxy");
      setSectorKey(null);
      setSystemKey(null);
      return;
    }
    // Resolve quadrant: current → quadrant containing Sol → first.
    let qKey = quadrantKey;
    if (!qKey || !snapshot.quadrants.some((q) => q.key === qKey)) {
      const sol = snapshot.systems.find((s) => s.key === "sol") ?? snapshot.systems.find((s) => s.isRealStar);
      const containing = sol ? snapshot.quadrants.find((q) => q.minX <= sol.x && sol.x <= q.maxX && q.minY <= sol.y && sol.y <= q.maxY) : undefined;
      qKey = containing?.key ?? snapshot.quadrants[0]?.key ?? null;
    }
    if (!qKey) return;
    setQuadrantKey(qKey);
    if (lv === "quadrant") {
      setLevel("quadrant");
      setSectorKey(null);
      setSystemKey(null);
      return;
    }
    // Resolve sector: current (if inside the quadrant) → first in quadrant.
    let sKey = sectorKey && snapshot.sectors.some((s) => s.key === sectorKey && s.quadrantKey === qKey)
      ? sectorKey
      : snapshot.sectors.find((s) => s.quadrantKey === qKey)?.key ?? null;
    if (!sKey) {
      setLevel("quadrant");
      setSectorKey(null);
      setSystemKey(null);
      return;
    }
    setSectorKey(sKey);
    if (lv === "sector") {
      setLevel("sector");
      setSystemKey(null);
      return;
    }
    // Resolve system: current (if inside the sector) → first in sector.
    const yKey =
      systemKey && snapshot.systems.some((s) => s.key === systemKey && (s.sectorKey === sKey || !s.sectorKey))
        ? systemKey
        : snapshot.systems.find((s) => s.sectorKey === sKey)?.key ?? null;
    if (!yKey) {
      setLevel("sector");
      return;
    }
    setSystemKey(yKey);
    setLevel("system");
  };

  // Keep the breadcrumb chain coherent when the snapshot shifts under us.
  useEffect(() => {
    if (!snapshot) return;
    if (quadrantKey && !snapshot.quadrants.some((q) => q.key === quadrantKey)) {
      setQuadrantKey(null);
      setLevel("galaxy");
      setSectorKey(null);
      setSystemKey(null);
      return;
    }
    if (sectorKey && !snapshot.sectors.some((s) => s.key === sectorKey)) {
      setSectorKey(null);
      setSystemKey(null);
      if (level === "sector" || level === "system") setLevel("quadrant");
    }
  }, [snapshot, quadrantKey, sectorKey, level]);

  // ---- Quadrant jumps (HUD A/S/D/F buttons + hotkeys) ---------------------
  // The four quadrant buttons jump the camera straight into that quadrant's
  // own view (regardless of the current level).
  const jumpQuadrant = (qKey: string) => {
    if (!snapshot?.quadrants.some((q) => q.key === qKey)) return;
    setQuadrantKey(qKey);
    setLevel("quadrant");
    setSectorKey(null);
    setSystemKey(null);
  };

  // ---- keyboard shortcuts G/A/S/D/F + Escape (drill up) --------------------
  // A/S/D/F map to the first→fourth charted quadrants (order = seed order).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      const k = e.key.toLowerCase();
      if (k === "g") {
        jumpTo("galaxy");
        return;
      }
      if (k === "a" || k === "s" || k === "d" || k === "f") {
        const idx = { a: 0, s: 1, d: 2, f: 3 }[k as "a" | "s" | "d" | "f"];
        const q = snapshot?.quadrants[idx];
        if (q) jumpQuadrant(q.key);
        return;
      }
      if (k === "escape") goUp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, quadrantKey, sectorKey, systemKey]);

  const focusSector = level === "sector" ? snapshot?.sectors.find((s) => s.key === sectorKey) : undefined;
  const focusQuadrant = quadrantKey ? snapshot?.quadrants.find((q) => q.key === quadrantKey) : undefined;
  const focusSystem = systemKey ? snapshot?.systems.find((s) => s.key === systemKey) : undefined;

  // Guard errors from mutations so a failed save surfaces as a toast, not an
  // unhandled rejection.
  const guard = useMemo(() => {
    return async (fn: () => Promise<unknown>, ok?: string) => {
      try {
        await fn();
        if (ok) toast.success(ok);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Operation failed.");
      }
    };
  }, []);

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-[color:var(--uf-border)]"
      style={{ height: 720, background: "#050510" }}
    >
      <div className="absolute inset-0">
        {snapshot ? (
          <AtlasCanvas
            snapshot={snapshot}
            level={level}
            quadrantKey={quadrantKey}
            sectorKey={sectorKey}
            systemKey={systemKey}
            onQuadrantPick={pickQuadrant}
            onSectorPick={pickSector}
            onSystemPick={pickSystem}
            onGatePick={() => undefined}
            onHoverSystem={setHoverInfo}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="uf-skeleton" style={{ height: 120, width: "60%" }} />
          </div>
        )}
      </div>
      {snapshot && snapshot.quadrants.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div
            className="rounded-md border border-[color:var(--uf-border)] px-4 py-3 text-sm text-uf-text pointer-events-auto"
            style={{ background: "rgba(10,10,20,0.85)" }}
          >
            <p className="font-semibold">The atlas is uncharted.</p>
            <p className="text-uf-muted text-xs mt-1">
              Seed the four canon quadrants, real-star anchors, and the Sol
              neighbourhood to begin charting.
            </p>
            {isAuthenticated ? (
              <button
                type="button"
                className="uf-btn uf-btn--primary mt-2 text-sm cursor-pointer"
                onClick={() =>
                  guard(async () => {
                    await seedAtlasM({});
                    return undefined;
                  }, "Atlas seeded.")
                }
              >
                Seed the atlas
              </button>
            ) : (
              <Link
                to="/auth?returnTo=/map"
                className="uf-btn uf-btn--primary mt-2 text-sm inline-block"
              >
                Sign in to chart the atlas
              </Link>
            )}
          </div>
        </div>
      ) : null}
      {/* ---- Stale-canon notice: legacy seed pinned everything at the core. ---- */}
      {canonStatus?.seeded && canonStatus.stale && snapshot ? (
        <div className="absolute inset-x-0 bottom-16 z-10 flex justify-center px-4 pointer-events-none">
          <div
            className="rounded-md border border-[rgba(255,204,0,0.4)] px-4 py-3 text-sm text-uf-text pointer-events-auto max-w-md"
            style={{ background: "rgba(10,10,20,0.9)" }}
          >
            <p className="font-semibold">Stellar cartography is out of date.</p>
            <p className="text-uf-muted text-xs mt-1">
              The chart was seeded before the galaxy-true recalibration — every
              anchor still sits on the galactic core. Re-run the calibration to
              place Sol and its neighbours 26,000 ly out on the Orion Spur.
            </p>
            {isAuthenticated ? (
              <button
                type="button"
                className="uf-btn uf-btn--primary mt-2 text-sm cursor-pointer"
                onClick={() =>
                  guard(async () => {
                    await repairAnchorsM({});
                    return undefined;
                  }, "Canon coordinates recalibrated.")
                }
              >
                Recalibrate canon coordinates
              </button>
            ) : (
              <Link
                to="/auth?returnTo=/map"
                className="uf-btn uf-btn--primary mt-2 text-sm inline-block"
              >
                Sign in to recalibrate
              </Link>
            )}
          </div>
        </div>
      ) : null}
      <AtlasHUD
        snapshot={snapshot}
        level={level}
        quadrantKey={quadrantKey}
        sectorKey={sectorKey}
        systemKey={systemKey}
        focusQuadrant={focusQuadrant}
        focusSector={focusSector}
        focusSystem={focusSystem}
        hoverInfo={hoverInfo}
        editing={editing}
        onEditingChange={setEditing}
        onLevelChange={(lv) => jumpTo(lv)}
        onQuadrantJump={jumpQuadrant}
        onQuadrantSelect={(key) => {
          setQuadrantKey(key);
          setLevel("quadrant");
          setSectorKey(null);
          setSystemKey(null);
        }}
        onSectorSelect={(key) => pickSector(key)}
        onSystemSelect={(key) => {
          setSystemKey(key);
          setLevel("system");
        }}
        onGoUp={goUp}
        isAuthenticated={isAuthenticated}
        submissions={listSubmissions ?? []}
        onSubmitSystem={async (data) => {
          await guard(async () => {
            await submitNewSystem({
              name: data.name,
              sectorKey: data.sectorKey,
              x: data.x,
              y: data.y,
              z: data.z,
              faction: data.faction,
              tags: data.tags,
              notes: data.notes,
              source: data.source,
            });
            return undefined;
          }, "Survey filed for Bridge review.");
        }}
        onApproveSubmission={async (id, note) => {
          await guard(async () => {
            await approveSubmission({ id: id as Id<"atlasSubmissions">, reviewNote: note });
            return undefined;
          }, "Proposal approved and charted.");
        }}
        onRejectSubmission={async (id, note) => {
          await guard(async () => {
            await rejectSubmission({ id: id as Id<"atlasSubmissions">, reviewNote: note });
            return undefined;
          }, "Proposal rejected.");
        }}
        onSaveQuadrant={async (data) => {
          await guard(async () => {
            const res = await upsertQuadrant(data);
            return res;
          }, "Quadrant saved.");
        }}
        onSaveSector={async (data) => {
          await guard(async () => {
            const res = await upsertSector(data);
            return res;
          }, "Sector saved.");
        }}
        onSaveSystem={async (data) => {
          await guard(async () => {
            const res = await upsertSystem(data);
            return res;
          }, "System charted.");
        }}
        onSaveGate={async (data) => {
          await guard(async () => {
            const res = await upsertGate(data);
            return res;
          }, "Warp gate saved.");
        }}
        onDeleteGate={async (key) => {
          await guard(async () => {
            await deleteGateM({ key });
            return undefined;
          }, "Warp gate removed.");
        }}
        onSaveLane={async (data) => {
          await guard(async () => {
            const res = await upsertLane(data);
            return res;
          }, "Transit lane added.");
        }}
        onDeleteQuadrant={async (key) => {
          await guard(async () => {
            await deleteQuadrant({ key });
            return undefined;
          }, "Quadrant deleted.");
        }}
        onDeleteSector={async (key) => {
          await guard(async () => {
            await deleteSectorM({ key });
            return undefined;
          }, "Sector deleted.");
        }}
        onDeleteSystem={async (key) => {
          await guard(async () => {
            await deleteSystemM({ key });
            return undefined;
          }, "System deleted.");
        }}
      />
    </div>
  );
}

// Re-exported for the toast-based submission flow used by EditorCard.
export { KEY_TARGET };
