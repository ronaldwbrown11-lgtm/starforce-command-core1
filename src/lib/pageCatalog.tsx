import type { ReactElement } from "react";
import Home from "@/pages/Home";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import AuthPage from "@/pages/Auth";
import Stories from "@/pages/Stories";
import SearchPage from "@/pages/Search";
import Lore from "@/pages/Lore";
import LoreDatabase from "@/pages/LoreDatabase";
import LoreSubmit from "@/pages/LoreSubmit";
import LoreDetail from "@/pages/LoreDetail";
import Maps from "@/pages/Maps";
import StarAtlas from "@/pages/StarAtlas";
import Videos from "@/pages/Videos";
import Missions from "@/pages/Missions";
import MissionDetail from "@/pages/MissionDetail";
import SignalVault from "@/pages/SignalVault";
import Events from "@/pages/Events";
import Contests from "@/pages/Contests";
import ContestDetail from "@/pages/ContestDetail";
import Leaderboard from "@/pages/Leaderboard";
import Changelog from "@/pages/Changelog";
import ToolsAssistant from "@/pages/ToolsAssistant";
import EmbedStory from "@/pages/EmbedStory";
import Community from "@/pages/Community";
import Forums from "@/pages/Forums";
import Resources from "@/pages/Resources";
import Membership from "@/pages/Membership";
import Support from "@/pages/Support";
import BlogPage from "@/pages/Blog";
import BlogDetailPage from "@/pages/BlogDetail";
import FaqsPage from "@/pages/Faqs";
import FleetRegistryPage from "@/pages/FleetRegistry";
import FleetServiceHistoryPage from "@/pages/FleetServiceHistory";
import FleetArmamentSheetsPage from "@/pages/FleetArmamentSheets";
import FleetBlackBoxFilesPage from "@/pages/FleetBlackBoxFiles";
import Activity from "@/pages/Activity";
import Members from "@/pages/Members";
import Groups from "@/pages/Groups";
import GroupDetail from "@/pages/GroupDetail";
import Account from "@/pages/Account";
import Submit from "@/pages/Submit";
import StoryDetail from "@/pages/StoryDetail";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";

// =========================================================================
// Public page catalog — the SINGLE source of truth for public routes.
//
// Adding a page here automatically:
//   1. registers its route (main.tsx renders PUBLIC_ROUTES), and
//   2. adds it to the operator Appearance console (page backgrounds).
//
// `appearance` controls the second part:
//   - omit it (default) → the page gets its own background slot in the
//     Appearance console. Use this for section-level pages.
//   - `appearance: false` → detail/utility pages that inherit their
//     section's background (e.g. "/stories/:slug" inherits "/stories") and
//     are therefore not restyle-able on their own.
// =========================================================================

export type PublicPageRoute = {
  path: string;
  label: string;
  element: ReactElement;
  /** When false, the page is routed but gets no Appearance background slot. */
  appearance?: boolean;
};

export const PUBLIC_ROUTES: PublicPageRoute[] = [
  // ---- Landing & content -------------------------------------------------
  { path: "/", label: "Home", element: <Home /> },
  { path: "/stories", label: "Stories", element: <Stories /> },
  { path: "/stories/:slug", label: "Story", element: <StoryDetail />, appearance: false },
  { path: "/lore", label: "Lore", element: <Lore /> },
  { path: "/lore/:slug", label: "Lore entry", element: <LoreDetail />, appearance: false },
  { path: "/lore/databases/:slug", label: "Lore database", element: <LoreDatabase />, appearance: false },
  { path: "/lore/submit", label: "Lore submission", element: <LoreSubmit />, appearance: false },
  { path: "/maps", label: "Maps", element: <Maps /> },
  { path: "/map", label: "Star Atlas", element: <StarAtlas /> },
  { path: "/videos", label: "Videos", element: <Videos /> },
  { path: "/missions", label: "Missions", element: <Missions /> },
  { path: "/missions/:slug", label: "Mission", element: <MissionDetail />, appearance: false },
  { path: "/vault", label: "Signal Vault", element: <SignalVault /> },
  { path: "/events", label: "Events", element: <Events /> },
  { path: "/contests", label: "Contests", element: <Contests /> },
  { path: "/contests/:slug", label: "Contest", element: <ContestDetail />, appearance: false },
  { path: "/leaderboard", label: "Leaderboard", element: <Leaderboard /> },
  { path: "/changelog", label: "Changelog", element: <Changelog /> },
  { path: "/blog", label: "Blog", element: <BlogPage /> },
  { path: "/blog/:slug", label: "Blog post", element: <BlogDetailPage />, appearance: false },
  { path: "/faqs", label: "FAQs", element: <FaqsPage /> },

  // ---- Community ---------------------------------------------------------
  { path: "/community", label: "Community", element: <Community /> },
  { path: "/forums", label: "Forums", element: <Forums /> },
  { path: "/groups", label: "Groups", element: <Groups /> },
  { path: "/groups/:slug", label: "Group", element: <GroupDetail />, appearance: false },
  { path: "/members", label: "Members", element: <Members /> },
  { path: "/activity", label: "Activity", element: <Activity /> },
  { path: "/messages", label: "Messages", element: <Messages /> },
  { path: "/u/:id", label: "Profile", element: <Profile />, appearance: false },

  // ---- Member tools ------------------------------------------------------
  { path: "/submit", label: "Submit", element: <Submit /> },
  { path: "/resources", label: "Resources", element: <Resources /> },
  { path: "/fleet-registry", label: "Fleet Registry", element: <FleetRegistryPage /> },
  {
    path: "/fleet-registry/service-histories",
    label: "Service histories",
    element: <FleetServiceHistoryPage />,
    appearance: false,
  },
  {
    path: "/fleet-registry/armament-sheets",
    label: "Armament sheets",
    element: <FleetArmamentSheetsPage />,
    appearance: false,
  },
  {
    path: "/fleet-registry/black-box-files",
    label: "Black-box files",
    element: <FleetBlackBoxFilesPage />,
    appearance: false,
  },
  { path: "/membership", label: "Membership", element: <Membership /> },
  { path: "/support", label: "Support", element: <Support /> },
  { path: "/search", label: "Search", element: <SearchPage /> },
  { path: "/tools/assistant", label: "Tools Assistant", element: <ToolsAssistant /> },
  { path: "/account", label: "Account", element: <Account /> },

  // ---- Utility (routed, no background slot) ------------------------------
  { path: "/auth", label: "Sign in", element: <AuthPage redirectAfterAuth="/account" />, appearance: false },
  { path: "/embed/story/:slug", label: "Embedded story", element: <EmbedStory />, appearance: false },
  { path: "/privacy", label: "Privacy", element: <Privacy /> },
  { path: "/terms", label: "Terms", element: <Terms /> },
];