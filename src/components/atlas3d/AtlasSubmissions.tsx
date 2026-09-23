import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { HoloCard, NeonButton } from "@/components/uf";
import { Radio, Send } from "lucide-react";

// =========================================================================
// AtlasSubmissions — the member-facing charting desk under the 3D atlas:
// propose a system (mission / contest / freehand) and track its review.
// =========================================================================

export default function AtlasSubmissions() {
  const { isAuthenticated } = useAuth();
  const mySubmissions = useQuery(api.atlas3d.listSubmissions, {});
  const snapshot = useQuery(api.atlas3d.loadAtlasSnapshot);
  const submitNewSystem = useMutation(api.atlas3d.submitNewSystem);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sectorKey, setSectorKey] = useState("");
  const [coords, setCoords] = useState({ x: 0, y: 0, z: 0 });
  const [faction, setFaction] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) {
    return null; // The HUD card already prompts sign-in.
  }

  const mine = (mySubmissions ?? []).slice(0, 8);

  async function handleSubmit() {
    if (!name.trim()) return toast.error("Name your system first.");
    if (!sectorKey) return toast.error("Pick the sector it lives in.");
    setBusy(true);
    try {
      await submitNewSystem({
        name: name.trim(),
        sectorKey,
        x: coords.x,
        y: coords.y,
        z: coords.z,
        faction: faction || undefined,
        notes: notes || undefined,
        source: "freehand",
      });
      toast.success("Survey filed — the Bridge will review your proposal.");
      setName("");
      setFaction("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-2.5 py-1.5 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none";

  return (
    <HoloCard className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-uf-cyan" aria-hidden />
          <h2 className="text-lg font-semibold">Propose a system</h2>
        </div>
        <NeonButton variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide form" : "New proposal"}
        </NeonButton>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1">
            System name
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Helios Reach" />
          </label>
          <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1">
            Sector
            <select className={inputCls} value={sectorKey} onChange={(e) => setSectorKey(e.target.value)}>
              <option value="">Pick a sector…</option>
              {(snapshot?.sectors ?? []).map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            {(["x", "y", "z"] as const).map((ax) => (
              <label key={ax} className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1">
                {ax} (canonical)
                <input
                  className={inputCls}
                  type="number"
                  value={coords[ax]}
                  onChange={(e) => setCoords((c) => ({ ...c, [ax]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </div>
          <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1">
            Faction (optional)
            <input className={inputCls} value={faction} onChange={(e) => setFaction(e.target.value)} placeholder="Star Force" />
          </label>
          <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1">
            Survey notes (optional)
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Signal echoes suggest a jump hub…" />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <NeonButton variant="primary" onClick={handleSubmit} loading={busy} disabled={busy}>
              <Send className="h-4 w-4 mr-1" aria-hidden /> File survey
            </NeonButton>
          </div>
        </div>
      ) : null}

      {mine.length > 0 ? (
        <div className="mt-5 border-t border-[color:var(--uf-border)] pt-4">
          <p className="text-xs uppercase tracking-[0.14em] text-uf-muted mb-2">Your surveys</p>
          <ul className="flex flex-col gap-1.5">
            {mine.map((s) => {
              const p = JSON.parse(s.payload) as { name: string };
              const tone =
                s.status === "approved" ? "text-uf-green" : s.status === "rejected" ? "text-uf-red" : "text-uf-gold";
              return (
                <li key={s._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className={`text-xs uppercase tracking-[0.12em] ${tone}`}>{s.status}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </HoloCard>
  );
}
