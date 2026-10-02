import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
  StatCard,
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
  Ship,
  Sparkles,
  Target,
  Trophy,
  User,
  Users,
} from "lucide-react";

// =========================================================================
// Creator Hub — the central command for creators.
//
// Five sections, all wired to real product surfaces:
//   1. Create      — propose a NEW canon entry (character, starship, sector,
//                    species, technology, faction, event, timeline)
//   2. Expand      — propose an expansion on an EXISTING lore entry
//                    (background, history, culture, visual, event, mission,
//                    character connection)
//   3. Collaborate — join groups, forums, contests, and lore arcs
//   4. Resources   — bibles, maps, guides, blueprints, faction profiles
//   5. Recognition — spotlight, leaderboard, rank, credits, badges
//
// Proposals flow to the operator Content Desk → Proposals tab, where an
// approval publishes to the lore archive and rewards the author.
// =========================================================================

type CreateType = {
  id: string;
  label: string;
  hint: string;
  icon: typeof User;
};

const CREATE_TYPES: CreateType[] = [
  { id: "character", label: "Add Character", hint: "A person, pilot, or entity in the canon.", icon: User },
  { id: "starship", label: "Add Starship", hint: "A hull, class, or named vessel.", icon: Rocket },
  { id: "sector", label: "Add Sector", hint: "A region of charted space.", icon: Globe },
  { id: "species", label: "Add Species", hint: "A people or biological lineage.", icon: Dna },
  { id: "technology", label: "Add Technology", hint: "A device, system, or innovation.", icon: Cpu },
  { id: "faction", label: "Add Faction", hint: "A power, bloc, or organization.", icon: Flag },
  { id: "event", label: "Add Event", hint: "A battle, disaster, or turning point.", icon: Calendar },
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

export default function CreatorHub() {
  usePageMeta({
    title: "Creator Hub — Star Force Base 1198",
    description:
      "Create, expand, and collaborate on the Star Force canon. Propose new entries, grow existing lore, join teams, and earn recognition.",
  });

  const { isAuthenticated, user } = useAuth();
  const proposals = useQuery(api.creatorHub.myProposals, {});
  const recentLore = useQuery(api.content.listLore, { limit: 40 });
  const groups = useQuery(api.groups.listGroups, {});
  const forums = useQuery(api.groups.trendingForumThreads, { limit: 4 });
  const contests = useQuery(api.contests.listContests, { limit: 6 });
  const arcs = useQuery(api.engagement.listArcs, {});
  const resources = useQuery(api.content.listResources, { limit: 12 });
  const leaderboard = useQuery(api.social.leaderboard, { limit: 5 });
  const spotlight = useQuery(api.social.memberSpotlight, {});
  const progress = useQuery(api.social.rankProgress, {});

  const submit = useMutation(api.creatorHub.submitProposal);
  const [form, setForm] = useState<ProposalForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [activePanel, setActivePanel] = useState<"none" | "create" | "expand">("none");

  const openCreate = (entryType: string) => {
    setForm({ ...EMPTY_FORM, kind: "create", entryType });
    setActivePanel("create");
  };
  const openExpand = (entryType: string, parentLoreId?: Id<"loreEntries">) => {
    setForm({ ...EMPTY_FORM, kind: "expand", entryType, parentLoreId });
    setActivePanel("expand");
  };

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.info("Sign in to submit a proposal.");
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
        "Proposal received — it's in the operator review queue. You'll be notified on the verdict.",
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
      <PageHero
        eyebrow="Creator Hub"
        title="Build the universe."
        lead="Create new canon, expand what exists, collaborate with the fleet, and earn your place in the records. Every proposal is reviewed by operators — approved work is published and rewarded."
        primary={{ label: "Start creating", href: "#create", variant: "primary" }}
        secondary={{ label: "Open the lore archive", href: "/lore", variant: "ghost" }}
      />

      {/* ----------------------------------------------------------------- */}
      {/* 1 — CREATE                                                         */}
      {/* ----------------------------------------------------------------- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="create">
        <header className="mb-6">
          <span className="uf-eyebrow">01 · Create</span>
          <h2 className="text-3xl font-semibold mt-2">Add something new to the canon.</h2>
          <p className="text-uf-muted text-sm mt-2 max-w-2xl">
            Pick an entry type. Operators review every proposal against existing canon —
            approvals publish to the archive and earn XP and Star Credits.
          </p>
        </header>
        <div className="uf-grid uf-grid--4">
          {CREATE_TYPES.map((t, idx) => (
            <ScaleReveal key={t.id} staggerIndex={idx}>
              <button
                type="button"
                onClick={() => openCreate(t.id)}
                className="w-full text-left uf-card p-5 h-full hover:border-[color:var(--uf-cyan)] transition-colors cursor-pointer"
                aria-label={t.label}
              >
                <t.icon className="h-6 w-6 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold mt-3">{t.label}</h3>
                <p className="text-uf-muted text-sm mt-1">{t.hint}</p>
                <span className="text-uf-cyan text-xs mt-3 inline-flex items-center gap-1">
                  <PenLine className="h-3.5 w-3.5" aria-hidden /> Propose
                </span>
              </button>
            </ScaleReveal>
          ))}
        </div>

        {/* Quick links into the other creation flows */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/submit">
            <NeonButton variant="ghost">
              <Pencil className="h-4 w-4" aria-hidden /> Submit a story
            </NeonButton>
          </Link>
          <Link to="/lore/submit">
            <NeonButton variant="ghost">
              <Library className="h-4 w-4" aria-hidden /> Upload a lore bible
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

      {/* ----------------------------------------------------------------- */}
      {/* 2 — EXPAND                                                         */}
      {/* ----------------------------------------------------------------- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="expand">
        <header className="mb-6">
          <span className="uf-eyebrow">02 · Expand</span>
          <h2 className="text-3xl font-semibold mt-2">Grow the lore that already exists.</h2>
          <p className="text-uf-muted text-sm mt-2 max-w-2xl">
            Pick what you want to add, then choose the entry it belongs to. Approved
            expansions are appended to that entry in the archive, credited to you.
          </p>
        </header>

        <div className="uf-grid uf-grid--3">
          {EXPAND_TYPES.map((t, idx) => (
            <ScaleReveal key={t.id} staggerIndex={idx}>
              <button
                type="button"
                onClick={() => openExpand(t.id)}
                className="w-full text-left uf-card p-4 h-full hover:border-[color:var(--uf-violet)] transition-colors cursor-pointer"
                aria-label={t.label}
              >
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
              <span className="uf-eyebrow">Expand an existing entry</span>
              <h3 className="text-xl font-semibold mt-1">Pick a target from the archive.</h3>
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

      {/* ----------------------------------------------------------------- */}
      {/* 3 — COLLABORATE                                                    */}
      {/* ----------------------------------------------------------------- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="collaborate">
        <header className="mb-6">
          <span className="uf-eyebrow">03 · Collaborate</span>
          <h2 className="text-3xl font-semibold mt-2">No one charts the galaxy alone.</h2>
          <p className="text-uf-muted text-sm mt-2 max-w-2xl">
            Join a team, take up a thread, or enter a contest. Every collaboration
            surface in the fleet is one click from here.
          </p>
        </header>

        <div className="uf-grid uf-grid--3">
          {/* Groups (faction / sector / ship teams) */}
          <ScaleReveal staggerIndex={0}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Fleet Groups</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Faction, sector, and starship design teams. Join a group to pool lore,
                art, and missions with its members.
              </p>
              <p className="text-uf-muted text-xs mt-3">
                {groups === undefined
                  ? "Loading…"
                  : `${groups.length} group${groups.length === 1 ? "" : "s"} active`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/groups">
                  <NeonButton variant="primary">Join a team</NeonButton>
                </Link>
                <Link to="/groups">
                  <NeonButton variant="ghost">Create a group</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Forums */}
          <ScaleReveal staggerIndex={1}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Forums</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Open a thread, offer your skills, or request a collaborator for your
                next piece.
              </p>
              <ul className="mt-3 flex flex-col gap-1 list-none p-0 m-0">
                {forums === undefined ? (
                  <li className="uf-skeleton" style={{ height: 20 }} />
                ) : forums.length === 0 ? (
                  <li className="text-uf-muted text-sm">No threads yet — start one.</li>
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
                  <NeonButton variant="primary">Open the forums</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Contests */}
          <ScaleReveal staggerIndex={2}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-uf-gold" aria-hidden />
                <h3 className="text-lg font-semibold">Contests</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Themed canon contests judged by the operator team. Enter with a story,
                a design, or a lore piece.
              </p>
              <ul className="mt-3 flex flex-col gap-1 list-none p-0 m-0">
                {contests === undefined ? (
                  <li className="uf-skeleton" style={{ height: 20 }} />
                ) : openContests.length === 0 ? (
                  <li className="text-uf-muted text-sm">No open contests right now.</li>
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
                  <NeonButton variant="primary">See open contests</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Lore arcs (story arc teams) */}
          <ScaleReveal staggerIndex={3}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-uf-violet" aria-hidden />
                <h3 className="text-lg font-semibold">Lore Arcs</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Collaborative storylines. Contribute a chapter to an open arc and your
                writing joins the canon in sequence.
              </p>
              <p className="text-uf-muted text-xs mt-3">
                {arcs === undefined ? "Loading…" : `${arcs.length} arc${arcs.length === 1 ? "" : "s"} running`}
              </p>
              <div className="mt-3">
                <Link to="/arcs">
                  <NeonButton variant="violet">Join an arc</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Direct messages */}
          <ScaleReveal staggerIndex={4}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-uf-green" aria-hidden />
                <h3 className="text-lg font-semibold">Request Collaboration</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Found a creator whose work fits yours? Send a direct message and offer
                to build something together.
              </p>
              <div className="mt-3">
                <Link to="/messages">
                  <NeonButton variant="ghost">Open comms</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Members roster */}
          <ScaleReveal staggerIndex={5}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Find Creators</h3>
              </div>
              <p className="text-uf-muted text-sm mt-2">
                Browse the roster by rank, faction, and contribution to find
                collaborators with the right skills.
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

      {/* ----------------------------------------------------------------- */}
      {/* 4 — RESOURCES                                                      */}
      {/* ----------------------------------------------------------------- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="resources">
        <header className="mb-6">
          <span className="uf-eyebrow">04 · Resources</span>
          <h2 className="text-3xl font-semibold mt-2">Everything you need to write canon.</h2>
          <p className="text-uf-muted text-sm mt-2 max-w-2xl">
            Bibles, maps, guides, blueprints, and faction profiles — the reference
            shelf for every creator in the fleet.
          </p>
        </header>

        <div className="uf-grid uf-grid--4 mb-8">
          {[
            { label: "Universe Bible", desc: "The operating canon as documents.", href: "/lore", icon: BookOpen },
            { label: "Sector Maps", desc: "Charts of every mapped region.", href: "/maps", icon: MapIcon },
            { label: "Star Atlas", desc: "The interactive 3D galaxy.", href: "/map", icon: Globe },
            { label: "Timeline", desc: "Story arcs in chronological order.", href: "/arcs", icon: Hourglass },
            { label: "Character Sheets", desc: "Personnel dossiers and rosters.", href: "/lore?tab=entries", icon: User },
            { label: "Ship Blueprints", desc: "Fleet registry & armament sheets.", href: "/fleet-registry", icon: Ship },
            { label: "Style Guides", desc: "Submission rules and house style.", href: "/resources", icon: PenLine },
            { label: "Faction Profiles", desc: "Powers, blocs, and organizations.", href: "/map", icon: Flag },
          ].map((r, idx) => (
            <ScaleReveal key={r.label} staggerIndex={idx}>
              <Link to={r.href} className="block h-full">
                <HoloCard className="h-full">
                  <r.icon className="h-5 w-5 text-uf-cyan" aria-hidden />
                  <h3 className="text-base font-semibold mt-2">{r.label}</h3>
                  <p className="text-uf-muted text-sm mt-1">{r.desc}</p>
                </HoloCard>
              </Link>
            </ScaleReveal>
          ))}
        </div>

        {/* Live downloadable resources */}
        <header className="mb-4">
          <span className="uf-eyebrow">Downloadable resources</span>
        </header>
        {resources === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 100 }} />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="uf-empty">No resources published yet.</div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {resources.map((r) => (
              <a
                key={r._id}
                href={r.fileUrl ?? r.url ?? "/resources"}
                target={r.fileUrl || r.url ? "_blank" : undefined}
                rel="noreferrer"
                className="block h-full"
              >
                <HoloCard className="h-full">
                  <StatusPill variant="info">{r.resourceType ?? "guide"}</StatusPill>
                  <h4 className="text-base font-semibold mt-2">{r.title}</h4>
                  <p className="text-uf-muted text-sm mt-1 line-clamp-2">{r.description}</p>
                </HoloCard>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 5 — RECOGNITION                                                    */}
      {/* ----------------------------------------------------------------- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12" id="recognition">
        <header className="mb-6">
          <span className="uf-eyebrow">05 · Recognition</span>
          <h2 className="text-3xl font-semibold mt-2">Your work gets seen.</h2>
          <p className="text-uf-muted text-sm mt-2 max-w-2xl">
            Featured creators, weekly highlights, rank progression, canon credits, and
            badges — contribution is tracked and celebrated.
          </p>
        </header>

        <div className="uf-grid uf-grid--3">
          {/* Featured creator */}
          <ScaleReveal staggerIndex={0}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-uf-gold" aria-hidden />
                <h3 className="text-lg font-semibold">Featured Creator</h3>
              </div>
              {spotlight === undefined ? (
                <div className="uf-skeleton mt-3" style={{ height: 80 }} />
              ) : spotlight === null ? (
                <p className="text-uf-muted text-sm mt-2">No spotlight this week.</p>
              ) : (
                <div className="mt-3">
                  <p className="text-xl font-semibold">
                    {spotlight.displayName ?? "Unnamed recruit"}
                  </p>
                  <p className="text-uf-muted text-sm">
                    {(spotlight.xp ?? 0).toLocaleString()} XP ·{" "}
                    {(spotlight.contributionCount ?? 0)} contributions
                  </p>
                  <Link to="/members" className="text-uf-cyan text-sm mt-2 inline-block">
                    View the roster →
                  </Link>
                </div>
              )}
            </HoloCard>
          </ScaleReveal>

          {/* Weekly highlights — leaderboard */}
          <ScaleReveal staggerIndex={1}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-uf-gold" aria-hidden />
                <h3 className="text-lg font-semibold">Weekly Highlights</h3>
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
                  <NeonButton variant="ghost">Full leaderboard</NeonButton>
                </Link>
              </div>
            </HoloCard>
          </ScaleReveal>

          {/* Canon credits + rank + badges */}
          <ScaleReveal staggerIndex={2}>
            <HoloCard className="h-full">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-uf-cyan" aria-hidden />
                <h3 className="text-lg font-semibold">Your Standing</h3>
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
                      <NeonButton variant="gold">Awards & honors</NeonButton>
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FileTextIcon />
                <h3 className="text-lg font-semibold">Your proposals</h3>
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
                  No proposals yet — start in the Create section above.
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
      <form className="grid gap-4" onSubmit={onSubmit}>
        <header className="flex items-center justify-between gap-3">
          <div>
            <span className="uf-eyebrow">
              {form.kind === "expand" ? "Expand an entry" : "New canon entry"}
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
            Submit for review
          </NeonButton>
          <NeonButton variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </NeonButton>
        </div>
      </form>
    </HoloCard>
  );
}
