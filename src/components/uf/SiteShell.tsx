import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, Compass, ExternalLink, Facebook, Github, Globe, Instagram, LayoutDashboard, Linkedin, Link as LinkIcon, LogOut, Mail, Menu, Search, Shield, Sparkles, Star, Twitch, Twitter, User, Users, Youtube, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { LOCALES, useI18n } from "@/lib/i18n";
import { NeonButton } from "./NeonButton";
import { HeaderNotifications } from "@/components/notifications/HeaderNotifications";
import { ParallaxBackground } from "./ParallaxBackground";
import { Starfield } from "./Starfield";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Categorized mega-menu navigation
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  labelKey: string;
  href: string;
  desc?: string;
  highlight?: boolean;
}
interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Archive",
    icon: BookOpen,
    items: [
      { label: "Stories", labelKey: "nav.stories", href: "/stories", desc: "Fiction & narratives" },
      { label: "Lore", labelKey: "nav.lore", href: "/lore", desc: "Universe canon" },
      { label: "Maps", labelKey: "nav.maps", href: "/maps", desc: "Sector charts" },
      { label: "Star Atlas", labelKey: "nav.starAtlas", href: "/map", desc: "Interactive galaxy" },
      { label: "Transmissions", labelKey: "nav.videos", href: "/videos", desc: "Video & audio" },
      { label: "Missions", labelKey: "nav.missions", href: "/missions", desc: "Active operations" },
      { label: "Signal Vault", labelKey: "nav.vault", href: "/vault", desc: "ARG puzzles" },
    ],
  },
  {
    label: "Community",
    icon: Users,
    items: [
      { label: "Hub", labelKey: "nav.community", href: "/community", desc: "Central command" },
      { label: "Forums", labelKey: "nav.forums", href: "/forums", desc: "Discussion threads" },
      { label: "Contests", labelKey: "nav.contests", href: "/contests", desc: "Member lore contests" },
      { label: "Members", labelKey: "nav.members", href: "/members", desc: "Fleet roster" },
      { label: "Leaderboard", labelKey: "nav.leaderboard", href: "/leaderboard", desc: "Top contributors" },
      { label: "Events", labelKey: "nav.events", href: "/events", desc: "Upcoming ops" },
      { label: "Submit", labelKey: "nav.submit", href: "/submit", desc: "File a report" },
      { label: "Messages", labelKey: "nav.messages", href: "/messages", desc: "Direct comms" },
    ],
  },
  {
    label: "Network",
    icon: Compass,
    items: [
      { label: "Blog", labelKey: "nav.blog", href: "/blog", desc: "Dispatches" },
      { label: "FAQs", labelKey: "nav.faqs", href: "/faqs", desc: "Common queries" },
      { label: "Changelog", labelKey: "nav.changelog", href: "/changelog", desc: "System updates" },
      { label: "Resources", labelKey: "nav.resources", href: "/resources", desc: "Reference files" },
    ],
  },
  {
    label: "Access",
    icon: Star,
    items: [
      { label: "Membership", labelKey: "nav.membership", href: "/membership", desc: "Join the fleet" },
      { label: "Support", labelKey: "nav.support", href: "/support", desc: "Get help" },
    ],
  },
];

const AI_TOOL: NavItem = { label: "AI Assistant", labelKey: "nav.aiAssistant", href: "/tools/assistant", desc: "Lore-powered creative AI", highlight: true };

// ---------------------------------------------------------------------------
// Mega menu dropdown (hover-triggered, keyboard-accessible)
// ---------------------------------------------------------------------------
function MegaMenuDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { t } = useI18n();
  const pathname = useLocation().pathname;
  const Icon = group.icon;

  const isActive = group.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));

  const enter = () => { clearTimeout(timeoutRef.current); setOpen(true); };
  const leave = () => { timeoutRef.current = setTimeout(() => setOpen(false), 150); };

  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm tracking-[0.08em] uppercase font-medium transition-colors",
          "text-uf-text hover:text-uf-text cursor-pointer",
          isActive
            ? "bg-[rgba(0,229,255,0.10)] shadow-[var(--uf-glow-cyan)]"
            : "hover:bg-[rgba(0,229,255,0.06)]",
        )}
        aria-expanded={open}
        aria-haspopup="true"
        onFocus={enter}
        onBlur={leave}
      >
        {group.label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50"
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          <div
            className="!rounded-xl p-4 min-w-[260px]"
            role="menu"
            style={{ background: "rgba(10, 15, 30, 0.95)", border: "1px solid rgba(0,229,255,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyan-800/40">
              <Icon className="h-4 w-4 text-cyan-400" />
              <span className="text-xs uppercase tracking-[0.16em] text-cyan-300 font-bold">{group.label}</span>
            </div>
            <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex flex-col rounded-lg px-3 py-2 transition-colors",
                      pathname === item.href
                        ? "bg-cyan-900/40 text-white"
                        : "text-gray-100 hover:bg-cyan-900/30 hover:text-white",
                    )}
                    role="menuitem"
                  >
                    <span className="text-sm font-semibold">{t(item.labelKey)}</span>
                    {item.desc && <span className="text-xs text-gray-300 mt-0.5">{item.desc}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

type PaletteName =
  | "cyan-violet"
  | "amber-magenta"
  | "emerald-cyan"
  | "sapphire"
  | "magenta-gold"
  | "void";

// Route → background palette. Each section of the site gets its own nebula
// scene so pages stop feeling like clones of one another. Exact route wins,
// then the first path segment, then the default.
const ROUTE_PALETTES: Record<string, PaletteName> = {
  "/": "cyan-violet",
  "/stories": "amber-magenta",
  "/story": "amber-magenta",
  "/submit": "amber-magenta",
  "/missions": "amber-magenta",
  "/mission": "amber-magenta",
  "/lore": "sapphire",
  "/blog": "sapphire",
  "/faqs": "sapphire",
  "/support": "sapphire",
  "/resources": "sapphire",
  "/privacy": "sapphire",
  "/terms": "sapphire",
  "/map": "emerald-cyan",
  "/maps": "emerald-cyan",
  "/discoveries": "emerald-cyan",
  "/vault": "magenta-gold",
  "/videos": "magenta-gold",
  "/community": "emerald-cyan",
  "/activity": "emerald-cyan",
  "/forums": "emerald-cyan",
  "/members": "emerald-cyan",
  "/groups": "emerald-cyan",
  "/group": "emerald-cyan",
  "/events": "emerald-cyan",
  "/messages": "emerald-cyan",
  "/profile": "emerald-cyan",
  "/u": "emerald-cyan",
  "/account": "emerald-cyan",
  "/leaderboard": "amber-magenta",
  "/changelog": "sapphire",
  "/membership": "cyan-violet",
  "/search": "cyan-violet",
  "/auth": "cyan-violet",
};

function resolveRoutePalette(pathname: string): PaletteName {
  const exact = ROUTE_PALETTES[pathname];
  if (exact) return exact;
  const segment = pathname.split("/").filter(Boolean)[0];
  if (segment) return ROUTE_PALETTES[`/${segment}`] ?? "cyan-violet";
  return "cyan-violet";
}

export function SiteShell({
  children,
  hideNav = false,
  bgPalette = "auto",
  cinematic = true,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
  /** "auto" picks a palette per route; pass a specific name to force one. */
  bgPalette?: PaletteName | "auto";
  /** Enable cinematic lighting overlays (lens flare, rim light, vignette) */
  cinematic?: boolean;
}) {
  const { pathname } = useLocation();
  const { t, locale, setLocale } = useI18n();
  const appearance = useQuery(api.siteAppearance.getAppearance);

  // Operator-configured page background: exact route wins, then the section
  // (first path segment) so detail pages inherit e.g. "/stories".
  const pageBackground = useMemo(() => {
    if (!appearance) return null;
    const exact = appearance.pageBackgrounds[pathname];
    if (exact) return exact;
    const segment = pathname.split("/").filter(Boolean)[0];
    if (segment) return appearance.pageBackgrounds[`/${segment}`] ?? null;
    return null;
  }, [appearance, pathname]);

  // bgPalette="auto" (the default) resolves per route for visual variety;
  // an explicit palette prop or an operator-uploaded image always wins.
  const resolvedPalette = bgPalette === "auto" ? resolveRoutePalette(pathname) : bgPalette;

  return (
    <div className="uf-theme min-h-screen flex flex-col relative">
      {!hideNav ? (
        pageBackground?.url ? (
          <PageBackgroundImage url={pageBackground.url} />
        ) : (
          <ParallaxBackground palette={resolvedPalette} intensity="medium" />
        )
      ) : null}
      {/* Persistent low-density star layer — no wash so it doesn't mute the nebula */}
      {!hideNav ? (
        <Starfield
          className="pointer-events-none absolute inset-0 z-[1]"
          density="low"
          hue="mixed"
          wash={false}
        />
      ) : null}
      {cinematic && !hideNav && <CinematicOverlay />}
      {!hideNav ? <Header /> : null}
      <main id="uf-main" className="flex-1 relative z-10">
        {children}
      </main>
      {!hideNav ? <Footer /> : null}
    </div>
  );
}

/**
 * Operator-uploaded page background — fixed full-screen image with a dark
 * readability overlay, matching the vibe of the default parallax layers.
 */
function PageBackgroundImage({ url }: { url: string }) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <img
        src={url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "brightness(0.6) saturate(1.1)" }}
      />
      {/* Readability vignette — keeps text legible over any uploaded art */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,8,22,0.74) 0%, rgba(5,8,22,0.42) 40%, rgba(5,8,22,0.16) 70%, rgba(5,8,22,0.48) 100%)",
        }}
      />
    </div>
  );
}

/**
 * Cinematic lighting overlay — lens flare top-left, rim light bottom-right,
 * vignette darkening, and subtle scanlines.
 */
function CinematicOverlay() {
  return (
    <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      {/* Top-left lens flare */}
      <div className="uf-lens-flare" />
      {/* Bottom-right rim light */}
      <div className="uf-rim-light" />
      {/* Vignette */}
      <div className="uf-vignette" />
      {/* Subtle scanlines */}
      <div className="uf-scanlines" />
    </div>
  );
}

const OP_ROLES = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
  "community_moderator",
] as const;

function Header() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut } = useAuth();
  const isOperator = user?.opRole && OP_ROLES.includes(user.opRole as (typeof OP_ROLES)[number]);
  const displayName = user?.displayName?.trim() || user?.email?.split("@")[0] || "Operator";
  const initials = displayName.charAt(0).toUpperCase();
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate("/");
    } catch {
      setSigningOut(false);
    }
  };
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 backdrop-blur-md border-b border-[color:var(--uf-border)]"
      style={{ background: "linear-gradient(180deg, rgba(5,8,22,0.85), rgba(5,8,22,0.55))" }}
    >
      <div className="uf-container flex items-center gap-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-[0.18em] uppercase text-base">
          <span
            aria-hidden
            className="inline-block h-7 w-7 rounded-md"
            style={{
              background:
                "conic-gradient(from 220deg, var(--uf-cyan), var(--uf-violet), var(--uf-magenta), var(--uf-cyan))",
              boxShadow: "0 0 18px rgba(0,229,255,0.35)",
            }}
          />
          <span className="hidden sm:inline">Star Force 1198</span>
        </Link>
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 ml-auto">
          {NAV_GROUPS.map((group) => (
            <MegaMenuDropdown key={group.label} group={group} />
          ))}
          <Link
            to={AI_TOOL.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm tracking-[0.08em] uppercase font-medium transition-colors",
              "text-uf-cyan hover:text-uf-cyan",
              pathname === AI_TOOL.href
                ? "bg-[rgba(0,229,255,0.15)] shadow-[var(--uf-glow-cyan)]"
                : "hover:bg-[rgba(0,229,255,0.08)]",
            )}
          >
            <Sparkles className="h-4 w-4" />
            {AI_TOOL.label}
          </Link>
        </nav>
        <form
          role="search"
          onSubmit={submitSearch}
          className="hidden md:flex items-center gap-2 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-3 py-2 focus-within:border-[rgba(0,229,255,0.5)] focus-within:shadow-[var(--uf-glow-cyan)] transition-shadow"
        >
          <Search className="h-4 w-4 text-uf-muted shrink-0" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search the network"
            placeholder="Search…"
            className="w-32 lg:w-44 bg-transparent text-sm placeholder:text-uf-muted/70 focus:outline-none"
          />
        </form>
        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <Link
            to="/search"
            aria-label="Search the network"
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md border border-[color:var(--uf-border)] text-uf-text hover:bg-[rgba(0,229,255,0.08)]"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>
          {isAuthenticated ? <HeaderNotifications /> : null}
          {isOperator ? (
            <Link to="/operator" aria-label="Open operator console">
              <NeonButton variant="ghost">
                <Shield className="h-4 w-4 mr-1" aria-hidden />
                Console
              </NeonButton>
            </Link>
          ) : null}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-2 h-10 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] pl-1.5 pr-3 text-sm text-uf-text transition-colors hover:bg-[rgba(0,229,255,0.08)]"
                  aria-label="Open your account menu"
                >
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                    style={{
                      background:
                        "conic-gradient(from 220deg, var(--uf-cyan), var(--uf-violet), var(--uf-magenta), var(--uf-cyan))",
                    }}
                  >
                    {initials}
                  </span>
                  <span className="hidden max-w-28 truncate sm:inline">{displayName}</span>
                  <ChevronDown className="h-4 w-4 text-uf-muted" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="truncate">
                  {user?.email ?? "Signed in"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/activity")} className="cursor-pointer">
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Command Center
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/account")} className="cursor-pointer">
                  <User className="h-4 w-4" aria-hidden />
                  My Account
                </DropdownMenuItem>
                {isOperator ? (
                  <DropdownMenuItem onClick={() => navigate("/operator")} className="cursor-pointer">
                    <Shield className="h-4 w-4" aria-hidden />
                    Operator Console
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onClick={handleSignOut}
                  className="cursor-pointer"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" aria-label="Sign in to Star Force Base">
              <NeonButton variant="primary">Sign in</NeonButton>
            </Link>
          )}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-md border border-[color:var(--uf-border)] text-uf-text"
            aria-label="Open command nav"
            aria-expanded={open}
            aria-controls="uf-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <aside
          id="uf-mobile-nav"
          role="dialog"
          aria-label="Mobile command nav"
          className="lg:hidden border-t border-[color:var(--uf-border)] bg-[color:var(--uf-panel)] px-4 py-4"
        >
          <nav aria-label="Primary mobile" className="flex flex-col gap-3">
            {NAV_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.label}>
                  <div className="flex items-center gap-2 px-3 mb-1">
                    <Icon className="h-3.5 w-3.5 text-uf-cyan" />
                    <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-300 font-semibold">{group.label}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "px-3 py-2 rounded-md text-sm",
                            isActive
                              ? "bg-[rgba(0,229,255,0.10)] text-uf-text"
                              : "text-uf-muted",
                          )}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="border-t border-[color:var(--uf-border)] pt-2">
              <Link
                to={AI_TOOL.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm text-uf-cyan flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {AI_TOOL.label}
              </Link>
            </div>
            <NavLink
              to="/search"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-md text-sm text-uf-muted flex items-center gap-2"
            >
              <Search className="h-4 w-4" aria-hidden />
              Search the network
            </NavLink>
            <div className="mt-3 flex flex-col gap-2">
              {isOperator ? (
                <Link to="/operator" className="flex-1" onClick={() => setOpen(false)}>
                  <NeonButton variant="ghost" className="w-full">
                    <Shield className="h-4 w-4 mr-1" aria-hidden />
                    Operator Console
                  </NeonButton>
                </Link>
              ) : null}
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <Link to="/activity" onClick={() => setOpen(false)}>
                    <NeonButton variant="primary" className="w-full">Enter Command</NeonButton>
                  </Link>
                  <NeonButton
                    variant="danger"
                    loading={signingOut}
                    className="w-full"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-1" aria-hidden />
                    Sign out
                  </NeonButton>
                </div>
              ) : (
                <Link to="/auth" className="flex-1" onClick={() => setOpen(false)}>
                  <NeonButton variant="primary" className="w-full">Sign in</NeonButton>
                </Link>
              )}
            </div>
          </nav>
        </aside>
      ) : null}
    </header>
  );
}

/** Discord glyph (simple-icons path, fill follows text color). */
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function Footer() {
  const { t, locale, setLocale } = useI18n();
  const socialLinks = useQuery(api.socialLinks.list);
  return (
    <footer
      role="contentinfo"
      className="mt-20 border-t border-[color:var(--uf-border)] text-uf-muted text-sm relative z-10"
      style={{ background: "linear-gradient(180deg, transparent, rgba(0,229,255,0.04))" }}
    >
      <div className="uf-container py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-semibold tracking-[0.18em] uppercase text-uf-text">
            <Shield className="h-5 w-5" style={{ color: "var(--uf-cyan)" }} />
            Star Force 1198
          </div>
          <p className="mt-3 text-uf-muted max-w-xs">
            A working command center for story, lore, and the people who keep the
            galaxy alive.
          </p>
        </div>
        <div>
          <p className="text-uf-text uppercase tracking-[0.16em] text-xs mb-3">Archive</p>
          <ul className="space-y-2">
            <li><Link to="/stories">Stories</Link></li>
            <li><Link to="/lore">Lore</Link></li>
            <li><Link to="/maps">Maps</Link></li>
            <li><Link to="/map">Star Atlas</Link></li>
            <li><Link to="/videos">Transmissions</Link></li>
            <li><Link to="/missions">Missions</Link></li>
            <li><Link to="/vault">Signal Vault</Link></li>
            <li><Link to="/events">Events</Link></li>
            <li><Link to="/resources">Resources</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-uf-text uppercase tracking-[0.16em] text-xs mb-3">Community</p>
          <ul className="space-y-2">
            <li><Link to="/community">Hub</Link></li>
            <li><Link to="/forums">Forums</Link></li>
            <li><Link to="/groups">Groups</Link></li>
            <li><Link to="/membership">Membership</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-uf-text uppercase tracking-[0.16em] text-xs mb-3">System</p>
          <p>System status: <span className="text-uf-green">Operational</span></p>
          <p>Build 1198.1</p>
          <ul className="mt-3 space-y-2">
            <li><Link to="/search">Search</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/terms">Terms of Service</Link></li>
          </ul>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.16em] text-uf-muted mb-2">
              {t("common.language")}
            </p>
            <div className="flex gap-1.5" role="group" aria-label="Language">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  aria-pressed={locale === l}
                  className={`rounded-full border px-2.5 py-1 text-xs uppercase transition-colors ${
                    locale === l
                      ? "border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.1)] text-uf-text"
                      : "border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text"
                  }`}
                >
                  {l === "en" ? "EN" : "ES"}
                </button>
              ))}
            </div>
          </div>
          {socialLinks !== undefined && socialLinks.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.16em] text-uf-muted mb-2">Follow Us</p>
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((link) => {
                  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                    twitter: Twitter, facebook: Facebook, instagram: Instagram, youtube: Youtube,
                    github: Github, linkedin: Linkedin, twitch: Twitch, globe: Globe, mail: Mail, link: LinkIcon,
                    discord: DiscordIcon,
                  };
                  const IconComp = iconMap[link.icon.toLowerCase()] ?? ExternalLink;
                  return (
                    <a key={link._id} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cyan-500/50 bg-cyan-950/30 text-gray-100 shadow-[0_0_14px_rgba(0,229,255,0.14)] hover:scale-105 hover:text-white hover:bg-[rgba(0,229,255,0.18)] transition-all"
                    >
                      <IconComp className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          <p className="mt-3">© Star Force Base 1198</p>
        </div>
      </div>
    </footer>
  );
}
