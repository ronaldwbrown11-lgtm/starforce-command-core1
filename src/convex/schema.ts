import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// Roles: admin (built-in via convex auth), member (Pro/Elite), guest
// Ultra Force has the operator console as a separate UI; admin-only.
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// Membership tiers — canonical list lives in src/lib/tiers.ts.
// Keep schema and frontend in sync.
export const TIERS = ["free", "cadet", "officer", "command", "gia_agent"] as const;
export const tierValidator = v.union(
  v.literal("free"),
  v.literal("cadet"),
  v.literal("officer"),
  v.literal("command"),
  v.literal("gia_agent"),
);
export type TierId = Infer<typeof tierValidator>;

// Operator roles (CMS-side)
export const OP_ROLES = {
  OPERATOR: "operator",
  SENIOR_OPERATOR: "senior_operator",
  STORY_EDITOR: "story_editor",
  LORE_ARCHIVIST: "lore_archivist",
  COMMUNITY_MOD: "community_moderator",
} as const;
export const opRoleValidator = v.union(
  v.literal(OP_ROLES.OPERATOR),
  v.literal(OP_ROLES.SENIOR_OPERATOR),
  v.literal(OP_ROLES.STORY_EDITOR),
  v.literal(OP_ROLES.LORE_ARCHIVIST),
  v.literal(OP_ROLES.COMMUNITY_MOD),
);

// Content workflow status
export const STORY_STATUS = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "archived",
] as const;
export const storyStatusValidator = v.union(...STORY_STATUS.map(v.literal));

const schema = defineSchema(
  {
    ...authTables,

    // Extend the default users table with rank/XP/fleet/tier/operator role.
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),

      // Secondary contact address ("message email") — separate from the
      // sign-in email; used for site correspondence.
      contactEmail: v.optional(v.string()),
      // Opt out of the weekly fleet digest email (#20).
      emailOptOut: v.optional(v.boolean()),

      // Ultra Force extensions
      displayName: v.optional(v.string()),
      rank: v.optional(v.string()), // Recruit / Aspirant / Pilot / Commander / Captain / Admiral
      xp: v.optional(v.number()),
      fleet: v.optional(v.string()), // faction name
      tier: v.optional(tierValidator),
      opRole: v.optional(opRoleValidator), // operator/admin role
      avatarUrl: v.optional(v.string()),
      avatarStorageId: v.optional(v.id("_storage")),
      bio: v.optional(v.string()),
      lastSeen: v.optional(v.number()),
      mfaEnabled: v.optional(v.boolean()),
      trustDevice: v.optional(v.boolean()),
      achievements: v.optional(v.array(v.string())),
      // Verified contributions (approved lore, published stories, certified
      // discoveries, filed mission reports, comments) — drives the Fleet
      // Commander badge.
      contributionCount: v.optional(v.number()),
      // Ultra Force virtual currency (#8): earned at contribution sites,
      // spent in the Cosmetic Lab on profile frames and other cosmetics.
      credits: v.optional(v.number()),
      // Custom display flair — paid-tier perk (#32). Rendered next to the
      // display name on profiles, story bylines, and comments.
      flair: v.optional(v.string()),
      frame: v.optional(v.string()), // equipped profile frame id
      frames: v.optional(v.array(v.string())), // owned frame ids
      // First-run pilot orientation (rank / fleet / starter mission picker)
      onboarded: v.optional(v.boolean()),
      // Per-tier usage counters
      monthlyAiUsed: v.optional(v.number()),
      storageUsedGb: v.optional(v.number()),
      monthlyResetAt: v.optional(v.number()),

      // Stripe billing links (self-serve membership)
      stripeCustomerId: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
    })
      .index("email", ["email"])
      .searchIndex("search_display_name", { searchField: "displayName" })
      .searchIndex("search_name", { searchField: "name" }),

    // ---- Content tables ----

    stories: defineTable({
      title: v.string(),
      slug: v.string(),
      excerpt: v.string(),
      content: v.string(),
      authorId: v.id("users"),
      status: storyStatusValidator,
      series: v.optional(v.string()),
      factions: v.optional(v.array(v.string())),
      sectors: v.optional(v.array(v.string())),
      classification: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      views: v.optional(v.number()),
      commentCount: v.optional(v.number()),
      readMinutes: v.optional(v.number()),
      publishedAt: v.optional(v.number()),
      submittedAt: v.optional(v.number()),
      // Author XP granted when the story first goes live (double-award guard)
      xpAwardedAt: v.optional(v.number()),
      // Operator-curated featured surfaces
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      coverStorageId: v.optional(v.id("_storage")),
      coverMeta: v.optional(
        v.object({
          mimeType: v.string(),
          byteSize: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
          altText: v.optional(v.string()),
        }),
      ),
      // Author-submitted manuscript file (PDF / DOC / DOCX / TXT / MD)
      attachmentStorageId: v.optional(v.id("_storage")),
      attachmentMeta: v.optional(
        v.object({
          fileName: v.string(),
          mimeType: v.string(),
          byteSize: v.number(),
        }),
      ),
      // AI canon-compliance scan (written by canonScanner.ts after submit)
      canonScan: v.optional(
        v.object({
          verdict: v.string(), // canon / conflict / needs_review
          confidence: v.optional(v.number()),
          summary: v.optional(v.string()),
          conflicts: v.optional(
            v.array(
              v.object({
                claim: v.string(),
                canonRef: v.optional(v.string()),
                severity: v.optional(v.string()), // minor / major / critical
              }),
            ),
          ),
          model: v.optional(v.string()),
          error: v.optional(v.string()),
        }),
      ),
      canonScanAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_slug", ["slug"])
      .index("by_published", ["publishedAt"])      .index("by_featured", ["featured", "featuredOrder"])
      .searchIndex("search_title", { searchField: "title" })
      .searchIndex("search_content", { searchField: "content" }),
    loreEntries: defineTable({
      title: v.string(),
      slug: v.string(),
      excerpt: v.string(),
      content: v.string(),
      authorId: v.id("users"),
      faction: v.optional(v.string()),
      sector: v.optional(v.string()),
      era: v.optional(v.string()),
      classification: v.optional(v.string()),
      entryType: v.optional(v.string()), // character / location / event / artifact
      tierRequired: v.optional(tierValidator), // gating
      views: v.optional(v.number()),
      // Operator-curated featured surfaces
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      coverStorageId: v.optional(v.id("_storage")),
      coverMeta: v.optional(
        v.object({
          mimeType: v.string(),
          byteSize: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
          altText: v.optional(v.string()),
        }),
      ),
      createdAt: v.number(),
    })
      .index("by_faction", ["faction"])
      .index("by_sector", ["sector"])
      .index("by_classification", ["classification"])
      .index("by_featured", ["featured", "featuredOrder"])
      .searchIndex("search_title", { searchField: "title" })
      .searchIndex("search_content", { searchField: "content" }),

    // Lore Library — media assets beyond text entries: lore bibles (PDF/DOC),
    // lore image galleries, and subdomain-embedded lore databases. Items flow
    // through an approval workflow (submitted → approved/rejected) when
    // authored by members, or are written directly by operators.
    loreLibrary: defineTable({
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      loreType: v.string(), // "bible" | "image" | "database"
      status: v.string(), // draft / submitted / approved / rejected / archived
      authorId: v.id("users"),
      faction: v.optional(v.string()),
      sector: v.optional(v.string()),
      era: v.optional(v.string()),
      classification: v.optional(v.string()),
      // Attached file (bibles as PDF/DOC/TXT, images as JPEG/PNG/WebP/AVIF/GIF)
      fileStorageId: v.optional(v.id("_storage")),
      fileMeta: v.optional(
        v.object({
          fileName: v.string(),
          mimeType: v.string(),
          byteSize: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        }),
      ),
      // Cover thumbnail for cards
      coverStorageId: v.optional(v.id("_storage")),
      coverMeta: v.optional(
        v.object({
          mimeType: v.string(),
          byteSize: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
          altText: v.optional(v.string()),
        }),
      ),
      // Subdomain-embedded lore database (frontend URL mounted in an iframe)
      databaseUrl: v.optional(v.string()),
      databaseName: v.optional(v.string()),
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      views: v.optional(v.number()),
      submittedAt: v.optional(v.number()),
      reviewedAt: v.optional(v.number()),
      reviewerId: v.optional(v.id("users")),
      // Author XP granted on approval (double-award guard)
      xpAwardedAt: v.optional(v.number()),
      // AI canon-compliance scan (written by canonScanner.ts after submit)
      canonScan: v.optional(
        v.object({
          verdict: v.string(), // canon / conflict / needs_review
          confidence: v.optional(v.number()),
          summary: v.optional(v.string()),
          conflicts: v.optional(
            v.array(
              v.object({
                claim: v.string(),
                canonRef: v.optional(v.string()),
                severity: v.optional(v.string()), // minor / major / critical
              }),
            ),
          ),
          model: v.optional(v.string()),
          error: v.optional(v.string()),
        }),
      ),
      canonScanAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_type_status", ["loreType", "status"])
      .index("by_status", ["status"])
      .index("by_author", ["authorId"])
      .index("by_featured", ["featured", "featuredOrder"])
      .searchIndex("search_title", { searchField: "title" }),

    transmissions: defineTable({
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      videoUrl: v.optional(v.string()),
      // Podcast / audio-only transmission (#29): direct audio URL (mp3/ogg/
      // m4a) or a hosted podcast feed entry. Renders on the Videos page's
      // Audio tab when set.
      audioUrl: v.optional(v.string()),
      thumbnailUrl: v.optional(v.string()),
      transmissionType: v.optional(v.string()), // briefing / mission / lore-deepdive / podcast
      durationSeconds: v.optional(v.number()),
      relatedStories: v.optional(v.array(v.id("stories"))),
      relatedLore: v.optional(v.array(v.id("loreEntries"))),
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      coverStorageId: v.optional(v.id("_storage")),
      coverMeta: v.optional(
        v.object({
          mimeType: v.string(),
          byteSize: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
          altText: v.optional(v.string()),
        }),
      ),
      // Operator-uploaded video file (MP4 / WebM / OGV) played on the channel
      // when no external `videoUrl` is set. Stored in Convex file storage.
      fileStorageId: v.optional(v.id("_storage")),
      fileMeta: v.optional(
        v.object({
          fileName: v.string(),
          mimeType: v.string(),
          byteSize: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        }),
      ),
      createdAt: v.number(),
    })
      .index("by_featured", ["featured", "featuredOrder"])
      .searchIndex("search_title", { searchField: "title" }),

    resources: defineTable({
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      resourceType: v.optional(v.string()), // guide / tool / download / onboarding / policy
      tierRequired: v.optional(tierValidator),
      url: v.optional(v.string()),
      // Operator-uploaded document (PDF / DOC / DOCX / TXT / MD / images) used
      // when no external `url` is set. Stored in Convex file storage.
      fileStorageId: v.optional(v.id("_storage")),
      fileMeta: v.optional(
        v.object({
          fileName: v.string(),
          mimeType: v.string(),
          byteSize: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        }),
      ),
      createdAt: v.number(),
    })
      .index("by_type", ["resourceType"])
      .searchIndex("search_title", { searchField: "title" }),

    missions: defineTable({
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      missionStatus: v.optional(v.string()), // active / completed / locked
      xpReward: v.optional(v.number()),
      tierRequired: v.optional(tierValidator),
      // In-depth briefing surfaced on the mission detail page.
      briefing: v.optional(v.string()),
      objectives: v.optional(v.array(v.string())),
      location: v.optional(v.string()),
      durationLabel: v.optional(v.string()),
      reportGuidance: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_status", ["missionStatus"])
      .index("by_slug", ["slug"]),

    fleetReports: defineTable({
      title: v.string(),
      content: v.string(),
      authorId: v.id("users"),
      // Mission a report-in belongs to (optional for legacy/general reports).
      missionId: v.optional(v.id("missions")),
      xpAwarded: v.optional(v.number()),
      // Operator review workflow: pending / approved / rejected / flagged.
      reviewStatus: v.optional(v.string()),
      reviewerId: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      reviewNote: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_mission", ["missionId"])
      .index("by_author_mission", ["authorId", "missionId"])
      .index("by_review_status", ["reviewStatus", "createdAt"]),

    // ---- Community ----

    comments: defineTable({
      postId: v.string(), // polymorphic id; resolved by parent type
      parentType: v.string(), // "story" | "lore" | "transmission" | "activity"
      authorId: v.id("users"),
      content: v.string(),
      parentCommentId: v.optional(v.id("comments")),
      status: v.string(), // published / hold / deleted
      createdAt: v.number(),
    })
      .index("by_post", ["postId", "createdAt"])
      .index("by_status", ["status"]),

    reactions: defineTable({
      targetId: v.string(), // comment id or activity id
      targetType: v.string(),
      userId: v.id("users"),
      kind: v.string(), // "transmit" / "salute" / "warn"
      createdAt: v.number(),
    })
      .index("by_target", ["targetId"])
      .index("by_user_target", ["userId", "targetId"]),

    activityFeed: defineTable({
      actorId: v.id("users"),
      verb: v.string(), // published / commented / joined / reacted
      targetType: v.string(),
      targetId: v.string(),
      url: v.optional(v.string()),
      summary: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    groups: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.string(),
      category: v.optional(v.string()),
      privacy: v.string(), // public / private / classified
      memberCount: v.optional(v.number()),
      latestActivityAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_privacy", ["privacy"])
      .searchIndex("search_name", { searchField: "name" }),

    groupMembers: defineTable({
      groupId: v.id("groups"),
      userId: v.id("users"),
      joinedAt: v.number(),
      // owner / moderator / member (absent on legacy rows = member)
      role: v.optional(
        v.union(v.literal("owner"), v.literal("moderator"), v.literal("member")),
      ),
    })
      .index("by_group", ["groupId"])
      .index("by_user", ["userId"]),

    // ---- Group workspace: chat, posts, missions/events ----

    groupMessages: defineTable({
      groupId: v.id("groups"),
      authorId: v.id("users"),
      body: v.string(),
      createdAt: v.number(),
    }).index("by_group_created", ["groupId", "createdAt"]),

    groupPosts: defineTable({
      groupId: v.id("groups"),
      authorId: v.id("users"),
      title: v.string(),
      body: v.string(),
      kind: v.union(v.literal("post"), v.literal("announcement")),
      pinned: v.optional(v.boolean()),
      createdAt: v.number(),
    }).index("by_group_created", ["groupId", "createdAt"]),

    groupEvents: defineTable({
      groupId: v.id("groups"),
      createdBy: v.id("users"),
      title: v.string(),
      description: v.string(),
      kind: v.union(v.literal("mission"), v.literal("event")),
      status: v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      scheduledAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_group_created", ["groupId", "createdAt"]),

    groupEventSignups: defineTable({
      eventId: v.id("groupEvents"),
      userId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_event", ["eventId"])
      .index("by_event_user", ["eventId", "userId"]),

    forumThreads: defineTable({
      title: v.string(),
      slug: v.string(),
      forumId: v.string(), // logical forum id (e.g., "general", "lore")
      authorId: v.id("users"),
      content: v.string(),
      replyCount: v.optional(v.number()),
      lastActivityAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_forum", ["forumId"])
      .index("by_last_activity", ["lastActivityAt"])
      .searchIndex("search_title", { searchField: "title" }),

    forumReplies: defineTable({
      threadId: v.id("forumThreads"),
      authorId: v.id("users"),
      content: v.string(),
      createdAt: v.number(),
    }).index("by_thread", ["threadId"]),

    // ---- Direct messages ----

    messageThreads: defineTable({
      updatedAt: v.number(),
    }).index("by_updated", ["updatedAt"]),

    threadMembers: defineTable({
      threadId: v.id("messageThreads"),
      userId: v.id("users"),
      lastReadAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_thread_user", ["threadId", "userId"]),

    messages: defineTable({
      threadId: v.id("messageThreads"),
      senderId: v.id("users"),
      body: v.string(),
      createdAt: v.number(),
    }).index("by_thread", ["threadId", "createdAt"]),

    notifications: defineTable({
      userId: v.id("users"),
      kind: v.string(), // comment / mention / story_approved / story_rejected
      title: v.string(),
      body: v.optional(v.string()),
      url: v.optional(v.string()),
      readAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_user_unread", ["userId", "readAt"]),

    // ---- Moderation / Operator / Audit ----

    moderationItems: defineTable({
      targetType: v.string(), // comment / activity / story / lore
      targetId: v.string(),
      reporterId: v.optional(v.id("users")),
      reason: v.optional(v.string()),
      status: v.string(), // pending / approved / rejected / escalated
      createdAt: v.number(),
    }).index("by_status_created", ["status", "createdAt"]),

    storyProgress: defineTable({
      userId: v.id("users"),
      storyId: v.id("stories"),
      percent: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_story", ["userId", "storyId"]),

    sessions: defineTable({
      userId: v.id("users"),
      sessionToken: v.string(),
      ua: v.string(),
      ip: v.string(),
      trust: v.boolean(),
      loginAt: v.number(),
      lastSeenAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_token", ["sessionToken"]),

    loginAttempts: defineTable({
      ip: v.string(),
      ua: v.string(),
      result: v.string(), // success / fail
      reason: v.optional(v.string()),
      time: v.number(),
    })
      .index("by_ip_time", ["ip", "time"])
      .index("by_time", ["time"]),

    identityVerifications: defineTable({
      userId: v.id("users"),
      status: v.string(), // pending / approved / rejected / needs_more_info
      documents: v.optional(v.array(v.string())),
      reviewerId: v.optional(v.id("users")),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_status", ["status"]),

    auditLog: defineTable({
      actorId: v.id("users"),
      action: v.string(), // moderation.approve / session.revoke / story.publish
      target: v.string(),
      ip: v.optional(v.string()),
      ua: v.optional(v.string()),
      meta: v.optional(v.string()), // JSON string
      createdAt: v.number(),
    })
      .index("by_actor", ["actorId"])
      .index("by_action", ["action"])
      .index("by_created", ["createdAt"]),

    moderationCategories: defineTable({
      name: v.string(),
      slug: v.string(),
      entryType: v.string(), // lore / story
      count: v.optional(v.number()),
    }).index("by_slug", ["slug"]),

    sectorMap: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      loreCount: v.optional(v.number()),
      x: v.number(), // SVG map position
      y: v.number(),
    }).index("by_slug", ["slug"]),

    // Member-proposed star systems charted onto the galaxy map. Members
    // click an empty region to propose a system; operators approve/reject.
    discoveries: defineTable({
      title: v.string(), // proposed system name
      description: v.string(),
      x: v.number(), // SVG map position (clicked region)
      y: v.number(),
      sector: v.optional(v.string()), // nearest/named sector display name
      faction: v.optional(v.string()),
      missionId: v.optional(v.id("missions")), // optional mapping operation
      authorId: v.id("users"),
      status: v.string(), // pending / approved / rejected
      reviewedAt: v.optional(v.number()),
      reviewerId: v.optional(v.id("users")),
      reviewNote: v.optional(v.string()),
      xpAwardedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_author", ["authorId"])
      .index("by_created", ["createdAt"]),

    // Member endorsements of charted systems (#30) — one row per
    // (discovery, member) pair; unique so toggling never double-counts.
    discoveryVotes: defineTable({
      discoveryId: v.id("discoveries"),
      userId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_discovery", ["discoveryId"])
      .index("by_user", ["userId"])
      .index("by_user_discovery", ["userId", "discoveryId"]),

    // Faction claims on the Star Atlas (#30) — one claim per sector name;
    // a later claim by another faction replaces the previous holder.
    sectorClaims: defineTable({
      sector: v.string(),
      faction: v.string(),
      claimedBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_sector", ["sector"]),

    // Lore Assistant usage log (#28) — one row per generation, used for
    // the daily per-tier allowance (free 3, paid 25+).
    aiAssistantLogs: defineTable({
      userId: v.id("users"),
      createdAt: v.number(),
    }).index("by_user_day", ["userId", "createdAt"]),

    // Site appearance — operator-controlled background imagery.
    // Single row keyed by `key === "main"` (singleton).
    siteAppearance: defineTable({
      key: v.string(), // "main"
      // Route path (e.g. "/stories") → uploaded background image.
      pageBackgrounds: v.optional(
        v.record(
          v.string(),
          v.object({
            storageId: v.id("_storage"),
            mimeType: v.string(),
            byteSize: v.number(),
            altText: v.optional(v.string()),
          }),
        ),
      ),
      // Global background image used behind .uf-card / HoloCard surfaces.
      cardBackground: v.optional(
        v.object({
          storageId: v.id("_storage"),
          mimeType: v.string(),
          byteSize: v.number(),
          altText: v.optional(v.string()),
        }),
      ),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // Blog posts — operator-authored articles, announcements, lore drops.
    blogPosts: defineTable({
      title: v.string(),
      slug: v.string(),
      excerpt: v.string(),
      body: v.string(), // markdown or HTML
      coverUrl: v.optional(v.string()),
      category: v.optional(v.string()), // announcement / lore / guide / update
      tags: v.optional(v.array(v.string())),
      status: v.string(), // draft / published / archived
      authorId: v.optional(v.id("users")),
      authorName: v.optional(v.string()),
      featured: v.optional(v.boolean()),
      viewCount: v.optional(v.number()),
      publishedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_status", ["status"])
      .index("by_published", ["publishedAt"])
      .index("by_category", ["category"]),

    // FAQ items — operator-managed, categorized, reorderable.
    faqItems: defineTable({
      question: v.string(),
      answer: v.string(),
      category: v.string(), // general / membership / content / technical / account
      order: v.optional(v.number()),
      status: v.string(), // draft / published
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_category", ["category"])
      .index("by_status", ["status"])
      .index("by_order", ["order"]),

    // Vessels — Star Force fleet registry (ships, stations, vehicles).
    // Site-wide events calendar (#7): weekly Lore Lab sessions, faction
    // meetings, seasonal story arcs, live Q&As, and countdowns for major
    // lore releases. Operator-managed; public /events page renders the
    // next-event countdown.
    calendarEvents: defineTable({
      title: v.string(),
      description: v.string(),
      kind: v.string(), // lore_lab / faction_meeting / arc / live_qa / release / community
      scheduledAt: v.number(),
      endsAt: v.optional(v.number()),
      location: v.optional(v.string()), // e.g. "Community Hub → Lore Lab"
      link: v.optional(v.string()),
      status: v.string(), // scheduled / live / ended / cancelled
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_scheduled", ["scheduledAt"]),

    // Changelog (#27): operator-posted release notes and platform updates,
    // rendered as a public timeline at /changelog.
    changelogEntries: defineTable({
      title: v.string(),
      body: v.string(),
      version: v.optional(v.string()),
      authorId: v.id("users"),
      publishedAt: v.number(),
      createdAt: v.number(),
    }).index("by_published", ["publishedAt"]),

    // Captain's Log (#10): the creator's daily behind-the-scenes updates,
    // surfaced on the Community page.
    captainLogs: defineTable({
      title: v.string(),
      body: v.string(),
      authorId: v.id("users"),
      publishedAt: v.number(),
      createdAt: v.number(),
    }).index("by_published", ["publishedAt"]),

    // Mini-ARG signal vault (#4): intercepted ciphers members decrypt for
    // XP and Star Credits. Answers are stored server-side (normalized);
    // solves are recorded per-user so rewards pay out exactly once.
    signals: defineTable({
      title: v.string(),
      ciphertext: v.string(),
      hint: v.string(),
      plaintext: v.string(), // normalized answer (lowercase, trimmed)
      rewardXp: v.optional(v.number()),
      rewardCredits: v.optional(v.number()),
      solvedBy: v.array(v.id("users")),
      active: v.boolean(),
      createdBy: v.optional(v.id("users")), // operator who planted the signal
      createdAt: v.number(),
    }).index("by_active", ["active"]),

    vessels: defineTable({
      designation: v.string(), // e.g. "SFSBT 8001"
      name: v.string(), // display name e.g. "OMEGA MAJESTY"
      badge: v.string(), // e.g. "FLAGSHIP", "CARRIER", "INTERCEPTOR", "CLASSIFIED"
      shipClass: v.optional(v.string()), // e.g. "Omega-Class Super Battleship"
      registry: v.optional(v.string()), // e.g. "SFSBT 8005"
      role: v.string(), // operational role description
      crew: v.optional(v.string()),
      armament: v.optional(v.string()),
      notes: v.optional(v.string()),
      hullLength: v.optional(v.string()),
      hullWidth: v.optional(v.string()),
      decks: v.optional(v.string()),
      weight: v.optional(v.string()),
      acceleration: v.optional(v.string()),
      status: v.optional(v.string()), // active / reserve / decommissioned
      // Rich fields from original fleet database
      builder: v.optional(v.string()),
      fleet: v.optional(v.string()), // assigned fleet
      commissionDate: v.optional(v.string()),
      armor: v.optional(v.string()),
      propulsion: v.optional(v.string()),
      capabilities: v.optional(v.string()),
      maneuverability: v.optional(v.string()),
      computer: v.optional(v.string()),
      primaryArmament: v.optional(v.string()),
      secondaryArmament: v.optional(v.string()),
      defensiveSystems: v.optional(v.string()),
      variants: v.optional(v.string()),
      classified: v.optional(v.boolean()),
      topDownImg: v.optional(v.string()), // URL to schematic image
      sideProfileImg: v.optional(v.string()), // URL to schematic image
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_designation", ["designation"])
      .index("by_badge", ["badge"])
      .index("by_status", ["status"]),

    supportTickets: defineTable({
      email: v.string(),
      topic: v.string(),
      message: v.string(),
      userId: v.optional(v.id("users")),
      status: v.string(), // open / responded / closed
      replies: v.optional(
        v.array(
          v.object({
            by: v.string(), // operator name who replied
            body: v.string(),
            at: v.number(),
          }),
        ),
      ),
      updatedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
