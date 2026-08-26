import {
  Award,
  BookMarked,
  Compass,
  Crown,
  Library,
  PenTool,
  Plane,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
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
};

export function getAchievement(id: string): AchievementCatalogEntry | undefined {
  return ACHIEVEMENT_CATALOG[id];
}
