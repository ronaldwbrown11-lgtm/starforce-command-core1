import { useAuth } from "@/hooks/use-auth";
import { Navigate, useLocation } from "react-router";

const OPERATOR_ROLES = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
  "community_moderator",
] as const;

export function OperatorGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Still resolving auth state — show a compact clearance check while loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--uf-cyan)] border-t-transparent"
        />
        <div className="animate-pulse text-muted-foreground text-sm">
          Verifying clearance…
        </div>
      </div>
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

  // Signed in but no operator role — bounce to home
  const hasOpRole =
    user?.opRole && OPERATOR_ROLES.includes(user.opRole as (typeof OPERATOR_ROLES)[number]);
  if (!hasOpRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
