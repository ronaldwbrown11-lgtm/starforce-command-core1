import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LANE_TIER_COLORS, laneTier, type LaneTier } from "./mapGeometry";
export interface SavedWarpLane { id: string; name: string; color: string; fromId: string; toId: string; customColor?: boolean }
export interface WarpEndpoint { id: string; name: string; kind: string; position: [number, number, number] }
/** Everything the editor needs to resume after a map pick round-trip — the
 *  editor snapshots it, closes, and remounts with the picked id merged in. */
export interface LaneDraft {
  id?: string;
  name: string;
  fromId: string;
  toId: string;
  color: string;
  customColor: boolean;
}
export interface WarpCrud {
  save: (draft: Omit<SavedWarpLane, "id"> & { id?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
const TIER_LABEL: Record<LaneTier, string> = {
  quadrant: "Quadrant hub ↔ Quadrant hub",
  sector: "Sector hub ↔ Sector hub",
  system: "System / star ↔ System / star",
};
export function WarpLaneEditor({ lanes, endpoints, crud, onClose, initialLaneId, initialDraft, onPickMap }: { lanes: SavedWarpLane[]; endpoints: WarpEndpoint[]; crud: WarpCrud; onClose: () => void; initialLaneId?: string; initialDraft?: LaneDraft | null; onPickMap?: (which: "from" | "to", draft: LaneDraft) => void }) {
  // Opened straight into a lane (map label click), resumed after a map pick,
  // or a blank new lane.
  const initial = lanes.find(l => l.id === initialLaneId);
  const seed: LaneDraft | null = initialDraft ?? (initial
    ? { id: initial.id, name: initial.name, fromId: initial.fromId, toId: initial.toId, color: initial.color, customColor: initial.customColor ?? false }
    : null);
  const [id, setId] = useState<string | undefined>(seed?.id);
  const [name, setName] = useState(seed?.name ?? "");
  const [fromId, setFromId] = useState(seed?.fromId ?? endpoints[0]?.id ?? "");
  const [toId, setToId] = useState(seed?.toId ?? endpoints[1]?.id ?? "");
  const [color, setColor] = useState(seed?.color ?? "#22d3ee");
  const [customColor, setCustomColor] = useState(seed?.customColor ?? false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const input = "mt-1 w-full rounded-md border border-white/20 bg-slate-900 p-2 text-sm";
  function selectLane(lane: SavedWarpLane) {
    setId(lane.id); setName(lane.name); setFromId(lane.fromId); setToId(lane.toId);
    setColor(lane.color); setCustomColor(lane.customColor ?? false); setConfirm(false); setError("");
  }
  function newLane() { setId(undefined); setName(""); setCustomColor(false); setConfirm(false); setError(""); }
  const kindOf = (ref: string) => endpoints.find(e => e.id === ref)?.kind ?? "System";
  const tier = laneTier(kindOf(fromId), kindOf(toId));
  const tierColor = LANE_TIER_COLORS[tier];
  const effectiveColor = customColor ? color : tierColor;
  /** Snapshot the in-progress lane so the editor can close for a map pick and
   *  come back exactly where it left off. */
  const snapshot = (): LaneDraft => ({ id, name, fromId, toId, color, customColor });
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try { if (fromId === toId) throw new Error("Choose different endpoints"); await crud.save({ id, name, color: effectiveColor, fromId, toId, customColor }); newLane(); }
    catch(err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!id) return;
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try { await crud.remove(id); newLane(); } catch(err) { setError(err instanceof Error ? err.message : "Delete failed"); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="dark max-h-[90vh] overflow-y-auto border-white/15 bg-slate-950 text-white">
      <DialogHeader><DialogTitle>Warp gate lanes</DialogTitle><DialogDescription>Every lane is two warp gates connected by a line. Gates can sit on quadrants, sectors, star systems, or stars — connect any two, even across levels. Pick an endpoint from the list, or hit 📍 Map to click it on the galaxy (snaps to the nearest warp gate or reference star). Lane names are editable; lanes are color-coded by level.</DialogDescription></DialogHeader>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
        {(Object.keys(LANE_TIER_COLORS) as LaneTier[]).map(key => (
          <span key={key} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LANE_TIER_COLORS[key] }} />
            {TIER_LABEL[key]}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={newLane}>+ New lane</Button>{lanes.map(lane => <Button key={lane.id} type="button" variant="outline" onClick={() => selectLane(lane)}>{lane.name}</Button>)}</div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs">Lane name<input aria-label="Lane label" required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={input} /></label>
        {(["From", "To"] as const).map(label => <label key={label} className="block text-xs">{label}<span className="mt-1 flex gap-1.5"><select aria-label={`${label} endpoint`} required value={label === "From" ? fromId : toId} onChange={e => (label === "From" ? setFromId : setToId)(e.target.value)} className="w-full rounded-md border border-white/20 bg-slate-900 p-2 text-sm"><option value="">Choose endpoint</option>{(["Quadrant", "Hub", "Sector", "System", "Star", "Gate"] as const).map(kind => { const group = endpoints.filter(point => point.kind === kind); if (group.length === 0) return null; return <optgroup key={kind} label={`${kind}s`}>{group.map(point => <option key={point.id} value={point.id}>{point.name}</option>)}</optgroup>; })}</select>{onPickMap && <button type="button" title="Pick this endpoint on the map — snaps to the nearest warp gate or reference star" onClick={() => onPickMap(label === "From" ? "from" : "to", snapshot())} className="shrink-0 rounded-md border border-cyan-300/40 bg-slate-900 px-2.5 text-xs text-cyan-200 hover:bg-slate-800">📍 Map</button>}</span></label>)}
        <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
          <p className="text-xs text-slate-300 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: effectiveColor }} />
            {TIER_LABEL[tier]} — level color
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={customColor} onChange={e => setCustomColor(e.target.checked)} />
            Custom color
          </label>
          {customColor && <label className="block text-xs">Lane color<input aria-label="Lane color" type="color" value={color} onChange={e => setColor(e.target.value)} className={`${input} h-10`} /></label>}
        </div>
        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        <div className="flex gap-2"><Button disabled={busy || endpoints.length < 2} type="submit" className="bg-cyan-300 text-black hover:bg-cyan-200">{busy ? "Saving…" : id ? "Save lane" : "Add lane"}</Button>{id && <Button type="button" variant="outline" disabled={busy} onClick={remove}>{confirm ? "Confirm delete" : "Delete lane"}</Button>}</div>
        {endpoints.length < 2 && <p className="text-xs text-slate-400">Create at least two atlas regions, systems, or stars first.</p>}
      </form>
    </DialogContent>
  </Dialog>;
}
