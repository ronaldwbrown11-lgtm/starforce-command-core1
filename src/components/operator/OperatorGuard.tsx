import { Navigate, useLocation } from "react-router";
import { SiteShell } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";

const OPERATOR_ROLES = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
  "community_moderator",
] as const;

/**
 * Route guard for operator-clearance pages rendered inside the public site
 * shell (as opposed to the /operator console). Signed-out visitors go to
 * auth with a return path; signed-in non-operators see an in-character
 * "restricted" panel instead of the page content.
 */
export function OperatorGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Still resolving auth state — show a compact clearance check while loading
  if (isLoading) {
    return (
      <SiteShell>
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
          <div
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--uf-cyan)] border-t-transparent"
          />
          <div className="animate-pulse text-muted-foreground text-sm">
            Verifying clearance…
          </div>
        </div>
      </SiteShell>
    );
  }

  // Not signed in — redirect to auth with a return path
  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Signed in but no operator role — in-character restricted panel
  const hasOpRole =
    user?.opRole && OPERATOR_ROLES.includes(user.opRole as (typeof OPERATOR_ROLES)[number]);
  if (!hasOpRole) {
    return (
      <SiteShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
          <span className="uf-eyebrow" style={{ color: "var(--uf-gold)" }}>
            Clearance denied
          </span>
          <h1 className="text-2xl font-semibold">Restricted channel</h1>
          <p className="text-uf-muted text-sm max-w-md">
            This briefing is restricted to base command. Your clearance does not
            cover this channel. If you believe you should have access, contact
            your commanding officer.
          </p>
        </div>
      </SiteShell>
    );
  }

  return <>{children}</>;
}
