import {
  Award,
  BookMarked,
  Compass,
  Crown,
  Hammer,
  Hourglass,
  Library,
  Medal,
  MessageCircle,
  PenTool,
  Plane,
  Radio,
  Shield,
  ShieldCheck,
  Ship,
  Sparkles,
  Eye,
  Gem,
  GraduationCap,
  Swords,
  Telescope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AchievementTone = "cyan" | "violet" | "gold" | "green";

export type AchievementCatalogEntry = {
  icon: LucideIcon;
  label: string;
  description: string;
  tone: AchievementTone;
};

export const ACHIEVEMENT_CATALOG: Record<string, AchievementCatalogEntry> = {
  first_flight: {
    icon: Plane,
    label: "First Flight",
    description: "Posted your first activity feed transmission.",
    tone: "cyan",
  },
  lore_contributor: {
    icon: BookMarked,
    label: "Lore Contributor",
    description: "Authored a published lore entry.",
    tone: "violet",
  },
  crew_chief: {
    icon: Crown,
    label: "Crew Chief",
    description: "Reached the Commander rank.",
    tone: "gold",
  },
  explorer: {
    icon: Compass,
    label: "Frontier Explorer",
    description: "Filed a fleet report from an uncharted sector.",
    tone: "violet",
  },
  veteran: {
    icon: Shield,
    label: "Veteran",
    description: "One year of fleet service.",
    tone: "gold",
  },
  archivist: {
    icon: Library,
    label: "Imperial Archivist",
    description: "Curated the Lore Spotlight.",
    tone: "violet",
  },
  first_story: {
    icon: PenTool,
    label: "First Story",
    description: "Submitted a story for review.",
    tone: "cyan",
  },
  broadcaster: {
    icon: Radio,
    label: "Broadcaster",
    description: "Published a fleet transmission.",
    tone: "cyan",
  },
  moderator: {
    icon: ShieldCheck,
    label: "Moderator",
    description: "Awarded moderating capabilities.",
    tone: "green",
  },
  centurion: {
    icon: Award,
    label: "Centurion",
    description: "One hundred days on the bridge.",
    tone: "gold",
  },
  pioneer: {
    icon: Sparkles,
    label: "Pioneer",
    description: "Joined Star Force Base 1198 at launch.",
    tone: "cyan",
  },
  first_contact: {
    icon: MessageCircle,
    label: "First Contact",
    description: "Sent your first transmission to the community.",
    tone: "cyan",
  },
  starforge_artisan: {
    icon: Hammer,
    label: "Starforge Artisan",
    description: "First artwork approved for the archive.",
    tone: "violet",
  },
  temporal_investigator: {
    icon: Hourglass,
    label: "Temporal Investigator",
    description: "Certified a discovery from the sector map.",
    tone: "green",
  },
  fleet_commander: {
    icon: Ship,
    label: "Fleet Commander",
    description: "One hundred verified contributions to the fleet.",
    tone: "gold",
  },
  founders_crest: {
    icon: Medal,
    label: "Founder's Crest",
    description: "Charter member of Star Force Base 1198.",
    tone: "gold",
  },
  tier_cadet: {
    icon: GraduationCap,
    label: "Academy Cadet",
    description: "Promoted to Cadet clearance at the Academy.",
    tone: "cyan",
  },
  tier_officer: {
    icon: Telescope,
    label: "Fleet Officer",
    description: "Earned a commission as a Fleet Officer.",
    tone: "violet",
  },
  tier_command: {
    icon: Swords,
    label: "High Command",
    description: "Elevated to High Command.",
    tone: "gold",
  },
  tier_elite: {
    icon: Gem,
    label: "Elite Division",
    description: "Joined the Elite Division.",
    tone: "gold",
  },
  tier_gia_agent: {
    icon: Eye,
    label: "G.I.A Agent",
    description: "Inducted into the Galactic Intelligence Agency.",
    tone: "violet",
  },
};

// Accent color per tone, shared by the medallion widget and the compact
// badge rows used on story pages and comments.
export function achievementToneColor(tone: AchievementTone): string {
  switch (tone) {
    case "violet":
      return "var(--uf-violet)";
    case "gold":
      return "var(--uf-gold)";
    case "green":
      return "var(--uf-green)";
    default:
      return "var(--uf-cyan)";
  }
}

export function getAchievement(id: string): AchievementCatalogEntry | undefined {
  return ACHIEVEMENT_CATALOG[id];
}

export function achievementIdsFor(ids: string[]): AchievementCatalogEntry[] {
  const out: AchievementCatalogEntry[] = [];
  for (const id of ids) {
    const entry = getAchievement(id);
    if (entry) out.push(entry);
  }
  return out;
}
