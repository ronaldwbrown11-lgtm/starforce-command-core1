import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SiteShell,
  HoloCard,
  NeonButton,
  StatusPill,
  StatCard,
  Starfield,
} from "@/components/uf";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  BookOpen,
  Calendar,
  Cpu,
  Dna,
  Flag,
  Globe,
  Hourglass,
  Lightbulb,
  Library,
  Map as MapIcon,
  MessageSquare,
  Palette,
  PenLine,
  Pencil,
  Rocket,
  Shield,
  Ship,
  Sparkles,
  Target,
  Trophy,
  User,
  Users,
} from "lucide-react";
import goldPlateUrl from "@/assets/gold-plate-texture.jpg";
import { DEFAULT_HUB_CARDS } from "@/lib/hubCards";

// =========================================================================
// THE FORGE OF CANON — Creator Hub command deck.
//
// Five battle stations, all wired to real product surfaces:
//   1. Create      — draft a NEW canon entry (character, starship, sector,
//                    species, technology, faction, event, timeline)
//   2. Expand      — reinforce an EXISTING lore entry
//                    (background, history, culture, visual, event, mission,
//                    character connection)
//   3. Operations  — report to a unit, squad, forum, contest, or arc
//   4. Resources   — bibles, maps, guides, blueprints, faction profiles
//   5. Recognition — commendation, standings, rank, credits, badges
//
// Proposals flow to the operator Content Desk → Proposals tab, where an
// approval publishes to the lore archive and rewards the author.
// =========================================================================

type CreateType = {
  id: string;
  label: string;
  hint: string;
  icon: typeof User;
  /** When set, the card opens this page instead of the proposal composer. */
  href?: string;
};

const CREATE_TYPES: CreateType[] = [
  { id: "character", label: "Add Character", hint: "Personnel file: a pilot, officer, or entity of record.", icon: User },
  { id: "starship", label: "Add Starship", hint: "Hull record: a class or named vessel in the registry.", icon: Rocket },
  { id: "sector", label: "Add Sector", hint: "A region of charted space under fleet watch.", icon: Globe },
  { id: "species", label: "Add Species", hint: "Species database — open the Biology Lab.", icon: Dna, href: "/biology-lab" },
  { id: "technology", label: "Add Technology", hint: "Technology database — open the Research Lab.", icon: Cpu, href: "/research-lab" },
  { id: "faction", label: "Add Faction", hint: "A power, bloc, or command structure.", icon: Flag },
  { id: "event", label: "Add Event", hint: "A battle, disaster, or turning point in the record.", icon: Calendar },
  { id: "timeline", label: "Timeline Entry", hint: "A dated marker on the historical record.", icon: Hourglass },
];

const EXPAND_TYPES: CreateType[] = [
  { id: "background", label: "Add Background", hint: "Origins and formative context.", icon: BookOpen },
  { id: "history", label: "Add History", hint: "What happened, and when.", icon: Hourglass },
  { id: "cultural_notes", label: "Cultural Notes", hint: "Customs, language, beliefs.", icon: Library },
  { id: "visual_description", label: "Visual Description", hint: "How it looks on screen or page.", icon: Palette },
  { id: "related_event", label: "Related Event", hint: "Link a canon event to this entry.", icon: Calendar },
  { id: "mission_hook", label: "Mission Involving This Lore", hint: "An operation shaped by this entry.", icon: Target },
  { id: "character_connection", label: "Character Connection", hint: "Tie a person to this entry.", icon: User },
];

// Quick-link cards in the Resources section — served by the operator-managed
// hubCards table (Content Desk → Hub cards) with the built-in set as fallback.
type HubCardRow = {
  label: string;
  description: string;
  href: string;
  icon?: string;
  tag?: string;
};

/** lucide key → component for the `icon` field on each card. */
const CARD_ICONS: Record<string, typeof User> = {
  book: BookOpen,
  user: User,
  ship: Ship,
  cpu: Cpu,
  map: MapIcon,
  globe: Globe,
  hourglass: Hourglass,
  pen: PenLine,
  flag: Flag,
  shield: Shield,
  library: Library,
  target: Target,
  users: Users,
  rocket: Rocket,
  trophy: Trophy,
  sparkles: Sparkles,
};

type ProposalForm = {
  kind: "create" | "expand";
  entryType: string;
  title: string;
  body: string;
  excerpt: string;
  faction: string;
  sector: string;
  parentLoreId: Id<"loreEntries"> | undefined;
};

const EMPTY_FORM: ProposalForm = {
  kind: "create",
  entryType: "character",
  title: "",
  body: "",
  excerpt: "",
  faction: "",
  sector: "",
  parentLoreId: undefined,
};

// ---------------------------------------------------------------------------
// GOLD PLATE ACCENTS
// Same asset as the Wall of Honor plaques and the Home command plate. Applied
// as the hero lettering, section rules, card trim, CTA plates, and the final
// command panel so the texture reads as one material across the deck.
// ---------------------------------------------------------------------------

const goldLayer = `linear-gradient(180deg, rgba(255,244,200,0.50) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.26) 100%), url(${goldPlateUrl})`;

/** Full plate — frames, plates, and framed panels. */
const GOLD_PLATE: CSSProperties = {
  backgroundImage: goldLayer,
  backgroundSize: "100% 100%, cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

/** Plate under a dark scrim — panels where light text must stay readable. */
const goldScrim = (top: string, bottom: string): CSSProperties => ({
  backgroundColor: "#070B14",
  backgroundImage: `linear-gradient(180deg, ${top}, ${bottom}), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
});

/** Thin gold rule used under headings and between battle stations. */
const GOLD_RULE: CSSProperties = {
  backgroundImage: `linear-gradient(90deg, rgba(243,200,73,0.95) 0%, rgba(230,168,23,0.35) 60%, rgba(230,168,23,0) 100%), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
};

const GOLD_RULE_FLIP: CSSProperties = {
  backgroundImage: `linear-gradient(270deg, rgba(243,200,73,0.95) 0%, rgba(230,168,23,0.35) 60%, rgba(230,168,23,0) 100%), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
};

/** Trim strip across the top edge of every command card. */
const GOLD_EDGE: CSSProperties = {
  backgroundImage: `linear-gradient(90deg, rgba(230,168,23,0) 0%, rgba(243,200,73,0.85) 18%, rgba(243,200,73,0.85) 82%, rgba(230,168,23,0) 100%), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
};

/** Primary CTA plate — bright gold for dark command-deck text. */
const GOLD_BUTTON: CSSProperties = {
  backgroundImage: `linear-gradient(180deg, rgba(255,244,200,0.55) 0%, rgba(255,255,255,0.08) 45%, rgba(90,60,10,0.24) 100%), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

/** Headline lettering filled with the plate itself (solid gold fallback). */
const GOLD_LETTERING: CSSProperties = {
  backgroundColor: "#F3C849",
  backgroundImage: `url(${goldPlateUrl})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};

const HOLO_GRID: CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(0,229,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.07) 1px, transparent 1px)",
  backgroundSize: "44px 44px",
  WebkitMaskImage:
    "radial-gradient(75% 65% at 50% 45%, #000 25%, transparent 100%)",
  maskImage: "radial-gradient(75% 65% at 50% 45%, #000 25%, transparent 100%)",
};

/** Gold trim strip pinned to the top edge of a command card. */
function GoldEdge() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
      style={GOLD_EDGE}
    />
  );
}

/** Animated holographic gold divider with a glowing command glyph. */
function GoldDivider({ glyph = "◆" }: { glyph?: string }) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12" aria-hidden>
      <div className="flex items-center gap-3">
        <span className="h-[2px] flex-1" style={GOLD_RULE} />
        <span
          className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-sm border border-[color:var(--uf-gold)] px-1.5 text-[0.6rem] font-bold text-[#1A1300] animate-pulse"
          style={GOLD_PLATE}
        >
          {glyph}
        </span>
        <span className="h-[2px] flex-1" style={GOLD_RULE_FLIP} />
      </div>
    </div>
  );
}

/** Command-deck section header: gold eyebrow, gold rule, muted briefing. */
function DeckHeader({
  index,
  label,
  title,
  lead,
}: {
  index: string;
  label: string;
  title: string;
  lead: string;
}) {
  return (
    <header className="mb-6">
      <span className="uf-eyebrow uf-eyebrow--gold">
        {index} · {label}
      </span>
      <h2 className="text-3xl font-semibold mt-2">{title}</h2>
      <span
        aria-hidden
        className="mt-3 block h-[3px] w-36 rounded-full"
        style={GOLD_RULE}
      />
      <p className="text-uf-muted text-sm mt-3 max-w-2xl">{lead}</p>
    </header>
  );
}

export default function CreatorHub() {
  usePageMeta({
    title: "The Forge of Canon — Creator Hub · Star Force Base 1198",
    description:
      "Draft new canon, reinforce existing records, deploy with your unit, and earn recognition aboard Star Force Base 1198 — the Creator Hub, Forge of Canon.",
  });

  const { isAuthenticated, user } = useAuth();
  const proposals = useQuery(api.creatorHub.myProposals, {});
  const recentLore = useQuery(api.content.listLore, { limit: 40 });
  const groups = useQuery(api.groups.listGroups, {});
  const forums = useQuery(api.groups.trendingForumThreads, { limit: 4 });
  const contests = useQuery(api.contests.listContests, { limit: 6 });
  const arcs = useQuery(api.engagement.listArcs, {});
  const resources = useQuery(api.content.listResources, { limit: 12 });
  const hubCards = useQuery(api.content.listHubCards, {});
  const leaderboard = useQuery(api.social.leaderboard, { limit: 5 });
  const spotlight = useQuery(api.social.memberSpotlight, {});
  const progress = useQuery(api.social.rankProgress, {});

  const submit = useMutation(api.creatorHub.submitProposal);
  const [form, setForm] = useState<ProposalForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [activePanel, setActivePanel] = useState<"none" | "create" | "expand">("none");
  const [searchParams, setSearchParams] = useSearchParams();

  const openCreate = (entryType: string) => {
    setForm({ ...EMPTY_FORM, kind: "create", entryType });
    setActivePanel("create");
  };
  const openExpand = (entryType: string, parentLoreId?: Id<"loreEntries">) => {
    setForm({ ...EMPTY_FORM, kind: "expand", entryType, parentLoreId });
    setActivePanel("expand");
  };

  // Deep links from the rest of the site — the Stage 1 browser/Atlas CTAs:
  //   /creator?create=<entryType>&sector=…&faction=…  → new-entry composer
  //   /creator?expand=<loreId>                        → expansion composer
  // Params are cleared (replace) once the panel is open so a refresh doesn't
  // reopen it, and the deck scrolls to the matching station.
  useEffect(() => {
    if (activePanel !== "none") return;
    const createType = searchParams.get("create");
    const expandId = searchParams.get("expand");
    if (!createType && !expandId) return;
    if (createType) {
      setForm({
        ...EMPTY_FORM,
        kind: "create",
        entryType: createType,
        sector: searchParams.get("sector") ?? "",
        faction: searchParams.get("faction") ?? "",
      });
      setActivePanel("create");
    } else if (expandId) {
      setForm({
        ...EMPTY_FORM,
        kind: "expand",
        entryType: "background",
        parentLoreId: expandId as Id<"loreEntries">,
      });
      setActivePanel("expand");
    }
    setSearchParams({}, { replace: true });
    const targetId = createType ? "create" : "expand";
    window.setTimeout(() => {
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 140);
  }, [searchParams, activePanel, setSearchParams]);

  const pendingProposals = useMemo(
    () => (proposals ?? []).filter((p) => p.status === "pending"),
    [proposals],
  );
  const approvedProposals = useMemo(
    () => (proposals ?? []).filter((p) => p.status === "approved"),
    [proposals],
  );

  const openContests = useMemo(
    () => (contests ?? []).filter((c) => c.canEnter || c.status === "open"),
    [contests],
  );

  // Resource cards: operator-managed set (Content Desk → Hub cards) with the
  // built-in default set as fallback while the table is empty. Cards tagged
  // "Database" render in their own row above the reference shelf.
  const cardRows: HubCardRow[] =
    hubCards === undefined || hubCards.length === 0
      ? DEFAULT_HUB_CARDS
      : hubCards;
  const databaseCards = cardRows.filter(
    (c) => (c.tag ?? "").toLowerCase() === "database",
  );
  const referenceCards = cardRows.filter(
    (c) => (c.tag ?? "").toLowerCase() !== "database",
  );

  const renderCard = (c: HubCardRow, idx: number) => {
    const Icon = CARD_ICONS[c.icon ?? ""] ?? BookOpen;
    return (
      <ScaleReveal key={`${c.href}::${c.label}`} staggerIndex={idx}>
        <Link to={c.href} className="block h-full">
          <HoloCard className="h-full hover:border-[color:var(--uf-gold)] transition-colors">
            <GoldEdge />
            <Icon className="h-5 w-5 text-uf-cyan" aria-hidden />
            <h3 className="text-base font-semibold mt-2">{c.label}</h3>
            <p className="text-uf-muted text-sm mt-1">{c.description}</p>
          </HoloCard>
        </Link>
      </ScaleReveal>
    );
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.info("Sign in to file a proposal.");
      return;
    }
    if (!form.title.trim()) return toast.error("A title is required.");
    if (form.body.trim().length < (form.kind === "expand" ? 40 : 80)) {
      return toast.error(
        form.kind === "expand"
          ? "Expansion text must be at least 40 characters."
          : "Entry text must be at least 80 characters.",
      );
    }
    if (form.kind === "expand" && !form.parentLoreId) {
      return toast.error("Pick the entry you want to expand.");
    }
    setBusy(true);
    try {
      await submit({
        kind: form.kind,
        entryType: form.entryType,
        title: form.title.trim(),
        body: form.body.trim(),
        excerpt: form.excerpt.trim() || undefined,
        faction: form.faction.trim() || undefined,
        sector: form.sector.trim() || undefined,
        parentLoreId: form.parentLoreId,
      });
      toast.success(
        "Dossier filed — it's in the operator review queue. You'll be notified of the verdict.",
      );
      setForm(EMPTY_FORM);
      setActivePanel("none");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  const activeParent = useMemo(
    () => (recentLore ?? []).find((l) => l._id === form.parentLoreId),
    [recentLore, form.parentLoreId],
  );

  return (
    <SiteShell>
      {/* ================================================================ */}
      {/* COMMAND-DECK HERO — THE FORGE OF CANON                           */}
      {/* ================================================================ */}
      <section
        className="relative overflow-hidden border-b border-[color:var(--uf-border)]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #0B1A34 0%, #060C18 55%, #04070F 100%)",
        }}
      >
        <Starfield hue="mixed" density="medium" wash={false} />
        {/* holographic grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={HOLO_GRID}
        />
        {/* command-deck lighting — slow gold wash over the deck */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-pulse"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(230,168,23,0.14) 0%, rgba(230,168,23,0) 32%, rgba(230,168,23,0) 68%, rgba(4,7,15,0.92) 100%)",
          }}
        />
        {/* gold corner framing */}
        {[
          "left-3 top-3 border-l-2 border-t-2",
          "right-3 top-3 border-r-2 border-t-2",
          "left-3 bottom-3 border-l-2 border-b-2",
          "right-3 bottom-3 border-r-2 border-b-2",
        ].map((pos) => (
          <span
            key={pos}
            aria-hidden
            className={`pointer-events-none absolute h-8 w-8 border-[color:var(--uf-gold)] opacity-70 ${pos}`}
          />
        ))}

        <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="uf-eyebrow uf-eyebrow--gold uf-fade-in">
              Creator Hub · Command Deck
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight uf-fade-in">
              THE FORGE{" "}
              <span className="uf-glow-text--amber" style={GOLD_LETTERING}>
                OF CANON
              </span>
            </h1>
            <span
              aria-hidden
              className="mx-auto mt-5 block h-[3px] w-48 rounded-full"
              style={GOLD_RULE}
            />
            <p className="text-uf-muted text-base md:text-lg mt-5 max-w-2xl mx-auto">
              Draft new canon, reinforce the records already in service, deploy with
              your unit, and earn your place in the archive. Every proposal is
              scanned by the operator staff — approved dossiers publish to the
              record and earn XP and Star Credits.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="#create">
                <NeonButton variant="gold" style={GOLD_BUTTON}>
                  <PenLine className="h-4 w-4" aria-hidden /> Begin Creation
                </NeonButton>
              </a>
              <Link to="/map">
                <NeonButton variant="ghost" className="uf-btn--goldline">
                    <Rocket className="h-4 w-4" aria-hidden /> Explore the Galaxy
                  </NeonButton>
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <StatusPill variant="gold">8 entry classes</StatusPill>
              <StatusPill variant="cyan">7 reinforcement types</StatusPill>
              <StatusPill variant="info">Operator-reviewed dossiers</StatusPill>
            </div>
          </div>
        </div>
      </section>

      <GoldDivider glyph="01" />

      {/* ================================================================ */}
      {/* 1 — CREATE                                                        */}
      {/* ================================================================ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="create">
        <DeckHeader
          index="01"
          label="Create"
          title="Draft something new into the canon."
          lead="Select an entry class. Operator staff review every proposal against
            existing canon — approved dossiers publish to the archive and earn XP
            and Star Credits."
        />
        <div className="uf-grid uf-grid--4">
          {CREATE_TYPES.map((t, idx) => {
            const inner = (
              <>
                <GoldEdge />
                <t.icon className="h-6 w-6 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold mt-3">{t.label}</h3>
                <p className="text-uf-muted text-sm mt-1">{t.hint}</p>
                <span className="text-uf-gold text-xs mt-3 inline-flex items-center gap-1">
                  <PenLine className="h-3.5 w-3.5" aria-hidden />
                  {t.href ? "Open the lab" : "Draft entry"}
                </span>
              </>
            );
            const cls =
              "block w-full text-left uf-card p-5 h-full hover:border-[color:var(--uf-gold)] transition-colors";
            // Species + Technology run their own databases — those cards link
            // straight to the lab pages instead of the proposal composer.
            return (
              <ScaleReveal key={t.id} staggerIndex={idx}>
                {t.href ? (
                  <Link to={t.href} className={cls} aria-label={t.label}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCreate(t.id)}
                    className={`${cls} cursor-pointer`}
                    aria-label={t.label}
                  >
                    {inner}
                  </button>
                )}
              </ScaleReveal>
            );
          })}
        </div>

        {/* Quick links into the other creation flows */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/submit">
            <NeonButton variant="ghost">
              <Pencil className="h-4 w-4" aria-hidden /> Deploy a story
            </NeonButton>
          </Link>
          <Link to="/lore/submit">
            <NeonButton variant="ghost">
              <Library className="h-4 w-4" aria-hidden /> Upload a canon bible
            </NeonButton>
          </Link>
          <Link to="/map">
            <NeonButton variant="ghost">
              <MapIcon className="h-4 w-4" aria-hidden /> Chart a system
            </NeonButton>
          </Link>
          <Link to="/missions">
            <NeonButton variant="ghost">
              <Target className="h-4 w-4" aria-hidden /> File a field report
            </NeonButton>
          </Link>
        </div>

        {/* Proposal composer (create mode) */}
        {activePanel === "create" ? (
          <div className="mt-6">
            <ProposalComposer
              form={form}
              setForm={setForm}
              onSubmit={handleSubmit}
              busy={busy}
              onCancel={() => setActivePanel("none")}
            />
          </div>
        ) : null}
      </section>

      <GoldDivider glyph="02" />

      {/* ================================================================ */}
      {/* 2 — EXPAND                                                        */}
      {/* ================================================================ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="expand">
        <DeckHeader
          index="02"
          label="Expand"
          title="Reinforce the record that already stands."
          lead="Choose what you're adding, then select the entry it reinforces.
            Approved expansions append to that entry in the archive — credited
            to you."
        />

        <div className="uf-grid uf-grid--3">
          {EXPAND_TYPES.map((t, idx) => (
            <ScaleReveal key={t.id} staggerIndex={idx}>
              <button
                type="button"
                onClick={() => openExpand(t.id)}
                className="w-full text-left uf-card p-4 h-full hover:border-[color:var(--uf-gold)] transition-colors cursor-pointer"
                aria-label={t.label}
              >
                <GoldEdge />
                <div className="flex items-center gap-2">
                  <t.icon className="h-5 w-5 text-uf-violet shrink-0" aria-hidden />
                  <h3 className="text-base font-semibold">{t.label}</h3>
                </div>
                <p className="text-uf-muted text-sm mt-1">{t.hint}</p>
              </button>
            </ScaleReveal>
          ))}
        </div>

        {/* Recent entries with inline "Expand" affordance */}
        <div className="mt-8">
          <header className="mb-4 flex items-end justify-between gap-3 flex-wrap">
            <div>
              <span className="uf-eyebrow uf-eyebrow--gold">
                Reinforce an existing record
              </span>
              <h3 className="text-xl font-semibold mt-1">
                Select the record you will reinforce.
              </h3>
            </div>
            <Link to="/lore?tab=entries" className="text-uf-cyan text-sm">
              Browse all entries →
            </Link>
          </header>
          {recentLore === undefined ? (
            <div className="uf-grid uf-grid--3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="uf-skeleton" style={{ height: 120 }} />
              ))}
            </div>
          ) : (
            <div className="uf-grid uf-grid--3">
              {recentLore.slice(0, 9).map((entry, idx) => (
                <ScaleReveal key={entry._id} staggerIndex={idx}>
                  <HoloCard className="h-full">
                    <GoldEdge />
                    <div className="flex flex-wrap gap-2 mb-2">
                      {entry.faction ? <StatusPill variant="info">{entry.faction}</StatusPill> : null}
                      {entry.entryType ? <StatusPill variant="default">{entry.entryType}</StatusPill> : null}
                    </div>
                    <h4 className="text-lg font-semibold">{entry.title}</h4>
                    <p className="text-uf-muted text-sm mt-1 line-clamp-2">{entry.excerpt}</p>
                    <div className="mt-3 flex gap-2">
                      <NeonButton
                        variant="violet"
                        onClick={() => openExpand("background", entry._id)}
                      >
                        <PenLine className="h-4 w-4" aria-hidden /> Expand this
                      </NeonButton>
                      <Link to={`/lore/${entry.slug}`}>
                        <NeonButton variant="ghost">Read</NeonButton>
                      </Link>
                    </div>
                  </HoloCard>
                </ScaleReveal>
              ))}
            </div>
          )}
        </div>

        {activePanel === "expand" ? (
          <div className="mt-6">
            <ProposalComposer
              form={form}
              setForm={setForm}
              onSubmit={handleSubmit}
              busy={busy}
              onCancel={() => setActivePanel("none")}
              loreOptions={recentLore ?? []}
              parentTitle={activeParent?.title}
            />
          </div>
        ) : null}
      </section>

      <GoldDivider glyph="03" />

      {/* ================================================================ */}
      {/* 3 — OPERATIONS (strictly military)                                */}
      {/* ================================================================ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="collaborate">
        <DeckHeader
          index="03"
          label="Operations"
          title="Report to your assigned unit."
          lead="Join a tactical creation squad, coordinate with division leads, and
            deploy your expertise to active operations. Every command surface in
            the fleet is one click from here."
        />

        <div className="uf-grid uf-grid--3">
          {/* Units (faction / sector / ship squads) */}
          <ScaleReveal staggerIndex={0}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Tactical Squads</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Faction, sector, and starship units. Report to your assigned squad
                to pool lore, art, and missions with its members.
              </p>
              <p className="text-uf-muted text-xs mt-3">
                {groups === undefined
                  ? "Loading…"
                  : `${groups.length} unit${groups.length === 1 ? "" : "s"} active`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/groups">
                  <NeonButton variant="primary">Join a squad</NeonButton>
                </Link>
                <Link to="/groups">
                  <NeonButton variant="ghost">Raise a unit</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Ops net */}
          <ScaleReveal staggerIndex={1}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Operations Net</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Open a transmission, offer your skills, or request a collaborator
                for your next operation.
              </p>
              <ul className="mt-3 flex flex-col gap-1 list-none p-0 m-0">
                {forums === undefined ? (
                  <li className="uf-skeleton" style={{ height: 20 }} />
                ) : forums.length === 0 ? (
                  <li className="text-uf-muted text-sm">
                    Net silent — open the first transmission.
                  </li>
                ) : (
                  forums.map((t) => (
                    <li key={t._id} className="text-sm truncate">
                      <Link to="/forums" className="text-uf-muted hover:text-uf-cyan">
                        {t.title}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
              <div className="mt-3">
                <Link to="/forums">
                  <NeonButton variant="primary">Open the net</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Contests */}
          <ScaleReveal staggerIndex={2}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-uf-gold" aria-hidden />
                <h3 className="text-lg font-semibold">Command Contests</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Themed canon trials judged by the operator staff. Deploy a story,
                a design, or a lore piece.
              </p>
              <ul className="mt-3 flex flex-col gap-1 list-none p-0 m-0">
                {contests === undefined ? (
                  <li className="uf-skeleton" style={{ height: 20 }} />
                ) : openContests.length === 0 ? (
                  <li className="text-uf-muted text-sm">
                    No engagements open right now.
                  </li>
                ) : (
                  openContests.slice(0, 3).map((c) => (
                    <li key={c._id} className="text-sm truncate">
                      <Link to={`/contests/${c.slug}`} className="text-uf-muted hover:text-uf-cyan">
                        {c.title}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
              <div className="mt-3">
                <Link to="/contests">
                  <NeonButton variant="primary">See open engagements</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Campaign arcs (story arc units) */}
          <ScaleReveal staggerIndex={3}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-uf-violet" aria-hidden />
                <h3 className="text-lg font-semibold">Campaign Arcs</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Coordinated storylines under a single command. Contribute a chapter
                to an open arc and your writing joins the canon in sequence.
              </p>
              <p className="text-uf-muted text-xs mt-3">
                {arcs === undefined ? "Loading…" : `${arcs.length} arc${arcs.length === 1 ? "" : "s"} running`}
              </p>
              <div className="mt-3">
                <Link to="/arcs">
                  <NeonButton variant="violet">Join a campaign</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Direct comms */}
          <ScaleReveal staggerIndex={4}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-uf-green" aria-hidden />
                <h3 className="text-lg font-semibold">Direct Comms</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Found an operator whose work fits yours? Open a direct line and
                offer to build the next piece together.
              </p>
              <div className="mt-3">
                <Link to="/messages">
                  <NeonButton variant="ghost">Open comms</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Personnel roster */}
          <ScaleReveal staggerIndex={5}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Personnel Roster</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Browse the roster by rank, faction, and contribution to find
                operators with the right skills for your operation.
              </p>
              <div className="mt-3">
                <Link to="/members">
                  <NeonButton variant="ghost">Open the roster</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>
        </div>
      </section>

      <GoldDivider glyph="04" />

      {/* ================================================================ */}
      {/* 4 — RESOURCES                                                     */}
      {/* ================================================================ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="resources">
        <DeckHeader
          index="04"
          label="Resources"
          title="Loadout for every creator."
          lead="Bibles, maps, guides, blueprints, and faction profiles — the
            reference shelf issued to every operator in the fleet."
        />

        {/* The four databases — reference while drafting, all stylized pages */}
        {databaseCards.length > 0 ? (
          <div className="mb-8">
            <header className="mb-4">
              <span className="uf-eyebrow uf-eyebrow--gold">
                The four databases
              </span>
              <h3 className="text-xl font-semibold mt-1">
                Pull from the archive while you draft.
              </h3>
            </header>
            <div className="uf-grid uf-grid--4">
              {databaseCards.map((c, idx) => renderCard(c, idx))}
            </div>
          </div>
        ) : null}

        {/* Reference shelf — operator-editable cards */}
        <div>
          <header className="mb-4">
            <span className="uf-eyebrow uf-eyebrow--gold">Reference shelf</span>
            <h3 className="text-xl font-semibold mt-1">
              Canon, charts, and standing orders.
            </h3>
          </header>
          <div className="uf-grid uf-grid--4">
            {referenceCards.map((c, idx) => renderCard(c, idx))}
          </div>
        </div>

        {/* Live resources — uploaded files open in the on-page reader
            (/resources?open=<id>), external links keep their own target. */}
        <header className="mb-4">
          <span className="uf-eyebrow uf-eyebrow--gold">Field-issued downloads</span>
          <p className="text-uf-muted text-xs mt-1">
            Documents open in the reader right on the resources page.
          </p>
        </header>
        {resources === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 100 }} />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="uf-empty">No resources issued yet.</div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {resources.map((r) => {
              const card = (
                <HoloCard className="h-full hover:border-[color:var(--uf-gold)] transition-colors">
                  <GoldEdge />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill variant="info">{r.resourceType ?? "guide"}</StatusPill>
                    {r.fileUrl ? (
                      <StatusPill variant="gold">in-reader</StatusPill>
                    ) : null}
                  </div>
                  <h4 className="text-base font-semibold mt-2">{r.title}</h4>
                  <p className="text-uf-muted text-sm mt-1 line-clamp-2">{r.description}</p>
                  {r.fileUrl ? (
                    <p className="text-uf-gold text-xs mt-2">Open in the reader →</p>
                  ) : null}
                </HoloCard>
              );
              if (r.fileUrl) {
                return (
                  <Link key={r._id} to={`/resources?open=${r._id}`} className="block h-full">
                    {card}
                  </Link>
                );
              }
              if (r.url) {
                return (
                  <a
                    key={r._id}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-full"
                  >
                    {card}
                  </a>
                );
              }
              return (
                <Link key={r._id} to="/resources" className="block h-full">
                  {card}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <GoldDivider glyph="05" />

      {/* ================================================================ */}
      {/* 5 — RECOGNITION                                                   */}
      {/* ================================================================ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="recognition">
        <DeckHeader
          index="05"
          label="Recognition"
          title="Service does not go unnoticed."
          lead="Commendations, weekly standings, rank progression, canon credits,
            and badges — every contribution is logged and celebrated."
        />

        <div className="uf-grid uf-grid--3">
          {/* Featured creator — single weekly commendation in a gold frame */}
          <ScaleReveal staggerIndex={0}>
            <div className="h-full rounded-[14px] p-[3px]" style={GOLD_PLATE}>
              <HoloCard className="h-full">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-uf-gold" aria-hidden />
                  <h3 className="text-lg font-semibold">Weekly Commendation</h3>
                </div>
                {spotlight === undefined ? (
                  <div className="uf-skeleton mt-3" style={{ height: 96 }} />
                ) : spotlight === null ? (
                  <p className="text-uf-muted text-sm mt-2">
                    No commendation issued this cycle — the next could be yours.
                  </p>
                ) : (
                  <div className="mt-3">
                    <p className="uf-eyebrow uf-eyebrow--gold">Commendation</p>
                    <p className="text-xl font-semibold mt-1">
                      Operator {spotlight.displayName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill variant="gold">
                        {spotlight.rank ?? "Recruit"}
                      </StatusPill>
                      <span className="text-uf-muted text-sm">
                        {(spotlight.xp ?? 0).toLocaleString()} XP ·{" "}
                        {(spotlight.contributionCount ?? 0)} contributions
                      </span>
                    </div>
                    <p className="text-uf-muted text-sm mt-3 italic">
                      “Recognized for exemplary contributions to the Ultra Force
                      Canon.”
                    </p>
                    <Link to="/members" className="text-uf-cyan text-sm mt-2 inline-block">
                      View the roster →
                    </Link>
                  </div>
                )}
              </HoloCard>
            </div>
          </ScaleReveal>

          {/* Weekly standings — leaderboard */}
          <ScaleReveal staggerIndex={1}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-uf-gold" aria-hidden />
                <h3 className="text-lg font-semibold">Weekly Standings</h3>
              </div>
              {leaderboard === undefined ? (
                <div className="uf-skeleton mt-3" style={{ height: 100 }} />
              ) : (
                <ol className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                  {leaderboard.map((row, i) => (
                    <li key={row._id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">
                        <span className="text-uf-muted mr-2">#{i + 1}</span>
                        {row.displayName}
                        {row.isMe ? <span className="text-uf-cyan"> (you)</span> : null}
                      </span>
                      <span className="text-uf-muted shrink-0">
                        {row.xp.toLocaleString()} XP
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-3">
                <Link to="/leaderboard">
                  <NeonButton variant="ghost">Full standings</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Service record: credits + rank + badges */}
          <ScaleReveal staggerIndex={2}>
            <HoloCard className="h-full">
              <GoldEdge />
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Your Service Record</h3>
              </div>
              {!isAuthenticated ? (
                <p className="text-uf-muted text-sm mt-2">
                  Sign in to track your rank, credits, and badges.{" "}
                  <Link to="/auth" className="text-uf-cyan">
                    Open auth
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <StatCard label="Canon Credits" value={(user?.credits ?? 0).toLocaleString()} accent="amber" />
                    <StatCard label="XP" value={(user?.xp ?? 0).toLocaleString()} accent="cyan" />
                  </div>
                  <div className="mt-3">
                    <p className="text-uf-muted text-sm">
                      {progress
                        ? `Rank: ${progress.rank}${progress.nextRank ? ` — ${progress.percent}% to ${progress.nextRank}` : ""}`
                        : "Loading rank…"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to="/awards">
                      <NeonButton variant="gold" style={GOLD_BUTTON}>
                        Awards & honors
                      </NeonButton>
                    </Link>
                    <Link to="/high-command">
                      <NeonButton variant="ghost">Rank ladder</NeonButton>
                    </Link>
                  </div>
                </>
              )}
            </HoloCard>
          </ScaleReveal>
        </div>

        {/* Proposal tracker */}
        <div className="mt-8">
          <HoloCard>
            <GoldEdge />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FileTextIcon />
                <h3 className="text-lg font-semibold">Your filed proposals</h3>
              </div>
              {!isAuthenticated ? (
                <Link to="/auth" className="text-uf-cyan text-sm">
                  Sign in to track proposals
                </Link>
              ) : null}
            </div>
            {isAuthenticated ? (
              proposals === undefined ? (
                <div className="uf-skeleton mt-3" style={{ height: 60 }} />
              ) : proposals.length === 0 ? (
                <p className="text-uf-muted text-sm mt-3">
                  No dossiers filed yet — start at Station 01, Create.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                  {proposals.slice(0, 8).map((p) => (
                    <li
                      key={p._id}
                      className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{p.title}</p>
                        <p className="text-uf-muted text-xs">
                          {p.kind === "expand" ? "Expansion" : "New entry"} · {p.entryType}
                          {p.parentTitle ? ` · on ${p.parentTitle}` : ""}
                        </p>
                      </div>
                      <StatusPill
                        variant={
                          p.status === "approved"
                            ? "success"
                            : p.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {p.status}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {pendingProposals.length > 0 ? (
              <p className="text-uf-muted text-xs mt-2">
                {pendingProposals.length} awaiting review · {approvedProposals.length} published
              </p>
            ) : null}
          </HoloCard>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FINAL CINEMATIC CTA                                               */}
      {/* ================================================================ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div
          className="relative overflow-hidden rounded-2xl border border-[color:var(--uf-gold)] px-6 py-12 md:py-16 text-center"
          style={goldScrim("rgba(6,10,18,0.90)", "rgba(6,10,18,0.95)")}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-3 h-8 w-8 border-l-2 border-t-2 border-[color:var(--uf-gold)] opacity-70"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-3 h-8 w-8 border-r-2 border-t-2 border-[color:var(--uf-gold)] opacity-70"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-3 left-3 h-8 w-8 border-b-2 border-l-2 border-[color:var(--uf-gold)] opacity-70"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-3 right-3 h-8 w-8 border-b-2 border-r-2 border-[color:var(--uf-gold)] opacity-70"
          />
          <Starfield hue="mixed" density="low" wash={false} />

          <div className="relative z-10 mx-auto max-w-3xl">
            <span className="uf-eyebrow uf-eyebrow--gold">Final Directive</span>
            <p className="mt-4 text-2xl md:text-4xl font-semibold leading-snug">
              The Ultra Force Canon expands with every operator who steps forward.
            </p>
            <span
              aria-hidden
              className="mx-auto mt-5 block h-[3px] w-40 rounded-full"
              style={GOLD_RULE}
            />
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#create">
                <NeonButton variant="gold" style={GOLD_BUTTON}>
                  <PenLine className="h-4 w-4" aria-hidden /> Begin Creation
                </NeonButton>
              </a>
              <Link to="/map">
                <NeonButton variant="ghost" className="uf-btn--goldline">
                    <Rocket className="h-4 w-4" aria-hidden /> Explore the Galaxy
                  </NeonButton>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

// Small file icon for the tracker header (kept local to avoid extra imports).
function FileTextIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[color:var(--uf-border)] text-uf-cyan text-xs"
    >
      ✦
    </span>
  );
}

// ---------------------------------------------------------------------------
// Proposal composer — one form for both create and expand modes.
// ---------------------------------------------------------------------------

function ProposalComposer({
  form,
  setForm,
  onSubmit,
  busy,
  onCancel,
  loreOptions,
  parentTitle,
}: {
  form: ProposalForm;
  setForm: (f: ProposalForm) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
  onCancel: () => void;
  loreOptions?: Array<{ _id: Id<"loreEntries">; title: string }>;
  parentTitle?: string;
}) {
  const { isAuthenticated } = useAuth();
  const set = <K extends keyof ProposalForm>(k: K, v: ProposalForm[K]) =>
    setForm({ ...form, [k]: v });

  if (!isAuthenticated) {
    return (
      <HoloCard>
        <GoldEdge />
        <p className="text-uf-muted text-sm">
          Sign in to propose lore.{" "}
          <Link to="/auth" className="text-uf-cyan">
            Open auth
          </Link>
          .
        </p>
      </HoloCard>
    );
  }

  return (
    <HoloCard>
      <GoldEdge />
      <form className="grid gap-4" onSubmit={onSubmit}>
        <header className="flex items-center justify-between gap-3">
          <div>
            <span className="uf-eyebrow uf-eyebrow--gold">
              {form.kind === "expand" ? "Reinforce an entry" : "New canon entry"}
            </span>
            <h3 className="text-xl font-semibold mt-1">
              {form.kind === "expand"
                ? `Expanding: ${parentTitle ?? "pick an entry below"}`
                : `Proposing a new ${form.entryType}`}
            </h3>
          </div>
          <button type="button" className="uf-btn uf-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </header>

        {form.kind === "expand" ? (
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Entry to expand
            <select
              value={form.parentLoreId ?? ""}
              onChange={(e) =>
                set("parentLoreId", (e.target.value || undefined) as Id<"loreEntries"> | undefined)
              }
              required
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            >
              <option value="">Select an entry…</option>
              {(loreOptions ?? []).map((o) => (
                <option key={o._id} value={o._id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
          {form.kind === "expand" ? "Section title" : "Title"}
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            required
            maxLength={140}
            placeholder={
              form.kind === "expand" ? "e.g. Service history before the Corridor War" : "e.g. The Halcyon Array"
            }
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>

        {form.kind === "create" ? (
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Short summary <span className="normal-case">(optional — shown on cards)</span>
            <input
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              maxLength={280}
              placeholder="One or two sentences describing the entry."
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
        ) : null}

        <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
          {form.kind === "expand" ? "Expansion text" : "Entry text"}
          <textarea
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            rows={7}
            maxLength={6000}
            required
            placeholder={
              form.kind === "expand"
                ? "What are you adding to this entry? At least 40 characters."
                : "Write the canon entry. At least 80 characters — be specific, be consistent with existing lore."
            }
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>
        <p className="text-uf-muted text-xs -mt-2">
          {form.body.trim().length} characters
          {form.kind === "expand" ? " · minimum 40" : " · minimum 80"}
        </p>

        {form.kind === "create" ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Faction (optional)
              <input
                value={form.faction}
                onChange={(e) => set("faction", e.target.value)}
                maxLength={60}
                placeholder="Terran Reach"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Sector (optional)
              <input
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
                maxLength={80}
                placeholder="Corridor 4"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
          </div>
        ) : null}

        <div className="flex gap-2">
          <NeonButton variant="primary" type="submit" loading={busy} disabled={busy}>
            File for operator review
          </NeonButton>
          <NeonButton variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </HoloCard>
  );
}
