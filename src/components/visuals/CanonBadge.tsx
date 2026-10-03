import type { CSSProperties } from "react";
import goldPlateUrl from "@/assets/gold-plate-texture.jpg";

// =========================================================================
// CanonBadge — the REQUIRED canon approval badge, rendered anywhere visual
// assets surface: Canon Image Library, Species/Technology viewers (lab
// dossiers), Missions Deck, Storyboards, Artist Profiles.
//
//   approved        gold texture "CANON APPROVED"
//   pending         neon-blue "PENDING REVIEW"
//   rejected        red "REJECTED"
//   needs_revision  yellow "NEEDS REVISION"
// =========================================================================

export type CanonStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "needs_revision";

const GOLD_BADGE: CSSProperties = {
  backgroundImage: `linear-gradient(180deg, rgba(255,244,200,0.55) 0%, rgba(255,255,255,0) 40%, rgba(90,60,10,0.30) 100%), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
};

export function CanonBadge({
  status,
  className = "",
}: {
  status: CanonStatus | string;
  className?: string;
}) {
  const base =
    "sf-deck inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] whitespace-nowrap";
  switch (status) {
    case "approved":
      return (
        <span
          className={`${base} border border-[rgba(230,168,23,0.8)] text-[#1A1300] ${className}`}
          style={GOLD_BADGE}
        >
          ✓ Canon approved
        </span>
      );
    case "rejected":
      return (
        <span
          className={`${base} border border-[rgba(255,77,109,0.7)] bg-[rgba(255,77,109,0.16)] text-[#FF6B85] ${className}`}
        >
          Rejected
        </span>
      );
    case "needs_revision":
      return (
        <span
          className={`${base} border border-[rgba(243,200,73,0.7)] bg-[rgba(243,200,73,0.14)] text-[#F3C849] ${className}`}
        >
          Needs revision
        </span>
      );
    default:
      return (
        <span
          className={`${base} border border-[rgba(0,200,255,0.7)] bg-[rgba(0,200,255,0.12)] text-[#00C8FF] ${className}`}
        >
          ● Pending review
        </span>
      );
  }
}
