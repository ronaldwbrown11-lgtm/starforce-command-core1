import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { CoverPicker, readImageDimensions } from "@/components/operator/CoverPicker";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Coins, Download, FileText, Package, Plus, Trash2, Truck, Upload } from "lucide-react";

type ProductRow = {
  _id: Id<"storeProducts">;
  slug: string;
  title: string;
  description: string;
  kind: string;
  category: string;
  creditAmount?: number | null;
  priceCents: number;
  variants: string[];
  hasFile: boolean;
  fileMeta: { fileName: string; mimeType: string; byteSize: number } | null;
  coverUrl: string | null;
  status: string;
};

type OrderRow = {
  _id: Id<"storeOrders">;
  productTitle: string;
  variant: string | null;
  amountCents: number;
  kind: string;
  status: string;
  shippingName: string | null;
  shippingAddress: string | null;
  trackingNote: string | null;
  createdAt: number;
  buyerName: string;
};

const ORDER_VARIANT: Record<string, "success" | "info" | "gold" | "warning" | "default"> = {
  paid: "gold",
  fulfilled: "success",
  shipped: "info",
  cancelled: "warning",
};

export default function StoreManage() {
  const products = useQuery(api.store.listAllProductsAdmin, {});
  const orders = useQuery(api.store.listAllOrders, {});

  const createProduct = useMutation(api.store.createProduct);
  const updateProduct = useMutation(api.store.updateProduct);
  const removeProduct = useMutation(api.store.removeProduct);
  const generateUploadUrl = useMutation(api.store.generateProductUploadUrl);
  const attachFile = useMutation(api.store.attachProductFile);
  const removeFile = useMutation(api.store.removeProductFile);
  const attachCover = useMutation(api.store.attachProductCover);
  const removeCover = useMutation(api.store.removeProductCover);
  const updateOrder = useMutation(api.store.updateOrderStatus);

  // ---- create form ----
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"digital" | "physical" | "credits">("digital");
  const [category, setCategory] = useState("Lore Bibles");
  const [price, setPrice] = useState("14.99");
  const [creditAmount, setCreditAmount] = useState("500");
  const [variants, setVariants] = useState("");
  const [creating, setCreating] = useState(false);
  // File chosen pre-create; uploaded right after the product row exists.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"products" | "orders">("products");

  // ---- per-row cover picker ----
  const [coverFor, setCoverFor] = useState<Id<"storeProducts"> | null>(null);

  const orderList = orders ?? [];
  const openPhysical = orderList.filter((o) => o.kind === "physical" && o.status !== "shipped" && o.status !== "cancelled").length;

  async function uploadToStorage(file: File, purpose: "digital_file" | "cover") {
    const url = await generateUploadUrl({ purpose });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const { storageId } = (await res.json()) as { storageId: string };
    return storageId as Id<"_storage">;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!title.trim() || !description.trim() || !Number.isFinite(priceCents)) {
      toast.error("Title, description, and a valid price are required.");
      return;
    }
    const creditValue = kind === "credits" ? parseInt(creditAmount, 10) : undefined;
    if (
      kind === "credits" &&
      (!Number.isFinite(creditValue) ||
        (creditValue as number) < 100 ||
        (creditValue as number) % 100 !== 0)
    ) {
      toast.error("Credit caches must be a whole multiple of 100 (100+).",
      );
      return;
    }
    try {
      setCreating(true);
      const { id } = await createProduct({
        title,
        description,
        kind,
        category: kind === "credits" && !category.trim() ? "Star Credits" : category,
        priceCents,
        creditAmount: creditValue,
        variants:
          kind === "physical" && variants.trim()
            ? variants.split(",").map((v) => v.trim()).filter(Boolean)
            : undefined,
      });
      toast.success("Requisition published to the depot.");

      // Attach the pre-selected file/cover now that the row exists.
      if (kind === "digital" && pendingFile) {
        try {
          const storageId = await uploadToStorage(pendingFile, "digital_file");
          await attachFile({
            productId: id,
            storageId,
            fileName: pendingFile.name,
            mimeType: pendingFile.type || "application/octet-stream",
            byteSize: pendingFile.size,
          });
          toast.success("Download file attached.");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "File attach failed — add it from the row below.",
          );
        }
      }
      if (pendingCover) {
        try {
          const storageId = await uploadToStorage(pendingCover, "cover");
          const dims = await readImageDimensions(pendingCover);
          await attachCover({
            productId: id,
            storageId,
            meta: {
              mimeType: pendingCover.type,
              byteSize: pendingCover.size,
              width: dims?.w,
              height: dims?.h,
            },
          });
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Cover attach failed — add it from the row below.",
          );
        }
      }

      setTitle("");
      setDescription("");
      setPrice("14.99");
      setCreditAmount("500");
      setVariants("");
      setPendingFile(null);
      setPendingCover(null);
      setPendingCoverPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setCreating(false);
    }
  }

  async function handlePickPendingCover(file: File) {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
      toast.error("Cover must be JPEG, PNG, WebP, or AVIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover must be 5 MB or smaller.");
      return;
    }
    setPendingCover(file);
    setPendingCoverPreview(URL.createObjectURL(file));
  }

  async function attachRowFile(row: ProductRow, file: File) {
    try {
      const storageId = await uploadToStorage(file, "digital_file");
      await attachFile({
        productId: row._id,
        storageId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
      });
      toast.success("Download file updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <OperatorShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold mt-0">Requisition Depot</h1>
          <p className="text-uf-muted text-sm mt-1">
            Publish lore bibles and merch; fulfill physical orders. Digital files unlock
            for buyers automatically when payment clears.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Store sections">
          {(
            [
              ["products", "Products"],
              ["orders", `Orders${openPhysical ? ` (${openPhysical} open)` : ""}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={
                "uf-btn text-sm " + (tab === key ? "uf-btn--primary" : "uf-btn--ghost")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "products" ? (
        <>
          <HoloCard accent="cyan" className="mb-8">
            <h2 className="uf-eyebrow">Publish a requisition</h2>
            <form onSubmit={handleCreate} className="grid gap-3 mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={140}
                    required
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                    placeholder="Ultra Force Lore Bible — Volume I"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Price (USD)
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="decimal"
                    required
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text font-mono"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Kind
                  <select
                    value={kind}
                    onChange={(e) =>
                      setKind(e.target.value as "digital" | "physical" | "credits")
                    }
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                  >
                    <option value="digital">Digital download</option>
                    <option value="physical">Physical merchandise</option>
                    <option value="credits">Star Credit cache</option>
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Category
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    maxLength={60}
                    required
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                    placeholder="Lore Bibles / Apparel / Artifacts"
                  />
                </label>
              </div>
              <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  required
                  className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                  placeholder="What the fleet gets — 128 pages of canon, printable sector charts, …"
                />
              </label>
              {kind === "credits" ? (
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Star Credits granted (exact, no surge)
                  <input
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    required
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text font-mono"
                    placeholder="500"
                  />
                  <span className="text-[11px] normal-case tracking-normal text-uf-muted">
                    Granted exactly at fulfillment — multiples of 100, max 100,000.
                    Suggested pairings: 500 @ $4.99 · 1,200 @ $9.99 · 2,600 @ $19.99.
                  </span>
                </label>
              ) : kind === "physical" ? (
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Options (comma-separated — sizes, colors)
                  <input
                    value={variants}
                    onChange={(e) => setVariants(e.target.value)}
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                    placeholder="S, M, L, XL, 2XL"
                  />
                </label>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    className="sr-only"
                    aria-label="Digital download file"
                    accept=".pdf,.zip,.epub,.txt,.md,.jpg,.jpeg,.png,.webp,application/pdf,application/zip,application/epub+zip,text/plain,text/markdown,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f && f.size > 100 * 1024 * 1024) {
                        toast.error("File must be 100 MB or smaller.");
                        return;
                      }
                      setPendingFile(f);
                      e.target.value = "";
                    }}
                  />
                  <NeonButton
                    type="button"
                    variant="ghost"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {pendingFile ? `File: ${pendingFile.name}` : "Attach download file (optional now)"}
                  </NeonButton>
                  {pendingFile ? (
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      className="text-xs uppercase tracking-[0.16em] text-uf-muted hover:text-uf-red"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={undefined}
                  type="file"
                  className="sr-only"
                  aria-label="Card image"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  id="store-pending-cover-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePickPendingCover(f);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor="store-pending-cover-input"
                  className="uf-btn uf-btn--ghost text-sm cursor-pointer"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  {pendingCoverPreview ? "Replace card image" : "Card image (optional)"}
                </label>
                {pendingCoverPreview ? (
                  <img
                    src={pendingCoverPreview}
                    alt="Card image preview"
                    className="h-14 w-24 object-cover rounded-md border border-[color:var(--uf-border)]"
                  />
                ) : null}
              </div>
              <div>
                <NeonButton type="submit" variant="primary" loading={creating}>
                  <Plus className="h-4 w-4" aria-hidden /> Publish to depot
                </NeonButton>
              </div>
            </form>
          </HoloCard>

          {products === undefined ? (
            <div className="uf-skeleton" style={{ height: 200 }} />
          ) : !products.length ? (
            <div className="uf-empty">No requisitions published yet.</div>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <HoloCard key={p._id} className="flex flex-wrap items-center gap-4">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="h-16 w-24 rounded-md object-cover border border-[color:var(--uf-border)]"
                    />
                  ) : (
                    <div className="h-16 w-24 rounded-md border border-dashed border-[color:var(--uf-border)] grid place-items-center text-uf-muted text-[10px] uppercase tracking-[0.14em]">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold flex flex-wrap items-center gap-2">
                      {p.title}
                      <StatusPill
                        variant={
                          p.kind === "digital"
                            ? "info"
                            : p.kind === "credits"
                              ? "gold"
                              : "violet"
                        }
                      >
                        {p.kind === "digital" ? (
                          <>
                            <Download className="h-3 w-3" aria-hidden /> Digital
                          </>
                        ) : p.kind === "credits" ? (
                          <>
                            <Coins className="h-3 w-3" aria-hidden /> Credit cache
                          </>
                        ) : (
                          <>
                            <Package className="h-3 w-3" aria-hidden /> Physical
                          </>
                        )}
                      </StatusPill>
                      {p.status !== "active" ? (
                        <StatusPill variant="warning">Retired</StatusPill>
                      ) : null}
                    </p>
                    <p className="m-0 text-xs text-uf-muted mt-1">
                      ${" "}
                      {(p.priceCents / 100).toFixed(2)} · {p.category}
                      {p.kind === "credits" ? (
                        <span className="ml-2 font-mono" style={{ color: "var(--uf-gold)" }}>
                          grants {p.creditAmount?.toLocaleString() ?? "—"} ★
                        </span>
                      ) : p.kind === "digital" ? (
                        p.fileMeta ? (
                          <span className="inline-flex items-center gap-1 ml-2">
                            <FileText className="h-3 w-3" aria-hidden />
                            {p.fileMeta.fileName} ({(p.fileMeta.byteSize / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                        ) : (
                          <span className="ml-2 text-uf-gold">No file attached</span>
                        )
                      ) : p.variants.length ? (
                        <span className="ml-2">{p.variants.join(" / ")}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.kind === "digital" ? (
                      <>
                        <label className="uf-btn uf-btn--ghost text-xs cursor-pointer">
                          <Upload className="h-3.5 w-3.5" aria-hidden />
                          {p.fileMeta ? "Replace file" : "Attach file"}
                          <input
                            type="file"
                            className="sr-only"
                            aria-label={`Upload file for ${p.title}`}
                            accept=".pdf,.zip,.epub,.txt,.md,.jpg,.jpeg,.png,.webp,application/pdf,application/zip,application/epub+zip,text/plain,text/markdown,image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void attachRowFile(p, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {p.fileMeta ? (
                          <button
                            type="button"
                            onClick={() =>
                              void removeFile({ productId: p._id }).then(
                                () => toast.success("File removed."),
                                (err) =>
                                  toast.error(
                                    err instanceof Error ? err.message : "Remove failed.",
                                  ),
                              )
                            }
                            className="uf-btn uf-btn--ghost text-xs"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove file
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCoverFor(coverFor === p._id ? null : p._id)}
                      className="uf-btn uf-btn--ghost text-xs"
                    >
                      {p.coverUrl ? "Card image ✓" : "Add card image"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void updateProduct({
                          id: p._id,
                          status: p.status === "active" ? "retired" : "active",
                        }).then(
                          () =>
                            toast.success(
                              p.status === "active"
                                ? "Requisition retired."
                                : "Requisition re-listed.",
                            ),
                          (err) =>
                            toast.error(err instanceof Error ? err.message : "Update failed."),
                        )
                      }
                      className="uf-btn uf-btn--ghost text-xs"
                    >
                      {p.status === "active" ? "Retire" : "Re-list"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete "${p.title}"? Products with orders are retired instead.`))
                          return;
                        void removeProduct({ id: p._id }).then(
                          (res) =>
                            toast.success(
                              res.retired
                                ? "Has orders — retired instead of deleted."
                                : "Requisition deleted.",
                            ),
                          (err) =>
                            toast.error(err instanceof Error ? err.message : "Delete failed."),
                        );
                      }}
                      className="uf-btn uf-btn--ghost text-xs text-uf-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                    </button>
                  </div>
                  {coverFor === p._id ? (
                    <div className="w-full pt-2">
                      <CoverPicker
                        rowId={p._id}
                        currentUrl={p.coverUrl}
                        onChange={() => undefined}
                        kind="store"
                      />
                    </div>
                  ) : null}
                </HoloCard>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {orders === undefined ? (
            <div className="uf-skeleton" style={{ height: 200 }} />
          ) : !orderList.length ? (
            <div className="uf-empty">No orders yet.</div>
          ) : (
            orderList.map((o) => <OrderRow key={o._id} order={o} onStatus={updateOrder} />)
          )}
        </div>
      )}
    </OperatorShell>
  );
}

function OrderRow({
  order,
  onStatus,
}: {
  order: OrderRow;
  onStatus: ReturnType<typeof useMutation<typeof api.store.updateOrderStatus>>;
}) {
  const [note, setNote] = useState(order.trackingNote ?? "");
  return (
    <HoloCard className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold flex flex-wrap items-center gap-2">
          {order.productTitle}
          {order.variant ? <span className="text-uf-muted">· {order.variant}</span> : null}
          <StatusPill variant={ORDER_VARIANT[order.status] ?? "default"}>
            {order.status}
          </StatusPill>
        </p>
        <p className="m-0 text-xs text-uf-muted mt-1">
          {order.buyerName} · ${" "}
          {(order.amountCents / 100).toFixed(2)} ·{" "}
          {new Date(order.createdAt).toLocaleDateString()} ·{" "}
          {order.kind === "digital" ? "instant download" : "physical shipment"}
        </p>
        {order.kind === "physical" && order.shippingAddress ? (
          <p className="m-0 text-xs text-uf-muted mt-1">
            <Truck className="h-3 w-3 inline mr-1" aria-hidden />
            {order.shippingName ?? "Buyer"} — {order.shippingAddress}
          </p>
        ) : null}
        {order.kind === "physical" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tracking / fulfillment note"
              maxLength={300}
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-1.5 text-xs bg-[rgba(16,24,39,0.5)] text-uf-text flex-1 min-w-[180px]"
            />
            <button
              type="button"
              className="uf-btn uf-btn--primary text-xs"
              onClick={() =>
                void onStatus({
                  id: order._id,
                  status: "shipped",
                  trackingNote: note || undefined,
                }).then(
                  () => toast.success("Marked shipped."),
                  (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
                )
              }
            >
              Mark shipped
            </button>
            {order.status !== "fulfilled" ? (
              <button
                type="button"
                className="uf-btn uf-btn--ghost text-xs"
                onClick={() =>
                  void onStatus({ id: order._id, status: "fulfilled" }).then(
                    () => toast.success("Marked fulfilled."),
                    (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
                  )
                }
              >
                Mark fulfilled
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </HoloCard>
  );
}
