import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Link } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill, NeonButton } from "@/components/uf";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Download, FileText, Package, ShieldCheck, ShoppingBag } from "lucide-react";

type ProductRow = {
  _id: string;
  slug: string;
  title: string;
  description: string;
  kind: string;
  category: string;
  priceCents: number;
  currency: string;
  variants: string[];
  hasFile: boolean;
  fileMeta: { fileName: string; mimeType: string; byteSize: number } | null;
  coverUrl: string | null;
};

function fmtPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Store() {
  const products = useQuery(api.store.listProducts, {});
  const { isAuthenticated } = useAuth();
  const convex = useConvex();
  const checkout = useAction(api.stripe.createStoreCheckoutSession);
  const [busy, setBusy] = useState<string | null>(null);
  const [variant, setVariant] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("");

  usePageMeta({
    title: "Requisition Depot — Star Force Base 1198",
    description:
      "Official fleet requisitions: lore bibles, sector atlases, and printed artifacts. Digital downloads unlock instantly; merch ships from the base.",
    noindex: false,
  });

  const categories = [...new Set((products ?? []).map((p) => p.category))].sort();
  const filtered = category ? (products ?? []).filter((p) => p.category === category) : products;

  async function buy(product: ProductRow) {
    if (!isAuthenticated) {
      toast.error("Sign in to requisition from the depot.");
      return;
    }
    if (product.kind === "physical" && product.variants.length && !variant[product._id]) {
      toast.error("Choose an option first.");
      return;
    }
    try {
      setBusy(product._id);
      const { url } = await checkout({
        productId: product._id as never,
        variant: variant[product._id] || undefined,
        origin: window.location.origin,
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout could not start.");
      setBusy(null);
    }
  }

  async function download(product: ProductRow) {
    try {
      setBusy(product._id);
      const { url, fileName } = (await convex.query(api.store.getFileDownloadUrl, {
        productId: product._id as never,
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

  return (
    <SiteShell>
      <PageHero
        eyebrow="Requisition Depot"
        title="Official fleet requisitions."
        lead="Lore bibles, sector atlases, and printed artifacts of the Ultra Force universe. Digital files unlock the moment payment clears — and downloads are reserved for the members who earned them."
        primary={{ label: "Browse the depot", href: "#depot", variant: "primary" }}
        secondary={{ label: "My requisitions", href: "/account", variant: "ghost" }}
      />
      <section id="depot" className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="uf-eyebrow">Catalog</span>
            <h2 className="text-3xl font-semibold mt-2">
              {products === undefined
                ? "Loading depot…"
                : `${filtered?.length ?? 0} item${filtered?.length === 1 ? "" : "s"} available`}
            </h2>
          </div>
          {categories.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              <button
                type="button"
                onClick={() => setCategory("")}
                className={
                  "text-xs uppercase tracking-[0.16em] rounded-md border px-3 py-1.5 " +
                  (category === ""
                    ? "border-[color:var(--uf-cyan)] text-uf-cyan"
                    : "border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text")
                }
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={
                    "text-xs uppercase tracking-[0.16em] rounded-md border px-3 py-1.5 " +
                    (category === c
                      ? "border-[color:var(--uf-cyan)] text-uf-cyan"
                      : "border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {products === undefined ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 300 }} />
            ))}
          </div>
        ) : !filtered?.length ? (
          <div className="uf-empty">
            The depot is stocking its shelves. Operators publish requisitions from
            the console — check back after the next supply run.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, idx) => (
              <ScaleReveal key={p._id} staggerIndex={idx}>
                <HoloCard className="h-full flex flex-col">
                  {p.coverUrl ? (
                    <figure className="-mt-3 -mx-3 mb-3 rounded-t-md overflow-hidden border-b border-[color:var(--uf-border)]">
                      <img
                        src={p.coverUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="block w-full h-44 object-cover bg-[rgba(16,24,39,0.85)]"
                      />
                    </figure>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill variant={p.kind === "digital" ? "info" : "violet"}>
                      {p.kind === "digital" ? (
                        <>
                          <Download className="h-3 w-3" aria-hidden /> Digital
                        </>
                      ) : (
                        <>
                          <Package className="h-3 w-3" aria-hidden /> Physical
                        </>
                      )}
                    </StatusPill>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-uf-muted">
                      {p.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mt-3">{p.title}</h3>
                  <p className="text-uf-muted text-sm mt-2 line-clamp-3">{p.description}</p>
                  {p.kind === "digital" && p.fileMeta ? (
                    <p className="text-uf-muted text-xs mt-2 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-uf-cyan" aria-hidden />
                      {p.fileMeta.fileName} · {(p.fileMeta.byteSize / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  ) : null}
                  {p.kind === "physical" && p.variants.length ? (
                    <fieldset className="mt-3">
                      <legend className="text-[11px] uppercase tracking-[0.16em] text-uf-muted mb-1">
                        Options
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {p.variants.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setVariant((s) => ({ ...s, [p._id]: v }))}
                            aria-pressed={variant[p._id] === v}
                            className={
                              "text-xs rounded-md border px-3 py-1.5 " +
                              (variant[p._id] === v
                                ? "border-[color:var(--uf-cyan)] text-uf-cyan"
                                : "border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text")
                            }
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-lg font-semibold text-uf-text">
                      {fmtPrice(p.priceCents)}
                    </span>
                    <NeonButton
                      variant={p.kind === "digital" ? "primary" : "ghost"}
                      disabled={busy === p._id || (p.kind === "digital" && !p.hasFile)}
                      onClick={() => (p.kind === "digital" ? void download(p) : void buy(p))}
                    >
                      {p.kind === "digital"
                        ? p.hasFile
                          ? "Download"
                          : "Publishing soon"
                        : "Requisition"}
                    </NeonButton>
                  </div>
                </HoloCard>
              </ScaleReveal>
            ))}
          </div>
        )}

        <aside className="uf-card mt-8 flex flex-wrap items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-uf-green shrink-0 mt-0.5" aria-hidden />
          <p className="text-uf-muted text-sm m-0">
            <strong className="text-uf-text">Clearance note:</strong> lore downloads are
            restricted to their creators and paid requisitions — the depot never serves
            a file without checking your record first. Physical orders ship with a
            standard fleet rate collected at checkout.
          </p>
        </aside>

        {!isAuthenticated ? (
          <p className="text-center text-uf-muted text-sm mt-6">
            <Link to="/auth?returnTo=/store" className="text-uf-cyan underline">
              Sign in
            </Link>{" "}
            to requisition — membership is free.
          </p>
        ) : null}
      </section>
    </SiteShell>
  );
}
