import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CornerLeftUp, Pencil, Check, X } from "lucide-react";
import { ATLAS_COLORS } from "./types";
import type { AtlasLevel, AtlasSnapshot, AtlasQuadrant, AtlasSector, AtlasSystem } from "./types";

// =========================================================================
// AtlasHUD — DOM overlay on top of the R3F canvas.
//   top-left:     breadcrumbs (each segment clickable)
//   top-right:    view-mode buttons (Galaxy/Quadrant/Sector/System)
//   bottom-left:  editor card (quadrant/sector/system/gate CRUD + queue)
//   bottom-right: object info panel
//   center:       hover tooltip
// =========================================================================

export type SubmissionRow = {
  _id: string;
  authorId: string;
  source: string;
  status: string;
  payload: string;
  operatorNotes?: string;
  createdAt: number;
};

type SavedSystem = {
  key?: string;
  name: string;
  sectorKey: string;
  x: number;
  y: number;
  z: number;
  isRealStar?: boolean;
  status: "canon" | "proposed";
  faction?: string;
  tags?: string[];
  notes?: string;
};

type GateData = {
  key?: string;
  label?: string;
  level: "galaxy" | "quadrant" | "sector" | "system";
  quadrantKey?: string;
  sectorKey?: string;
  systemKey?: string;
  x: number;
  y: number;
  z: number;
  status?: string;
};

function HudPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-md border border-[color:var(--uf-border)] backdrop-blur-sm ${className}`}
      style={{ background: ATLAS_COLORS.hud }}
    >
      {children}
    </div>
  );
}

const LEVELS: AtlasLevel[] = ["galaxy", "quadrant", "sector", "system"];
const LEVEL_LABEL: Record<AtlasLevel, string> = {
  galaxy: "Galaxy",
  quadrant: "Quadrant",
  sector: "Sector",
  system: "System",
};
const LEVEL_HOTKEY: Record<AtlasLevel, string> = { galaxy: "G", quadrant: "Q", sector: "S", system: "Y" };

export default function AtlasHUD(props: {
  snapshot: AtlasSnapshot | undefined;
  level: AtlasLevel;
  quadrantKey: string | null;
  sectorKey: string | null;
  systemKey: string | null;
  focusQuadrant?: AtlasQuadrant;
  focusSector?: AtlasSector;
  focusSystem?: AtlasSystem;
  hoverInfo: { key: string; name: string } | null;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  onLevelChange: (lv: AtlasLevel) => void;
  onQuadrantSelect: (key: string) => void;
  onSectorSelect: (key: string) => void;
  onSystemSelect: (key: string) => void;
  onGoUp: () => void;
  onQuadrantsEmpty?: boolean;
  isAuthenticated: boolean;
  submissions: SubmissionRow[];
  onSubmitSystem: (data: {
    name: string;
    sectorKey: string;
    x: number;
    y: number;
    z: number;
    faction?: string;
    tags?: string[];
    notes?: string;
    source: "mission" | "contest" | "freehand";
  }) => Promise<void>;
  onApproveSubmission: (id: string, note?: string) => Promise<void>;
  onRejectSubmission: (id: string, note?: string) => Promise<void>;
  onSaveQuadrant: (data: {
    key?: string;
    name: string;
    color: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }) => Promise<void>;
  onSaveSector: (data: {
    key?: string;
    name: string;
    quadrantKey: string;
    color: string;
    status: "canon" | "proposed";
    description?: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }) => Promise<void>;
  onSaveSystem: (data: SavedSystem) => Promise<void>;
  onSaveGate: (data: GateData) => Promise<void>;
  onDeleteGate: (key: string) => Promise<void>;
  onSaveLane: (data: { key?: string; fromKey: string; toKey: string; type: "warp" | "jump" | "trade" | "hazard"; risk: "Low" | "Medium" | "High" | "Forbidden"; factionControl?: string }) => Promise<void>;
  onDeleteQuadrant: (key: string) => Promise<void>;
  onDeleteSector: (key: string) => Promise<void>;
  onDeleteSystem: (key: string) => Promise<void>;
}) {
  const {
    snapshot,
    level,
    quadrantKey,
    sectorKey,
    systemKey,
    focusQuadrant,
    focusSector,
    focusSystem,
    hoverInfo,
    editing,
    onEditingChange,
    onLevelChange,
    onQuadrantSelect,
    onSectorSelect,
    onSystemSelect,
    onGoUp,
  } = props;
  const quadrantsEmpty = props.onQuadrantsEmpty ?? false;

  const quadrantName = focusQuadrant?.name ?? quadrantKey;
  const sectorName = focusSector?.name ?? sectorKey;
  const systemName = props.snapshot?.systems.find((s) => s.key === systemKey)?.name ?? systemKey;

  const hoverSystem = props.snapshot?.systems.find((s) => s.key === hoverInfo?.key);
  const infoSystem = level === "system" ? focusSystem : hoverSystem;
  const sectorSystems = useMemo(
    () => (snapshot && sectorKey ? snapshot.systems.filter((s) => s.sectorKey === sectorKey) : []),
    [snapshot, sectorKey],
  );

  return (
    <>
      {/* ---- Breadcrumbs (top-left) ---- */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 flex-wrap">
        <HudPanel className="flex items-center divide-x divide-[color:var(--uf-border)] text-sm">
          <button
            type="button"
            onClick={() => onLevelChange("galaxy")}
            className={`px-3 py-2 cursor-pointer transition-colors ${level === "galaxy" ? "text-uf-cyan" : "text-uf-text hover:text-uf-cyan"}`}
          >
            Galaxy
          </button>
          {quadrantKey ? (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-uf-muted" aria-hidden />
              <button
                type="button"
                onClick={() => onLevelChange("quadrant")}
                className={`px-3 py-2 cursor-pointer transition-colors ${level === "quadrant" ? "text-uf-cyan" : "text-uf-text hover:text-uf-cyan"}`}
              >
                {quadrantName}
              </button>
            </>
          ) : null}
          {sectorKey ? (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-uf-muted" aria-hidden />
              <button
                type="button"
                onClick={() => onLevelChange("sector")}
                className={`px-3 py-2 cursor-pointer transition-colors ${level === "sector" ? "text-uf-cyan" : "text-uf-text hover:text-uf-cyan"}`}
              >
                {sectorName}
              </button>
            </>
          ) : null}
          {systemKey ? (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-uf-muted" aria-hidden />
              <span className={`px-3 py-2 ${level === "system" ? "text-uf-cyan" : "text-uf-text"}`}>{systemName}</span>
            </>
          ) : null}
        </HudPanel>
        {level !== "galaxy" ? (
          <button
            type="button"
            onClick={onGoUp}
            className="ml-1 rounded-md border border-[color:var(--uf-border)] px-2.5 py-2 text-xs text-uf-muted hover:text-uf-cyan cursor-pointer inline-flex items-center gap-1"
            style={{ background: ATLAS_COLORS.hud }}
          >
            <CornerLeftUp className="h-3.5 w-3.5" aria-hidden /> Back
          </button>
        ) : null}
      </div>

      {/* ---- View buttons (top-right) ---- */}
      <div className="absolute top-3 right-3 z-10">
        <HudPanel className="flex items-center gap-1 px-2 py-1.5">
          {LEVELS.map((lv) => {
            const empty = lv === "quadrant" && quadrantsEmpty;
            return (
              <button
                key={lv}
                type="button"
                disabled={empty}
                onClick={() => onLevelChange(lv)}
                className={`px-2.5 py-1 text-xs rounded cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                  level === lv
                    ? "bg-[rgba(0,229,255,0.14)] text-uf-cyan"
                    : "text-uf-muted hover:text-uf-text"
                }`}
                title={empty ? "Seed the atlas first" : `Hotkey: ${LEVEL_HOTKEY[lv]}`}
              >
                {LEVEL_LABEL[lv]} <span className="opacity-60">{LEVEL_HOTKEY[lv]}</span>
              </button>
            );
          })}
        </HudPanel>
      </div>

      {/* ---- Hover tooltip (center) ---- */}
      {hoverInfo && level !== "system" ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[140%] z-10 pointer-events-none">
          <HudPanel className="px-3 py-1.5 text-sm text-uf-text">
            {hoverInfo.name || hoverInfo.key}
          </HudPanel>
        </div>
      ) : null}

      {/* ---- Object info (bottom-right) ---- */}
      <div className="absolute bottom-3 right-3 z-10 max-w-[300px]">
        {infoSystem ? (
          <HudPanel className="p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-uf-cyan">
              {infoSystem.isRealStar ? "Real star" : infoSystem.status === "proposed" ? "Proposed system" : "Canon system"}
            </p>
            <p className="text-base font-semibold mt-0.5">{infoSystem.name}</p>
            {infoSystem.faction ? <p className="text-xs text-uf-muted mt-1">Faction: {infoSystem.faction}</p> : null}
            {infoSystem.sectorKey ? (
              <p className="text-xs text-uf-muted">
                Sector: {snapshot?.sectors.find((s) => s.key === infoSystem.sectorKey)?.name ?? infoSystem.sectorKey}
              </p>
            ) : (
              <p className="text-xs text-uf-muted">Galactic anchor</p>
            )}
            <p className="text-[11px] text-uf-muted font-mono mt-1">
              {Math.round(infoSystem.x)}, {Math.round(infoSystem.y)}, {Math.round(infoSystem.z)}
            </p>
            {infoSystem.tags?.length ? (
              <p className="text-[11px] text-uf-muted mt-1">{infoSystem.tags.map((t) => `#${t}`).join("  ")}</p>
            ) : null}
            {infoSystem.notes ? <p className="text-xs text-uf-muted mt-1.5 leading-snug">{infoSystem.notes}</p> : null}
            {infoSystem.status === "canon" ? (
              <p className="text-[11px] mt-2" style={{ color: ATLAS_COLORS.canon }}>● canon chart</p>
            ) : (
              <p className="text-[11px] mt-2 text-uf-muted">◌ proposed — pending Bridge review</p>
            )}
            <button
              type="button"
              onClick={() => onEditingChange(true)}
              className="text-[11px] text-uf-cyan mt-2 cursor-pointer hover:underline"
            >
              <Pencil className="h-3 w-3 inline mr-1 -mt-0.5" aria-hidden /> Edit this object
            </button>
          </HudPanel>
        ) : null}
      </div>

      {/* ---- Editor card (bottom-left) ---- */}
      <div className="absolute bottom-3 left-3 z-10 w-[min(340px,calc(100%-1.5rem))]">
        <EditorCard {...props} sectorSystems={sectorSystems} />
      </div>
    </>
  );
}

// -------------------------------------------------------------------------
// EditorCard — dynamic editing for quadrants / sectors / systems / gates,
// member submissions, and (for operators) the review queue.
// -------------------------------------------------------------------------

function EditorCard(props: {
  snapshot: AtlasSnapshot | undefined;
  level: AtlasLevel;
  quadrantKey: string | null;
  sectorKey: string | null;
  systemKey: string | null;
  focusQuadrant?: AtlasQuadrant;
  focusSector?: AtlasSector;
  focusSystem?: AtlasSystem;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  onQuadrantSelect: (key: string) => void;
  onSectorSelect: (key: string) => void;
  onSystemSelect: (key: string) => void;
  isAuthenticated: boolean;
  submissions: SubmissionRow[];
  sectorSystems: { key: string; name: string }[];
  onSubmitSystem: (data: {
    name: string;
    sectorKey: string;
    x: number;
    y: number;
    z: number;
    faction?: string;
    tags?: string[];
    notes?: string;
    source: "mission" | "contest" | "freehand";
  }) => Promise<void>;
  onApproveSubmission: (id: string, note?: string) => Promise<void>;
  onRejectSubmission: (id: string, note?: string) => Promise<void>;
  onSaveQuadrant: (data: {
    key?: string;
    name: string;
    color: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }) => Promise<void>;
  onSaveSector: (data: {
    key?: string;
    name: string;
    quadrantKey: string;
    color: string;
    status: "canon" | "proposed";
    description?: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }) => Promise<void>;
  onSaveSystem: (data: SavedSystem) => Promise<void>;
  onSaveGate: (data: GateData) => Promise<void>;
  onDeleteGate: (key: string) => Promise<void>;
  onSaveLane: (data: { key?: string; fromKey: string; toKey: string; type: "warp" | "jump" | "trade" | "hazard"; risk: "Low" | "Medium" | "High" | "Forbidden"; factionControl?: string }) => Promise<void>;
  onDeleteQuadrant: (key: string) => Promise<void>;
  onDeleteSector: (key: string) => Promise<void>;
  onDeleteSystem: (key: string) => Promise<void>;
}) {
  const {
    snapshot,
    level,
    quadrantKey,
    sectorKey,
    systemKey,
    focusQuadrant,
    focusSector,
    focusSystem,
    editing,
    onEditingChange,
  } = props;
  const [tab, setTab] = useState<"system" | "sector" | "quadrant" | "gate" | "lane" | "queue">("system");
  const [name, setName] = useState("");
  const [coords, setCoords] = useState({ x: 0, y: 0, z: 0 });
  const [status, setStatus] = useState<"canon" | "proposed">("canon");
  const [faction, setFaction] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("#4da6ff");
  const [sectorStatus, setSectorStatus] = useState<"canon" | "proposed">("canon");
  const [targetSector, setTargetSector] = useState("");
  const [gateLevel, setGateLevel] = useState<"galaxy" | "quadrant" | "sector" | "system">("sector");
  const [gateLabel, setGateLabel] = useState("");
  const [laneFrom, setLaneFrom] = useState("");
  const [laneTo, setLaneTo] = useState("");
  const [laneType, setLaneType] = useState<"warp" | "jump" | "trade" | "hazard">("warp");
  const [laneRisk, setLaneRisk] = useState<"Low" | "Medium" | "High" | "Forbidden">("Low");
  const [busy, setBusy] = useState(false);

  // When the operator selects an object (click in the map or drill in),
  // prefill the matching tab's fields with the selected object's data so
  // "rename/move" is just: change a field → save.
  useEffect(() => {
    if (!editing) return;
    if (systemKey && focusSystem) {
      setTab("system");
      setName(focusSystem.name);
      setCoords({ x: focusSystem.x, y: focusSystem.y, z: focusSystem.z });
      setStatus(focusSystem.status === "proposed" ? "proposed" : "canon");
      setFaction(focusSystem.faction ?? "");
      setTags((focusSystem.tags ?? []).join(", "));
      setNotes(focusSystem.notes ?? "");
      setTargetSector(focusSystem.sectorKey ?? "");
      return;
    }
    if (level === "sector" && focusSector) {
      setTab("sector");
      setName(focusSector.name);
      setColor(focusSector.color);
      setSectorStatus(focusSector.status === "proposed" ? "proposed" : "canon");
      setNotes(focusSector.description ?? "");
      return;
    }
    if (level === "quadrant" && focusQuadrant) {
      setTab("quadrant");
      setName(focusQuadrant.name);
      setColor(focusQuadrant.color);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemKey, level, editing, focusSystem?.key, focusSector?.key, focusQuadrant?.key]);

  const inputCls =
    "w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-2.5 py-1.5 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none";

  if (!editing) {
    return (
      <HudPanel className="p-2.5">
        <button
          type="button"
          onClick={() => onEditingChange(true)}
          className="text-xs text-uf-cyan inline-flex items-center gap-1.5 cursor-pointer hover:text-uf-text"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Chart / edit the atlas
        </button>
        <p className="text-[10px] text-uf-muted mt-1">G·Q·S·Y switch views · Esc drills up · scroll zooms</p>
      </HudPanel>
    );
  }

  const field = (label: string, node: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.14em] text-uf-muted">
      {label}
      {node}
    </label>
  );

  async function submitMemberSystem() {
    if (!name.trim() || !targetSector) return;
    setBusy(true);
    try {
      await props.onSubmitSystem({
        name: name.trim(),
        sectorKey: targetSector,
        x: coords.x,
        y: coords.y,
        z: coords.z,
        faction: faction || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: notes || undefined,
        source: "freehand",
      });
      setName("");
      setNotes("");
    } finally {
      setBusy(false);
    }
  }

  async function saveObject(kind: "quadrant" | "sector" | "system") {
    setBusy(true);
    try {
      if (kind === "quadrant") {
        // Editing the focused quadrant keeps its bounds; new quadrants frame
        // a ±20,000 cube around the entered coordinates.
        const editingExisting = tab === "quadrant" && focusQuadrant && name.trim() === focusQuadrant.name;
        await props.onSaveQuadrant({
          key: editingExisting ? focusQuadrant!.key : undefined,
          name: name.trim(),
          color,
          minX: coords.x - 20000,
          maxX: coords.x + 20000,
          minY: coords.y - 20000,
          maxY: coords.y + 20000,
          minZ: -2000,
          maxZ: 2000,
        });
      } else if (kind === "sector") {
        if (!quadrantKey) return;
        const editingExisting = focusSector && name.trim() === focusSector.name;
        await props.onSaveSector({
          key: editingExisting ? focusSector!.key : undefined,
          name: name.trim(),
          quadrantKey: focusSector?.quadrantKey ?? quadrantKey,
          color,
          status: sectorStatus,
          description: notes || undefined,
          minX: coords.x - 500,
          maxX: coords.x + 500,
          minY: coords.y - 500,
          maxY: coords.y + 500,
          minZ: coords.z - 200,
          maxZ: coords.z + 200,
        });
      } else {
        await props.onSaveSystem({
          key: focusSystem && name.trim() === focusSystem.name ? focusSystem.key : undefined,
          name: name.trim(),
          sectorKey: targetSector || sectorKey || "",
          x: coords.x,
          y: coords.y,
          z: coords.z,
          isRealStar: focusSystem?.isRealStar,
          status,
          faction: faction || undefined,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          notes: notes || undefined,
        });
      }
      setName("");
      setNotes("");
    } finally {
      setBusy(false);
    }
  }

  async function saveGate() {
    if (!gateLabel.trim()) return;
    setBusy(true);
    try {
      await props.onSaveGate({
        label: gateLabel.trim(),
        level: gateLevel,
        quadrantKey: gateLevel === "quadrant" || gateLevel === "sector" ? (focusQuadrant?.key ?? quadrantKey ?? undefined) : undefined,
        sectorKey: gateLevel === "sector" ? (focusSector?.key ?? sectorKey ?? undefined) : undefined,
        systemKey: gateLevel === "system" ? (focusSystem?.key ?? systemKey ?? undefined) : undefined,
        x: coords.x,
        y: coords.y,
        z: coords.z,
        status: "active",
      });
      setGateLabel("");
    } finally {
      setBusy(false);
    }
  }

  async function saveLane() {
    if (!laneFrom || !laneTo) return;
    setBusy(true);
    try {
      await props.onSaveLane({ fromKey: laneFrom, toKey: laneTo, type: laneType, risk: laneRisk });
      setLaneFrom("");
      setLaneTo("");
    } finally {
      setBusy(false);
    }
  }

  const pending = props.submissions.filter((s) => s.status === "proposed");
  const allSectors = snapshot?.sectors ?? [];
  const allSystems = snapshot?.systems ?? [];
  const sectorGates = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.gates.filter((g) =>
      gateLevel === "galaxy"
        ? g.level === "galaxy"
        : gateLevel === "quadrant"
          ? g.level === "quadrant"
          : g.level === "sector" && g.sectorKey === sectorKey,
    );
  }, [snapshot, gateLevel, sectorKey]);

  return (
    <HudPanel className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex gap-1 flex-wrap">
          {(["system", "sector", "quadrant", "gate", "lane", "queue"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-2 py-0.5 text-[11px] rounded cursor-pointer transition-colors ${
                tab === t ? "bg-[rgba(0,229,255,0.14)] text-uf-cyan" : "text-uf-muted hover:text-uf-text"
              }`}
            >
              {t === "queue" ? `Queue${pending.length ? ` (${pending.length})` : ""}` : t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onEditingChange(false)}
          className="text-uf-muted hover:text-uf-red cursor-pointer"
          aria-label="Close editor"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {tab === "system" ? (
        <div className="grid gap-2">
          {field("Name", <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Helios Reach" />)}
          {field(
            "Sector",
            <select className={inputCls} value={targetSector || sectorKey || ""} onChange={(e) => setTargetSector(e.target.value)}>
              <option value="">— galaxy anchor —</option>
              {allSectors.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>,
          )}
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((ax) =>
              field(
                ax,
                <input
                  className={inputCls}
                  type="number"
                  value={coords[ax]}
                  onChange={(e) => setCoords((c) => ({ ...c, [ax]: Number(e.target.value) }))}
                />,
              ),
            )}
          </div>
          {field(
            "Status",
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as "canon" | "proposed")}>
              <option value="canon">canon</option>
              <option value="proposed">proposed</option>
            </select>,
          )}
          {field("Faction", <input className={inputCls} value={faction} onChange={(e) => setFaction(e.target.value)} placeholder="Star Force" />)}
          {field("Tags", <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="jump-hub, strategic" />)}
          {field("Operator notes", <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />)}
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => saveObject("system")}
            className="uf-btn uf-btn--primary text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Charting…" : focusSystem && name.trim() === focusSystem.name ? "Update selected system" : "Chart system"}
          </button>
          {systemKey ? (
            <button
              type="button"
              onClick={() => props.onDeleteSystem(systemKey)}
              className="text-[11px] text-uf-red cursor-pointer hover:underline text-left"
            >
              Delete selected system
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === "sector" ? (
        <div className="grid gap-2">
          {field("Name", <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kestrel Verge" />)}
          <p className="text-[10px] text-uf-muted">
            Parent quadrant: {snapshot?.quadrants.find((q) => q.key === (focusSector?.quadrantKey ?? quadrantKey))?.name ?? "select one in the map"}
          </p>
          {field("Color", <input type="color" className={`${inputCls} h-9 cursor-pointer`} value={color} onChange={(e) => setColor(e.target.value)} />)}
          {field(
            "Status",
            <select className={inputCls} value={sectorStatus} onChange={(e) => setSectorStatus(e.target.value as "canon" | "proposed")}>
              <option value="canon">canon</option>
              <option value="proposed">proposed</option>
            </select>,
          )}
          {field("Description", <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />)}
          <button
            type="button"
            disabled={busy || !name.trim() || !(focusSector || quadrantKey)}
            onClick={() => saveObject("sector")}
            className="uf-btn uf-btn--primary text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Saving…" : focusSector && name.trim() === focusSector.name ? "Update selected sector" : "Create sector"}
          </button>
          {focusSector ? (
            <>
              <button
                type="button"
                onClick={() => props.onDeleteSector(focusSector.key)}
                className="text-[11px] text-uf-red cursor-pointer hover:underline text-left"
              >
                Delete selected sector
              </button>
              <div className="border-t border-[color:var(--uf-border)] pt-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-uf-muted mb-1">Systems here: {props.sectorSystems.length}</p>
                <ul className="text-[11px] text-uf-text max-h-24 overflow-y-auto">
                  {props.sectorSystems.map((s) => (
                    <li key={s.key}>
                      <button type="button" className="hover:text-uf-cyan cursor-pointer" onClick={() => props.onSystemSelect(s.key)}>
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "quadrant" ? (
        <div className="grid gap-2">
          {field("Name", <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Quadrant Epsilon" />)}
          {field("Color", <input type="color" className={`${inputCls} h-9 cursor-pointer`} value={color} onChange={(e) => setColor(e.target.value)} />)}
          <p className="text-[10px] text-uf-muted">New quadrants frame a ±20,000 cube around the coordinates above (system tab).</p>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => saveObject("quadrant")}
            className="uf-btn uf-btn--primary text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Saving…" : focusQuadrant && name.trim() === focusQuadrant.name ? "Update selected quadrant" : "Create quadrant"}
          </button>
          <ul className="text-[11px] max-h-28 overflow-y-auto">
            {(snapshot?.quadrants ?? []).map((q) => (
              <li key={q.key} className="flex items-center justify-between gap-2">
                <button type="button" className="cursor-pointer hover:underline text-left" style={{ color: q.color }} onClick={() => props.onQuadrantSelect(q.key)}>
                  {q.name}
                </button>
                <button type="button" className="text-uf-red/70 hover:text-uf-red cursor-pointer" onClick={() => props.onDeleteQuadrant(q.key)} aria-label={`Delete ${q.name}`}>
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "gate" ? (
        <div className="grid gap-2">
          {field("Label", <input className={inputCls} value={gateLabel} onChange={(e) => setGateLabel(e.target.value)} placeholder="Kestrel Verge Gate" />)}
          {field(
            "Anchored at",
            <select className={inputCls} value={gateLevel} onChange={(e) => setGateLevel(e.target.value as typeof gateLevel)}>
              <option value="galaxy">galaxy</option>
              <option value="quadrant">quadrant</option>
              <option value="sector">sector</option>
              <option value="system">system</option>
            </select>,
          )}
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((ax) =>
              field(
                ax,
                <input
                  className={inputCls}
                  type="number"
                  value={coords[ax]}
                  onChange={(e) => setCoords((c) => ({ ...c, [ax]: Number(e.target.value) }))}
                />,
              ),
            )}
          </div>
          <button
            type="button"
            disabled={busy || !gateLabel.trim()}
            onClick={saveGate}
            className="uf-btn uf-btn--primary text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Saving…" : "Add warp gate"}
          </button>
          {sectorGates.length ? (
            <div className="border-t border-[color:var(--uf-border)] pt-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-uf-muted mb-1">Gates at this level</p>
              <ul className="text-[11px]">
                {sectorGates.map((g) => (
                  <li key={g.key} className="flex items-center justify-between gap-2">
                    <span className="truncate">{g.label ?? g.key}</span>
                    <button type="button" className="text-uf-red/70 hover:text-uf-red cursor-pointer" onClick={() => props.onDeleteGate(g.key)} aria-label={`Delete ${g.label ?? g.key}`}>
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "lane" ? (
        <div className="grid gap-2">
          {field(
            "From system",
            <select className={inputCls} value={laneFrom} onChange={(e) => setLaneFrom(e.target.value)}>
              <option value="">— pick —</option>
              {allSystems.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>,
          )}
          {field(
            "To system",
            <select className={inputCls} value={laneTo} onChange={(e) => setLaneTo(e.target.value)}>
              <option value="">— pick —</option>
              {allSystems.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>,
          )}
          <div className="grid grid-cols-2 gap-2">
            {field(
              "Type",
              <select className={inputCls} value={laneType} onChange={(e) => setLaneType(e.target.value as typeof laneType)}>
                <option value="warp">warp</option>
                <option value="jump">jump</option>
                <option value="trade">trade</option>
                <option value="hazard">hazard</option>
              </select>,
            )}
            {field(
              "Risk",
              <select className={inputCls} value={laneRisk} onChange={(e) => setLaneRisk(e.target.value as typeof laneRisk)}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Forbidden</option>
              </select>,
            )}
          </div>
          <button
            type="button"
            disabled={busy || !laneFrom || !laneTo}
            onClick={saveLane}
            className="uf-btn uf-btn--primary text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Saving…" : "Add transit lane"}
          </button>
        </div>
      ) : null}

      {tab === "queue" ? (
        <div className="grid gap-2 max-h-64 overflow-y-auto">
          {pending.length === 0 ? (
            <p className="text-[11px] text-uf-muted">No proposals awaiting review.</p>
          ) : (
            pending.map((sub) => {
              const p = JSON.parse(sub.payload) as { name: string; sectorKey: string; x: number; y: number; z: number; faction?: string; notes?: string };
              return (
                <div key={sub._id} className="rounded-md border border-[color:var(--uf-border)] p-2">
                  <p className="text-sm text-uf-text">{p.name}</p>
                  <p className="text-[10px] text-uf-muted">
                    {sub.source} · sector {p.sectorKey} · ({p.x}, {p.y}, {p.z})
                  </p>
                  {p.faction ? <p className="text-[10px] text-uf-muted">faction: {p.faction}</p> : null}
                  {p.notes ? <p className="text-[11px] text-uf-muted mt-1 leading-snug">{p.notes}</p> : null}
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => props.onApproveSubmission(sub._id)}
                      className="text-[11px] text-uf-green cursor-pointer inline-flex items-center gap-1 hover:underline"
                    >
                      <Check className="h-3 w-3" aria-hidden /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onRejectSubmission(sub._id)}
                      className="text-[11px] text-uf-red cursor-pointer inline-flex items-center gap-1 hover:underline"
                    >
                      <X className="h-3 w-3" aria-hidden /> Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {!props.isAuthenticated ? (
        <p className="text-[10px] text-uf-muted mt-2">
          Sign in to propose systems — the Bridge reviews every chart.
        </p>
      ) : null}
    </HudPanel>
  );
}

export { EditorCard };
