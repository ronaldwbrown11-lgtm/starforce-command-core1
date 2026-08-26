import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard } from "@/components/uf";
import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Search, ChevronDown, ChevronUp, HelpCircle, MessageSquare } from "lucide-react";
import { Link } from "react-router";

const FAQ_CATEGORIES = [
  { id: "", label: "All" },
  { id: "general", label: "General" },
  { id: "membership", label: "Membership" },
  { id: "content", label: "Content & Submissions" },
  { id: "technical", label: "Technical" },
  { id: "account", label: "Account" },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[color:var(--uf-border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left bg-[rgba(5,8,22,0.5)] hover:bg-[rgba(5,8,22,0.8)] transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-uf-text">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 text-uf-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-uf-muted shrink-0" />}
      </button>
      {open ? (
        <div className="px-5 py-4 border-t border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.3)]">
          <p className="text-sm text-uf-muted leading-relaxed">{a}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function Faqs() {
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const items = useQuery(api.faqs.listPublished);

  usePageMeta({
    title: "FAQs — Star Force Base 1198",
    description: "Frequently asked questions about Star Force Base 1198 — membership, content, missions, and technical help.",
  });

  const filtered = useMemo(() => {
    if (!items) return undefined;
    let list = items;
    if (cat) list = list.filter((i) => i.category === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, cat, search]);

  const grouped = useMemo(() => {
    if (!filtered) return {};
    const groups: Record<string, typeof filtered> = {};
    for (const item of filtered) {
      const key = item.category ?? "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filtered]);

  return (
    <SiteShell>
      <PageHero
        eyebrow="FAQs"
        title="Questions from the fleet."
        lead="Everything you need to know about Star Force Base 1198 — membership tiers, content submissions, missions, and more."
        primary={{ label: "Contact Support", href: "/support", variant: "primary" }}
      />
      <section className="uf-section max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-uf-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="w-full pl-11 pr-4 py-3 rounded-lg border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
          />
        </div>

        {/* Category tabs */}
        <nav className="flex flex-wrap gap-2 mb-8" aria-label="FAQ categories">
          {FAQ_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                cat === c.id
                  ? "bg-[rgba(0,229,255,0.15)] text-[var(--uf-cyan)] border border-[rgba(0,229,255,0.4)]"
                  : "bg-[rgba(255,255,255,0.04)] text-uf-muted border border-[color:var(--uf-border)] hover:text-uf-text"
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>

        {filtered === undefined ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="uf-skeleton" style={{ height: 56 }} />))}
          </div>
        ) : filtered.length === 0 ? (
          <HoloCard>
            <div className="uf-empty">
              <HelpCircle className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>{search ? "No questions match your search." : "No FAQs published yet."}</p>
            </div>
          </HoloCard>
        ) : cat || search ? (
          <div className="flex flex-col gap-3">
            {filtered.map((item, idx) => (
              <ScrollReveal key={item._id} staggerIndex={idx}>
                <FaqItem q={item.question} a={item.answer} />
              </ScrollReveal>
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([category, catItems], gIdx) => (
            <ScrollReveal key={category} staggerIndex={gIdx}>
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-uf-text mb-3 capitalize">{category}</h2>
                <div className="flex flex-col gap-3">
                  {catItems.map((item) => (
                    <FaqItem key={item._id} q={item.question} a={item.answer} />
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))
        )}

        {/* Still need help */}
        <HoloCard className="mt-10 text-center">
          <MessageSquare className="h-8 w-8 mx-auto mb-3 text-[var(--uf-cyan)]" />
          <h3 className="text-lg font-semibold text-uf-text mb-1">Still need help?</h3>
          <p className="text-uf-muted text-sm mb-4">Our operators are standing by.</p>
          <Link to="/support" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--uf-cyan)] text-[#0a0a0c] font-semibold text-sm hover:brightness-110 transition">
            Open Support
          </Link>
        </HoloCard>
      </section>
    </SiteShell>
  );
}
