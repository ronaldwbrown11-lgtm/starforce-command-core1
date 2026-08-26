import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Menu, Search, Shield, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { LOCALES, useI18n } from "@/lib/i18n";
import { NeonButton } from "./NeonButton";
import { HeaderNotifications } from "@/components/notifications/HeaderNotifications";
import { ParallaxBackground } from "./ParallaxBackground";
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

const NAV = [
  { labelKey: "nav.stories", href: "/stories" },
  { labelKey: "nav.lore", href: "/lore" },
  { labelKey: "nav.maps", href: "/maps" },
  { labelKey: "nav.starAtlas", href: "/map" },
  { labelKey: "nav.videos", href: "/videos" },
  { labelKey: "nav.missions", href: "/missions" },
  { labelKey: "nav.aiAssistant", href: "/tools/assistant" },
  { labelKey: "nav.vault", href: "/vault" },
  { labelKey: "nav.events", href: "/events" },
  { labelKey: "nav.community", href: "/community" },
  { labelKey: "nav.forums", href: "/forums" },
  { labelKey: "nav.members", href: "/members" },
  { labelKey: "nav.leaderboard", href: "/leaderboard" },
  { labelKey: "nav.submit", href: "/submit" },
  { labelKey: "nav.messages", href: "/messages" },
  { labelKey: "nav.blog", href: "/blog" },
  { labelKey: "nav.faqs", href: "/faqs" },
  { labelKey: "nav.changelog", href: "/changelog" },
  { labelKey: "nav.resources", href: "/resources" },
  { labelKey: "nav.membership", href: "/membership" },
  { labelKey: "nav.support", href: "/support" },
];

export function SiteShell({
  children,
  hideNav = false,
  bgPalette = "cyan-violet",
  cinematic = true,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
  bgPalette?: "cyan-violet" | "amber-magenta" | "emerald-cyan" | "sapphire" | "magenta-gold" | "void";
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

  return (
    <div className="uf-theme min-h-screen flex flex-col relative">
      {!hideNav ? (
        pageBackground?.url ? (
          <PageBackgroundImage url={pageBackground.url} />
        ) : (
          <ParallaxBackground palette={bgPalette} intensity="medium" />
        )
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
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
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
        <nav aria-label="Primary" className="hidden lg:flex gap-1 ml-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "px-3 py-2 rounded-md text-sm tracking-[0.08em] uppercase font-medium",
                  "text-uf-text hover:text-uf-text",
                  isActive
                    ? "bg-[rgba(0,229,255,0.10)] shadow-[var(--uf-glow-cyan)]"
                    : "hover:bg-[rgba(0,229,255,0.06)]",
                )
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
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
          <nav aria-label="Primary mobile" className="flex flex-col gap-2">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-2 rounded-md text-sm uppercase tracking-[0.08em]",
                    isActive
                      ? "bg-[rgba(0,229,255,0.10)] text-uf-text"
                      : "text-uf-muted",
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
            <NavLink
              to="/search"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-md text-sm uppercase tracking-[0.08em] text-uf-muted flex items-center gap-2"
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

function Footer() {
  const { t, locale, setLocale } = useI18n();
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
          <p className="mt-3">© Star Force Base 1198</p>
        </div>
      </div>
    </footer>
  );
}
