import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";

const ACTION_PREFIXES = [
  "moderation.",
  "story.",
  "user.",
  "story.feature",
  "lore.feature",
  "transmission.lineup",
  "broadcast.send",
  "session.",
  "identity.",
  "resource.",
] as const;

export default function OperatorAudit() {
  const [action, setAction] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const items = useQuery(api.operator.listAuditLog, {
    limit: 200,
    action: action || undefined,
  });

  const filtered = (items ?? []).filter((row) => {
    if (!targetFilter.trim()) return true;
    return row.target?.toLowerCase().includes(targetFilter.toLowerCase());
  });

  function exportCsv() {
    if (filtered.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    const header = ["time", "action", "actor", "target", "ip", "meta"];
    const rows = filtered.map((r) => [
      new Date(r.createdAt).toISOString(),
      r.action,
      String(r.actorId ?? ""),
      r.target ?? "",
      r.ip ?? "",
      r.meta ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const v = String(cell);
            const safe = v.includes(",") || v.includes("\"" ) || v.includes("\n")
              ? `"${v.replace(/"/g, "\"\"")}"`
              : v;
            return safe;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows.`);
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <Search className="h-6 w-6 text-uf-cyan" aria-hidden />
          Audit Log
        </h1>
        <p className="text-uf-muted text-sm mt-1">
          Every operator action is recorded. Filter by action prefix or
          target, export CSV.
        </p>
      </header>

      <HoloCard>
        <div className="grid gap-3 md:grid-cols-2 mb-3">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted">
            Filter by exact action
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="moderation.approve / story.publish / …"
              className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted">
            Filter by target contains
            <input
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              placeholder="e.g. story: / user:"
              className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="uf-eyebrow">Quick filters</span>
          {ACTION_PREFIXES.map((p) => (
            <button
              key={p}
              type="button"
              className={`uf-btn ${action === p ? "uf-btn--primary" : ""}`}
              onClick={() => setAction(p)}
            >
              {p}
            </button>
          ))}
          {action ? (
            <button
              type="button"
              className="uf-btn"
              onClick={() => setAction("")}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <span
            className="text-uf-muted text-xs"
            aria-live="polite"
          >
            {filtered.length} row{filtered.length === 1 ? "" : "s"}
          </span>
          <NeonButton variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </NeonButton>
        </div>

        {items === undefined ? (
          <div className="uf-skeleton" style={{ height: 220 }} />
        ) : filtered.length === 0 ? (
          <div className="uf-empty">No audit entries match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="uf-data-grid" style={{ minWidth: 820 }}>
              <caption className="uf-sr-only">Audit log entries</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Target</th>
                  <th scope="col">IP</th>
                  <th scope="col">Meta</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row._id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td><StatusPill variant="info">{row.action}</StatusPill></td>
                    <td>{(row.actorId as string).slice(0, 10)}…</td>
                    <td>{row.target}</td>
                    <td>{row.ip ?? "—"}</td>
                    <td className="text-uf-muted" style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {row.meta ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HoloCard>
    </OperatorShell>
  );
}
