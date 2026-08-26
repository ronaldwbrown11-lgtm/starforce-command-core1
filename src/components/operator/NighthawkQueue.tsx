import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";

type Vehicle = { id: number; designation: string; category: string; builder: string; registry_number?: string; review_status: string; primary_spec?: string; notes?: string };

export function NighthawkQueue() {
  const load = useAction(api.nighthawk.pendingVehicles);
  const review = useAction(api.nighthawk.reviewVehicle);
  const [rows, setRows] = useState<Vehicle[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function refresh() {
    try { const result = await load(); setRows((result.records ?? []) as Vehicle[]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load vehicles."); }
  }
  async function decide(id: number, reviewStatus: "approved" | "rejected" | "changes_requested") {
    setBusy(id);
    try { await review({ id, reviewStatus }); setRows((current) => current?.filter((row) => row.id !== id) ?? current); toast.success(`Vehicle ${reviewStatus.replace("_", " ")}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Review failed."); }
    finally { setBusy(null); }
  }

  return <section aria-label="Nighthawk vehicle submissions"><header className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><span className="uf-eyebrow">Hostinger / Nighthawk</span><h2 className="text-xl font-semibold mt-1">Vehicle Submissions</h2><p className="text-uf-muted text-sm">Review submissions stored in the live vehicles database.</p></div><NeonButton variant="ghost" onClick={refresh}>Load queue</NeonButton></header>{rows === null ? <HoloCard><p className="uf-empty">Select “Load queue” to retrieve pending vehicles.</p></HoloCard> : rows.length === 0 ? <HoloCard><p className="uf-empty">No vehicles are waiting for review.</p></HoloCard> : <ul className="flex flex-col gap-3 list-none p-0 m-0">{rows.map((row) => <li key={row.id}><HoloCard><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-semibold">{row.designation}</h3><p className="text-uf-muted text-sm">{row.category} · {row.builder}</p><p className="text-uf-muted text-xs mt-1">Registry: {row.registry_number || "Not supplied"}</p></div><StatusPill variant="warning">{row.review_status}</StatusPill></div><p className="text-sm mt-3">{row.primary_spec || row.notes || "No additional notes supplied."}</p><div className="flex flex-wrap gap-2 mt-4"><NeonButton variant="primary" disabled={busy === row.id} onClick={() => decide(row.id, "approved")}>Approve</NeonButton><NeonButton variant="danger" disabled={busy === row.id} onClick={() => decide(row.id, "rejected")}>Reject</NeonButton><NeonButton variant="ghost" disabled={busy === row.id} onClick={() => decide(row.id, "changes_requested")}>Request changes</NeonButton></div></HoloCard></li>)}</ul>}</section>;
}
