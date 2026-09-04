import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// =========================================================================
// Internal helpers used by the seedDemo action (src/convex/seed.ts).
// These runs run via runMutation from the action — they do the data-plane
// writes so the orchestrating action can focus on cover-art generation +
// ctx.storage uploads. All helpers are idempotent on a slug/displayName
// uniqueness key where one exists, and "no-op if table already has rows"
// for tables seeded only once.
// =========================================================================

const TABLES_TO_WIPE = [
  "stories",
  "loreEntries",
  "loreLibrary",
  "transmissions",
  "resources",
  "missions",
  "fleetReports",
  "groups",
  "groupMembers",
  "groupMessages",
  "groupPosts",
  "groupEvents",
  "groupEventSignups",
  "forumThreads",
  "sectorMap",
  "moderationItems",
  "signals",
  "calendarEvents",
  "captainLogs",
  "changelogEntries",
  "identityVerifications",
  "auditLog",
  "comments",
  "activityFeed",
  "notifications",
  "armamentSheets",
  "serviceHistories",
  "blackBoxFiles",
] as const;

// Wipe all seed tables. `users` is intentionally excluded so re-seeding
// does not orphan authored content; if you need a full user wipe, do it
// from the dashboard's Data tab separately.
export const wipeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const t of TABLES_TO_WIPE) {
      const docs = await ctx.db.query(t).collect();
      await Promise.all(docs.map((d) => ctx.db.delete(d._id)));
    }
  },
});

// Query used by the action to resolve displayName → _id for foreign keys.
export const listUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// Query used by the action to resolve group slug → _id for foreign keys.
export const listGroups = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("groups").collect();
  },
});

// Query used by the action to resolve mission slug → _id for foreign keys.
export const listMissions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("missions").collect();
  },
});

// ---- Per-table idempotent inserts ---------------------------------------

export const seedUsers = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").collect();
    const names = new Set(existing.map((u) => u.displayName));
    for (const u of args.items) {
      if (names.has(u.displayName)) continue;
      await ctx.db.insert("users", u);
    }
  },
});

export const seedStories = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const s of args.items) {
      const existing = await ctx.db
        .query("stories")
        .withIndex("by_slug", (q) => q.eq("slug", s.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("stories", s);
    }
  },
});

/**
 * Attach (or replace) cover art on an existing seeded row by slug. The seed
 * upserts skip existing rows, so this is the escape hatch to swap regenerated
 * cover files onto already-seeded content without wiping any data.
 */
export const attachCover = internalMutation({
  args: {
    table: v.string(),
    slug: v.string(),
    coverStorageId: v.optional(v.id("_storage")),
    coverMeta: v.optional(
      v.object({
        mimeType: v.string(),
        byteSize: v.number(),
        altText: v.optional(v.string()),
      }),
    ),
    fileStorageId: v.optional(v.id("_storage")),
    fileMeta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let docId: any = null;
    if (args.table === "stories") {
      const d = await ctx.db
        .query("stories")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .first();
      docId = d?._id ?? null;
    } else if (args.table === "loreEntries") {
      const d = await ctx.db
        .query("loreEntries")
        .filter((q) => q.eq(q.field("slug"), args.slug))
        .first();
      docId = d?._id ?? null;
    } else if (args.table === "loreLibrary") {
      const d = await ctx.db
        .query("loreLibrary")
        .filter((q) => q.eq(q.field("slug"), args.slug))
        .first();
      docId = d?._id ?? null;
    } else if (args.table === "transmissions") {
      const d = await ctx.db
        .query("transmissions")
        .filter((q) => q.eq(q.field("slug"), args.slug))
        .first();
      docId = d?._id ?? null;
    }
    if (!docId) {
      return { ok: false, reason: "not_found", table: args.table, slug: args.slug };
    }
    await ctx.db.patch(docId, {
      coverStorageId: args.coverStorageId,
      coverMeta: args.coverMeta,
      ...(args.fileStorageId
        ? { fileStorageId: args.fileStorageId, fileMeta: args.fileMeta }
        : {}),
    });
    return { ok: true, table: args.table, slug: args.slug };
  },
});

export const seedLore = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const l of args.items) {
      const existing = await ctx.db
        .query("loreEntries")
        .filter((q) => q.eq(q.field("slug"), l.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("loreEntries", l);
    }
  },
});

export const seedLoreLibrary = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const l of args.items) {
      const existing = await ctx.db
        .query("loreLibrary")
        .filter((q) => q.eq(q.field("slug"), l.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("loreLibrary", l);
    }
  },
});

export const seedTransmissions = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const t of args.items) {
      const existing = await ctx.db
        .query("transmissions")
        .filter((q) => q.eq(q.field("slug"), t.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("transmissions", t);
    }
  },
});

export const seedResources = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const r of args.items) {
      const existing = await ctx.db
        .query("resources")
        .filter((q) => q.eq(q.field("slug"), r.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("resources", r);
    }
  },
});

export const seedMissions = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const m of args.items) {
      const existing = await ctx.db
        .query("missions")
        .filter((q) => q.eq(q.field("slug"), m.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("missions", m);
    }
  },
});

export const seedGroups = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const g of args.items) {
      const existing = await ctx.db
        .query("groups")
        .filter((q) => q.eq(q.field("slug"), g.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("groups", g);
    }
    // Seed community features alongside groups (idempotent on title).
    await ctx.runMutation(internal.seedHelpers.seedSignals, {});
    await ctx.runMutation(internal.seedHelpers.seedCalendar, {});
    await ctx.runMutation(internal.seedHelpers.seedCaptainLogs, {});
    await ctx.runMutation(internal.seedHelpers.seedChangelog, {});
    await ctx.runMutation(internal.seedHelpers.seedFleetRecords, {});
  },
});

// Mini-ARG signal vault (#4): intercepts members can decrypt for rewards.
const SIGNAL_SPECS = [
  {
    title: "First Echo",
    ciphertext: "gur syrrg erzrzoref",
    hint: "Run the transmission through the same cipher that turns 'be' into 'or' — thirteen clicks around the wheel.",
    plaintext: "the fleet remembers",
    rewardXp: 20,
    rewardCredits: 15,
    solvedBy: [],
    active: true,
    createdAt: Date.now(),
  },
  {
    title: "Temporal Anomaly",
    ciphertext: "serudne ecrof artlu",
    hint: "The rift reads time backwards. Mirror the transmission.",
    plaintext: "ultra force endures",
    rewardXp: 25,
    rewardCredits: 20,
    solvedBy: [],
    active: true,
    createdAt: Date.now(),
  },
  {
    title: "Deep Archive",
    ciphertext: "gur nepunir jnxrf",
    hint: "Same wheel as the First Echo — the archivist is consistent.",
    plaintext: "the archive wakes",
    rewardXp: 30,
    rewardCredits: 25,
    solvedBy: [],
    active: true,
    createdAt: Date.now(),
  },
];

export const seedSignals = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const s of SIGNAL_SPECS) {
      const existing = await ctx.db
        .query("signals")
        .filter((q) => q.eq(q.field("title"), s.title))
        .first();
      if (existing) continue;
      await ctx.db.insert("signals", s);
    }
  },
});

// Site-wide events calendar (#7) — scheduled relative to seed time.
export const seedCalendar = internalMutation({
  args: {},
  handler: async (ctx) => {
    const operator = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("displayName"), "Cmdr. Vega"))
      .first();
    if (!operator) return;
    const now = Date.now();
    const DAY = 86_400_000;
    const specs = [
      {
        title: "Lore Lab — Weekly Writing Session",
        description:
          "Bring a work-in-progress and write shoulder-to-shoulder with the fleet. One hour of focused drafting followed by peer notes.",
        kind: "lore_lab",
        scheduledAt: now + 2 * DAY,
        endsAt: now + 2 * DAY + 3_600_000,
        location: "Community Hub → Lore Lab",
        link: "/groups",
        status: "scheduled",
      },
      {
        title: "Faction Council — Monthly Meeting",
        description:
          "Ultra Force, G.I.A., Starforge Union, and the Chrono Monks send representatives. Agenda: the Q4 arc plan and faction missions.",
        kind: "faction_meeting",
        scheduledAt: now + 6 * DAY,
        endsAt: now + 6 * DAY + 7_200_000,
        location: "Forums → Bridge Council",
        status: "scheduled",
      },
      {
        title: "Live Q&A with the Creator",
        description:
          "Bring your timeline questions, character theories, and plot holes. The Captain answers on the record — archive posted after.",
        kind: "live_qa",
        scheduledAt: now + 10 * DAY,
        endsAt: now + 10 * DAY + 5_400_000,
        location: "Community Hub → Live Q&A",
        link: "/community",
        status: "scheduled",
      },
      {
        title: "Seasonal Arc Launch — 'Echoes of the Rift'",
        description:
          "The next story arc goes live at midnight. Countdown event: chapter one, new lore entries, and a fresh Signal Vault drop.",
        kind: "release",
        scheduledAt: now + 14 * DAY,
        location: "Everywhere",
        status: "scheduled",
      },
      {
        title: "Starforge Yards — Community Ship Design",
        description:
          "Collaborative design jam: sketch the next starship class with the shipwrights. Winning blueprint gets canonized.",
        kind: "community",
        scheduledAt: now + 20 * DAY,
        endsAt: now + 20 * DAY + 7_200_000,
        location: "Groups → Starforge Union Yards",
        status: "scheduled",
      },
    ];
    for (const s of specs) {
      const existing = await ctx.db
        .query("calendarEvents")
        .filter((q) => q.eq(q.field("title"), s.title))
        .first();
      if (existing) continue;
      await ctx.db.insert("calendarEvents", {
        ...s,
        createdBy: operator._id,
        createdAt: now,
      });
    }
  },
});

// Captain's Log (#10) — demo entries from the operator account.
export const seedCaptainLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const operator = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("displayName"), "Cmdr. Vega"))
      .first();
    if (!operator) return;
    const now = Date.now();
    const DAY = 86_400_000;
    const specs = [
      {
        title: "Log 047 — The rift is talking again",
        body: "The sector probes picked up a repeating signal pattern this morning. Same cipher family as the vault intercepts, so the Signal Vault should get a new entry before the week is out. Meanwhile: the Lore Lab session had our biggest turnout yet — keep it up.",
        publishedAt: now - 1 * DAY,
      },
      {
        title: "Log 046 — Blueprints on the bridge",
        body: "The Starforge Yards crew posted a first-pass hull schematic for the new cruiser class and it is gorgeous. If you want input on the design, join the Yards group — the builder's circle closes the jam Sunday.",
        publishedAt: now - 3 * DAY,
      },
      {
        title: "Log 045 — Chapter drafts are rolling in",
        body: "Review desk is swimming in strong drafts this month. Expect approvals to tick up through the week. And yes — I read the comments; the New Terra festival lore is now canon.",
        publishedAt: now - 6 * DAY,
      },
    ];
    for (const s of specs) {
      const existing = await ctx.db
        .query("captainLogs")
        .filter((q) => q.eq(q.field("title"), s.title))
        .first();
      if (existing) continue;
      await ctx.db.insert("captainLogs", {
        title: s.title,
        body: s.body,
        authorId: operator._id,
        publishedAt: s.publishedAt,
        createdAt: now,
      });
    }
  },
});

// Changelog (#27) — demo release notes from the operator account.
export const seedChangelog = internalMutation({
  args: {},
  handler: async (ctx) => {
    const operator = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("displayName"), "Cmdr. Vega"))
      .first();
    if (!operator) return;
    const now = Date.now();
    const DAY = 86_400_000;
    const specs = [
      {
        title: "Rank, Badges, and the Signal Vault land",
        version: "0.9.4",
        body: "• Rank progression with XP across lore, art, discoveries, missions, and comments\n• Lore-themed achievement badges (First Contact, Starforge Artisan, Temporal Investigator, Fleet Commander, Founder's Crest)\n• The Signal Vault — decrypt ciphers for XP and Star Credits\n• Star Credits economy with the Cosmetic Lab (profile frames)",
        publishedAt: now - 2 * DAY,
      },
      {
        title: "Events calendar and Captain's Log",
        version: "0.9.5",
        body: "• /events — weekly Lore Lab, faction meetings, live Q&As, and lore-release countdowns\n• Captain's Log — daily behind-the-scenes updates on the Community page\n• Faction, ship-crew, and homeworld group categories",
        publishedAt: now - 5 * DAY,
      },
      {
        title: "Leaderboard and notifications polish",
        version: "0.9.6",
        body: "• Standalone /leaderboard with podium and full standings\n• Header notification bell with unread badge and mark-all-read\n• Reactions on lore entries, forum threads, and mission reports\n• Continue reading on /stories",
        publishedAt: now - 8 * DAY,
      },
    ];
    for (const s of specs) {
      const existing = await ctx.db
        .query("changelogEntries")
        .filter((q) => q.eq(q.field("title"), s.title))
        .first();
      if (existing) continue;
      await ctx.db.insert("changelogEntries", {
        title: s.title,
        body: s.body,
        version: s.version,
        authorId: operator._id,
        publishedAt: s.publishedAt,
        createdAt: now,
      });
    }
  },
});

export const seedThreads = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const t of args.items) {
      const existing = await ctx.db
        .query("forumThreads")
        .filter((q) => q.eq(q.field("slug"), t.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("forumThreads", t);
    }
  },
});

// ---- Group workspace (roles, posts, chat, missions/events) -------------
// Each of these is once-only *per group* (or per group+user pair for
// memberships) so re-running the seed never duplicates workspace content.

export const seedGroupMembers = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const m of args.items) {
      const existing = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", m.groupId))
        .filter((q) => q.eq(q.field("userId"), m.userId))
        .first();
      if (existing) continue;
      await ctx.db.insert("groupMembers", {
        groupId: m.groupId,
        userId: m.userId,
        joinedAt: m.joinedAt,
        role: m.role ?? "member",
      });
    }
  },
});

export const seedGroupPosts = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    // Posts have no natural unique key — once-only per table, so re-running
    // the seed never duplicates the feed (a `clear: true` wipe resets it).
    const anyExisting = await ctx.db.query("groupPosts").first();
    if (anyExisting) return;
    for (const p of args.items) {
      await ctx.db.insert("groupPosts", {
        groupId: p.groupId,
        authorId: p.authorId,
        title: p.title,
        body: p.body,
        kind: p.kind ?? "post",
        pinned: p.pinned ?? false,
        createdAt: p.createdAt,
      });
    }
  },
});

export const seedGroupMessages = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const anyExisting = await ctx.db.query("groupMessages").first();
    if (anyExisting) return;
    for (const msg of args.items) {
      await ctx.db.insert("groupMessages", {
        groupId: msg.groupId,
        authorId: msg.authorId,
        body: msg.body,
        createdAt: msg.createdAt,
      });
    }
  },
});

export const seedGroupEvents = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const anyExisting = await ctx.db.query("groupEvents").first();
    if (anyExisting) return;
    for (const ev of args.items) {
      const eventId = await ctx.db.insert("groupEvents", {
        groupId: ev.groupId,
        createdBy: ev.createdBy,
        title: ev.title,
        description: ev.description,
        kind: ev.kind,
        status: ev.status ?? "open",
        scheduledAt: ev.scheduledAt,
        createdAt: ev.createdAt,
      });
      for (const userId of ev.signupUserIds ?? []) {
        await ctx.db.insert("groupEventSignups", {
          eventId,
          userId,
          createdAt: ev.createdAt + 1000,
        });
      }
    }
  },
});

// ---- Once-only inserts (skip entirely if the table has any rows) ----

export const seedSectors = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("sectorMap").collect();
    if (existing.length > 0) return;
    for (const s of args.items) await ctx.db.insert("sectorMap", s);
  },
});

export const seedFleetReports = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("fleetReports").collect();
    if (existing.length > 0) return;
    for (const f of args.items) await ctx.db.insert("fleetReports", f);
  },
});

export const seedActivity = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("activityFeed").collect();
    if (existing.length > 0) return;
    for (const a of args.items) await ctx.db.insert("activityFeed", a);
  },
});

export const seedModeration = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("moderationItems").collect();
    if (existing.length > 0) return;
    for (const m of args.items) await ctx.db.insert("moderationItems", m);
  },
});

export const seedIdentity = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("identityVerifications")
      .collect();
    if (existing.length > 0) return;
    for (const v of args.items) await ctx.db.insert("identityVerifications", v);
  },
});

export const seedAudit = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("auditLog").collect();
    if (existing.length > 0) return;
    for (const a of args.items) await ctx.db.insert("auditLog", a);
  },
});

/**
 * Add "Example" tag to all seeded stories that don't already have it.
 * Safe to re-run — only touches stories missing the tag.
 */
export const tagSeededStoriesExample = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").collect();
    let patched = 0;
    for (const s of stories) {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      if (tags.includes("Example")) continue;
      await ctx.db.patch(s._id, { tags: ["Example", ...tags] });
      patched++;
    }
    return { patched };
  },
});

/**
 * Tag all existing stories with "Example" so visitors can tell demo
 * content from real submissions. Safe to re-run.
 */
// ---- Fleet sub-records (armament sheets, service histories, black-box files) ----

// Fleet record specs reference vessel designations. The helper resolves
// them to vessel IDs at runtime so the seed is idempotent on vessel
// existence and on table-emptiness.

const ARMAMENT_SPECS = [
  {
    vesselDesignation: "OMEGA MAJESTY",
    title: "Omega Majesty — Primary Loadout",
    primaryArmament: "4× MK-9 Helical Plasma Repeaters — 1,200 RPM, 14.8 km effective range",
    secondaryArmament: "15× Antimatter Micro-Mines — AM-7 Cascade warhead",
    defensiveSystems: "Graviton Force-Field Class 6 Barrier — 8.4 sec recharge, full sphere 360° coverage",
    ammunitionNotes: "Plasma cells rated for 12,000 bursts per cell. Micro-mines resupplied at drydock only.",
    classification: "heavy",
  },
  {
    vesselDesignation: "F5000-A",
    title: "Sagittarius Standard — Multi-Role Strike Loadout",
    primaryArmament: "4× MK-9 Helical Plasma Repeaters — 1,200 RPM, 14.8 km effective range",
    secondaryArmament: "15× Antimatter Micro-Mines — AM-7 Cascade warhead",
    defensiveSystems: "Graviton Force-Field Class 6 Barrier — 8.4 sec recharge, full sphere 360° coverage",
    ammunitionNotes: "Standard production loadout. Neural Interface Class IV required for targeting sync.",
    classification: "standard",
  },
  {
    vesselDesignation: "VANGUARD SOVEREIGN",
    title: "Vanguard Sovereign — Classified Weapons Platform",
    primaryArmament: "CLASSIFIED",
    secondaryArmament: "CLASSIFIED",
    defensiveSystems: "CLASSIFIED — Tier Command clearance required",
    ammunitionNotes: "CLASSIFIED",
    classification: "classified",
  },
];

const SERVICE_SPECS = [
  {
    vesselDesignation: "OMEGA MAJESTY",
    eventType: "deployment",
    title: "Initial commissioning patrol — Sol system-Gemini",
    details: "Omega Majesty completed its inaugural patrol sweep of the Sol system-Gemini corridor. All systems nominal. Beacon traffic confirmed on Terran frequency.",
    eventDate: "Stardate 2841.3",
    location: "Sol system-Gemini",
    sourceReference: "Fleet Command Dispatch #041",
  },
  {
    vesselDesignation: "OMEGA MAJESTY",
    eventType: "refit",
    title: "Graviton barrier upgrade — Class 5 → Class 6",
    details: "Barrier projectors replaced with Class 6 units during scheduled drydock at Celestial Dynamics Platform Theta-7. Recharge time improved from 11.2s to 8.4s.",
    eventDate: "Stardate 2855.7",
    location: "Platform Theta-7 Drydock",
    sourceReference: "Refit Manifest RF-2855-001",
  },
  {
    vesselDesignation: "VANGUARD SOVEREIGN",
    eventType: "incident",
    title: "Corridor 4 anomaly encounter",
    details: "Vanguard Sovereign encountered an unidentified signal echo in Corridor 4 during a routine patrol. Vessel held position for 47 minutes while the signal was logged. No damage sustained.",
    eventDate: "Stardate 2862.1",
    location: "Corridor 4, Outer Belt",
    sourceReference: "Incident Report IR-2862-004",
  },
  {
    vesselDesignation: "F5000-A",
    eventType: "milestone",
    title: "1,000th flight hour logged",
    details: "Sagittarius Standard logged its 1,000th flight hour during a long-range recon sweep. Pilot Dax Norel at the neural interface.",
    eventDate: "Stardate 2858.9",
    location: "Outer Belt — Grid 7-Theta",
    sourceReference: "Flight Log FL-2858-1000",
  },
];

const BLACKBOX_SPECS = [
  {
    vesselDesignation: "VANGUARD SOVEREIGN",
    fileCode: "BB-001",
    title: "Corridor 4 Signal Echo — Full Recording",
    incidentDate: "Stardate 2862.1",
    classification: "restricted",
    summary: "Vanguard Sovereign recorded a repeating signal echo in Corridor 4 matching the 9-minute cycle reported by the listening-post network. Signal origin unidentified. No hostile action detected.",
    payload: "BLACK-BOX AUDIO LOG — STELLAR DATE 2862.1\nVessel: VANGUARD SOVEREIGN\nLocation: Corridor 4, Outer Belt\nDuration: 47 minutes\n\n00:00 — Signal echo detected on bearing 247.3\n00:12 — Echo confirms 9-minute repeating pattern\n00:47 — Pattern logged to signal archive\n01:03 — No hostile contact. Holding position.\n\nEnd of log. Classification: RESTRICTED.",
  },
  {
    vesselDesignation: "OMEGA MAJESTY",
    fileCode: "BB-002",
    title: "Sol system-Gemini Beacon Resumption — Bridge Recording",
    incidentDate: "Stardate 2841.3",
    classification: "classified",
    summary: "Bridge recording of the moment the Sol system-Gemini beacon resumed broadcasting on a Terran frequency after nearly four decades of silence. Three confirmed contacts, one anomaly pending classification.",
    payload: "BLACK-BOX BRIDGE LOG — STELLAR DATE 2841.3\nVessel: OMEGA MAJESTY\nLocation: Sol system-Gemini\nDuration: 12 minutes\n\n00:00 — Beacon resumed at 04:18 local\n00:34 — First sweep team returned: 3 confirmed contacts\n02:17 — Anomaly on bearing 091.2 — unclassified\n04:45 — Mirra Singh deploys two recon wings\n11:58 — Second wing entering the dark corridor\n\nEnd of log. Classification: CLASSIFIED.",
  },
];

export const seedFleetRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Skip if all three tables already have rows (partial inserts possible
    // when vessel designations change, so only skip when every table is populated).
    const existingSheets = await ctx.db.query("armamentSheets").first();
    const existingHistories = await ctx.db.query("serviceHistories").first();
    const existingBoxes = await ctx.db.query("blackBoxFiles").first();
    if (existingSheets && existingHistories && existingBoxes) return;

    // Resolve vessel designations → IDs.
    const vessels = await ctx.db.query("vessels").collect();
    const vesselByDesignation = new Map(
      vessels.map((v) => [v.designation, v._id]),
    );
    const now = Date.now();

    for (const spec of ARMAMENT_SPECS) {
      const vesselId = vesselByDesignation.get(spec.vesselDesignation);
      if (!vesselId) continue;
      await ctx.db.insert("armamentSheets", {
        vesselId,
        title: spec.title,
        primaryArmament: spec.primaryArmament,
        secondaryArmament: spec.secondaryArmament,
        defensiveSystems: spec.defensiveSystems,
        ammunitionNotes: spec.ammunitionNotes,
        classification: spec.classification,
        createdAt: now,
      });
    }

    for (const spec of SERVICE_SPECS) {
      const vesselId = vesselByDesignation.get(spec.vesselDesignation);
      if (!vesselId) continue;
      await ctx.db.insert("serviceHistories", {
        vesselId,
        eventType: spec.eventType,
        title: spec.title,
        details: spec.details,
        eventDate: spec.eventDate,
        location: spec.location,
        sourceReference: spec.sourceReference,
        createdAt: now,
      });
    }

    for (const spec of BLACKBOX_SPECS) {
      const vesselId = vesselByDesignation.get(spec.vesselDesignation);
      if (!vesselId) continue;
      await ctx.db.insert("blackBoxFiles", {
        vesselId,
        fileCode: spec.fileCode,
        title: spec.title,
        incidentDate: spec.incidentDate,
        classification: spec.classification,
        summary: spec.summary,
        payload: spec.payload,
        createdAt: now,
      });
    }
  },
});

export const tagAllStoriesExample = mutation({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").collect();
    let patched = 0;
    for (const s of stories) {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      if (tags.includes("Example")) continue;
      await ctx.db.patch(s._id, { tags: ["Example", ...tags] });
      patched++;
    }
    return { patched };
  },
});
