import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Download, Package, Truck } from "lucide-react";
import { useConvex } from "convex/react";
import { useState } from "react";

type Ent = {
  _id: string;
  productId: string;
  grantedAt: number;
  product: {
    slug: string;
    title: string;
    kind: string;
    category: string;
    hasFile: boolean;
    fileMeta: { fileName: string; mimeType: string; byteSize: number } | null;
  } | null;
};

type Order = {
  _id: string;
  productTitle: string;
  variant: string | null;
  amountCents: number;
  currency: string;
  kind: string;
  status: string;
  trackingNote: string | null;
  createdAt: number;
};

const ORDER_LABEL: Record<string, string> = {
  paid: "Payment received",
  fulfilled: "Fulfilled",
  shipped: "Shipped",
  cancelled: "Cancelled",
};

const ORDER_VARIANT: Record<string, "success" | "info" | "gold" | "default" | "warning"> = {
  paid: "gold",
  fulfilled: "success",
  shipped: "info",
  cancelled: "warning",
};

export function MyRequisitions() {
  const ents = useQuery(api.store.myEntitlements, {});
  const orders = useQuery(api.store.myOrders, {});
  const convex = useConvex();
  const [busy, setBusy] = useState<string | null>(null);

  async function download(ent: Ent) {
    if (!ent.product) return;
    try {
      setBusy(ent._id);
      const { url, fileName } = (await convex.query(api.store.getFileDownloadUrl, {
        productId: ent.productId as never,
      })) as { url: string; fileName: string };
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  const loading = ents === undefined || orders === undefined;

  return (
    <div className="space-y-4">
      <section aria-label="Owned downloads">
        <h3 className="text-sm uppercase tracking-[0.16em] text-uf-muted mb-3 flex items-center gap-2">
          <Download className="h-4 w-4 text-uf-cyan" aria-hidden /> Your downloads
        </h3>
        {loading ? (
          <div className="uf-skeleton" style={{ height: 90 }} />
        ) : !ents?.length ? (
          <p className="uf-muted text-sm text-uf-muted m-0">
            No owned downloads yet — lore bibles you requisition appear here permanently.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {ents.map((ent) =>
              ent.product?.kind === "digital" ? (
                <li key={ent._id}>
                  <HoloCard className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 font-medium">{ent.product.title}</p>
                      <p className="m-0 text-xs text-uf-muted mt-0.5">
                        {ent.product.category} · unlocked{" "}
                        {new Date(ent.grantedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy === ent._id || !ent.product.hasFile}
                      onClick={() => void download(ent)}
                      className="uf-btn uf-btn--primary text-sm disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      {ent.product.hasFile ? "Download again" : "File pending"}
                    </button>
                  </HoloCard>
                </li>
              ) : null,
            )}
            {ents.every((e) => e.product?.kind !== "digital") && ents.length ? (
              <li className="text-sm text-uf-muted">Physical requisitions only — no downloads.</li>
            ) : null}
          </ul>
        )}
      </section>

      <section aria-label="Order history">
        <h3 className="text-sm uppercase tracking-[0.16em] text-uf-muted mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-uf-violet" aria-hidden /> Order history
        </h3>
        {loading ? (
          <div className="uf-skeleton" style={{ height: 90 }} />
        ) : !orders?.length ? (
          <p className="text-sm text-uf-muted m-0">
            No requisitions on record yet. The{" "}
            <a href="/store" className="text-uf-cyan underline">
              Requisition Depot
            </a>{" "}
            awaits.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {orders.map((o) => (
              <li key={o._id}>
                <HoloCard className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 font-medium">
                      {o.productTitle}
                      {o.variant ? <span className="text-uf-muted"> · {o.variant}</span> : null}
                    </p>
                    <p className="m-0 text-xs text-uf-muted mt-0.5">
                      ${" "}
                      {(o.amountCents / 100).toFixed(2)} ·{" "}
                      {new Date(o.createdAt).toLocaleDateString()}
                      {o.kind === "physical" && o.trackingNote ? (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <Truck className="h-3 w-3" aria-hidden /> {o.trackingNote}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <StatusPill variant={ORDER_VARIANT[o.status] ?? "default"}>
                    {ORDER_LABEL[o.status] ?? o.status}
                  </StatusPill>
                </HoloCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
