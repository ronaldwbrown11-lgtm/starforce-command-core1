import { useState } from "react";
import type { StarData, StarCategory } from "./galaxyData";
import { STAR_CATEGORIES, CATEGORY_LIST } from "./galaxyData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  star: StarData; currentName: string; currentNotes: string; currentCategory: StarCategory;
  isOpen: boolean; isNew?: boolean;
  onSave: (star: StarData, name: string, category: StarCategory, notes: string) => Promise<void>;
  onReset: () => Promise<void>; onClose: () => void;
  readOnly?: boolean;
}
export function StarDialog({ star, currentName, currentNotes, currentCategory, isOpen, isNew, readOnly = false, onSave, onReset, onClose }: Props) {
  const [name, setName] = useState(currentName);
  const [notes, setNotes] = useState(currentNotes);
  const [category, setCategory] = useState<StarCategory>(currentCategory);
  const [position, setPosition] = useState(star.position.map(String));
  const [color, setColor] = useState(star.color);
  const [size, setSize] = useState(String(star.size));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputClass = "w-full rounded-md border border-white/20 bg-white/5 p-2 text-sm text-white";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setBusy(true); setError("");
    try {
      const point = position.map(Number) as [number, number, number];
      if (position.some(value => !value.trim()) || !point.every(Number.isFinite)) throw new Error("Enter finite coordinates");
      await onSave({ ...star, position: point, color, size: Number(size) }, name, category, notes);
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (star.isCustom && !confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true); setError("");
    try { await onReset(); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Reset failed"); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="dark max-h-[90vh] overflow-y-auto border-white/15 bg-slate-950 text-white">
        <DialogHeader><DialogTitle>{isNew ? "Add a lore star" : "Edit star lore"}</DialogTitle>
          <DialogDescription className="text-slate-400">{star.isReal ? `${star.defaultName} · ${star.source} · ${star.distancePc?.toFixed(2)} pc from Sol. Catalog position preserved; displayed radius exaggerated.` : "Place your fictional star in the shared canon galaxy. Coordinates use galactic map units."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs">Star name<input aria-label="Star name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="block text-xs">Lore category<select aria-label="Lore category" value={category} onChange={e => setCategory(e.target.value as StarCategory)} className={`${inputClass} mt-1`}>
            <option value="none" className="bg-slate-950">Uncategorized</option>
            {CATEGORY_LIST.map(cat => <option key={cat} value={cat} className="bg-slate-950">{STAR_CATEGORIES[cat].label}</option>)}
          </select></label>
          <label className="block text-xs">Lore notes<textarea aria-label="Lore notes" rows={5} maxLength={20000} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputClass} mt-1`} /></label>
          {star.isCustom && <>
            <div className="grid grid-cols-3 gap-2">{["X", "Y", "Z"].map((axis, i) => <label key={axis} className="text-xs">{axis}<input aria-label={`${axis} coordinate`} type="number" step="any" min={-100} max={100} required value={position[i]} onChange={e => setPosition(prev => prev.map((v, j) => j === i ? e.target.value : v))} className={`${inputClass} mt-1`} /></label>)}</div>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs">Stellar color<input aria-label="Stellar color" type="color" value={color} onChange={e => setColor(e.target.value)} className={`${inputClass} mt-1 h-10`} /></label><label className="text-xs">Display size<input aria-label="Display size" type="number" min={0.1} max={5} step={0.1} required value={size} onChange={e => setSize(e.target.value)} className={`${inputClass} mt-1`} /></label></div>
          </>}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {readOnly ? (
            <p className="text-xs text-slate-400">
              View only — the canon chart is maintained by fleet operators.
            </p>
          ) : (
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy} className="bg-amber-300 text-black hover:bg-amber-200">{busy ? "Saving…" : isNew ? "Create star" : "Save lore star"}</Button>
            {!isNew && <Button type="button" disabled={busy} variant="outline" onClick={reset}>{star.isCustom ? confirmDelete ? "Confirm delete star" : "Delete star" : "Reset lore"}</Button>}
          </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
