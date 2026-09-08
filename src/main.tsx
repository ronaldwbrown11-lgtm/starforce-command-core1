import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import { I18nProvider } from "@/lib/i18n";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { CookieConsent } from "@/components/CookieConsent";
import "./index.css";
import "./types/global.d.ts";

// NOTE: this file was touched on 2026-08-26 to force a fresh platform
// snapshot re-sync after a persistent "Request failed with status code 404"
// build error. No functional change.

// Eager imports (no React.lazy): the whole app ships as one self-contained
// bundle, so there are no per-page dynamic module fetches that can fail when
// the dev server blips. Reliability over code-splitting.
//
// Public page routes live in the shared catalog (src/lib/pageCatalog.tsx) so
// the router and the operator Appearance console can never drift apart:
// adding a page there registers its route AND its background slot.
import { PUBLIC_ROUTES } from "./lib/pageCatalog.tsx";
import NotFound from "./pages/NotFound.tsx";

import OpDashboard from "./pages/operator/Dashboard.tsx";
import OpModeration from "./pages/operator/Moderation.tsx";
import OpReports from "./pages/operator/Reports.tsx";
import OpStories from "./pages/operator/Stories.tsx";
import OpUsers from "./pages/operator/Users.tsx";
import OpUserDetail from "./pages/operator/UserDetail.tsx";
import OpAnalytics from "./pages/operator/Analytics.tsx";
import OpHealth from "./pages/operator/Health.tsx";
import OpSessions from "./pages/operator/Sessions.tsx";
import OpLogins from "./pages/operator/Logins.tsx";
import OpIdentity from "./pages/operator/Identity.tsx";
import OpAudit from "./pages/operator/Audit.tsx";
import OpReferences from "./pages/operator/References.tsx";
import OpFeatured from "./pages/operator/Featured.tsx";
import OpTeam from "./pages/operator/Team.tsx";
import OpBlog from "./pages/operator/BlogManage.tsx";
import OpFaqs from "./pages/operator/FaqsManage.tsx";
import OpFactions from "./pages/operator/FactionsManage.tsx";
import OpGroups from "./pages/operator/GroupsManage.tsx";
import OpBilling from "./pages/operator/Billing.tsx";
import OpFleet from "./pages/operator/FleetManage.tsx";
import OpBroadcasts from "./pages/operator/Broadcasts.tsx";
import OpSupport from "./pages/operator/Support.tsx";
import OpContent from "./pages/operator/Content.tsx";
import OpLoreLibrary from "./pages/operator/LoreLibrary.tsx";
import OpDatabaseFrontend from "./pages/operator/DatabaseFrontend.tsx";
import OpSectorMap from "./pages/operator/SectorMap.tsx";
import OpDiscoveries from "./pages/operator/Discoveries.tsx";
import OpAppearance from "./pages/operator/Appearance.tsx";
import OpSocialLinks from "./pages/operator/SocialLinks.tsx";
import OpEvents from "./pages/operator/EventsManage.tsx";
import OpContests from "./pages/operator/ContestsManage.tsx";
import OpArg from "./pages/operator/ArgManage.tsx";
import OpLog from "./pages/operator/LogManage.tsx";
import OpChangelog from "./pages/operator/ChangelogManage.tsx";
import { OperatorGuard } from "./components/operator/OperatorGuard.tsx";

// This is the public Convex endpoint associated with the current Freebuff
// project. It is not a migration target and contains no secret credential.
// Freebuff overrides it with VITE_CONVEX_URL when it builds the project;
// the fallback keeps a manually uploaded Hostinger bundle connected.
const FREEBUFF_CONVEX_URL = "https://lovely-koala-228.convex.cloud";
const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim() ||
  FREEBUFF_CONVEX_URL;

function createConvexClient() {
  if (!CONVEX_URL) return null;
  try {
    // Guard against an accidentally pasted Freebuff project URL or private key
    // causing a constructor exception before React can render a recovery screen.
    const parsed = new URL(CONVEX_URL);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".convex.cloud")) {
      console.error("Invalid VITE_CONVEX_URL: expected an https://*.convex.cloud URL.");
      return null;
    }
    return new ConvexReactClient(parsed.toString().replace(/\/$/, ""));
  } catch (error) {
    console.error("Unable to initialize Convex client:", error);
    return null;
  }
}

const convex = createConvexClient();

function ConvexConfigurationNotice() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#050a14] px-6 py-16 text-center text-white">
      <section className="max-w-xl rounded-xl border border-[rgba(0,229,255,0.35)] bg-[rgba(10,22,40,0.85)] p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-[#00e5ff]">Star Force Command</p>
        <h1 className="mt-3 text-2xl font-semibold">Backend connection not configured</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          This website bundle was built without the Freebuff project&apos;s public
          Convex URL. No data was deleted, and no admin key is needed for the
          website. Rebuild this project in Freebuff, then upload that build to
          Hostinger.
        </p>
        <p className="mt-4 font-mono text-xs text-slate-400">
          Required build variable: VITE_CONVEX_URL
        </p>
      </section>
    </main>
  );
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

// Remove the static boot screen only after this module has loaded successfully.
// If the module itself fails to load, the HTML fallback remains visible instead
// of leaving visitors with a blank screen.
document.getElementById("boot-fallback")?.remove();

// PWA offline reading (progressive enhancement): register the service
// worker only in production builds — the Freebuff dev preview must never
// be intercepted. The worker caches article routes (stories/lore/map/vault)
// after successful fetches; the app shell itself is never cached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is best-effort — never block the app on it.
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InstrumentationProvider>
      <I18nProvider>
        {convex ? (
          <ConvexAuthProvider client={convex}>
            <BrowserRouter>
          <RouteSyncer />
          <AppErrorBoundary>
            <Routes>
              {/* Public routes come from the shared catalog so every page
                  automatically gets an Appearance background slot too. */}
              {PUBLIC_ROUTES.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}

              <Route path="/operator" element={<OperatorGuard><OpDashboard /></OperatorGuard>} />
              <Route path="/operator/moderation" element={<OperatorGuard><OpModeration /></OperatorGuard>} />
              <Route path="/operator/reports" element={<OperatorGuard><OpReports /></OperatorGuard>} />
              <Route path="/operator/stories" element={<OperatorGuard><OpStories /></OperatorGuard>} />
              <Route path="/operator/users" element={<OperatorGuard><OpUsers /></OperatorGuard>} />
              <Route path="/operator/users/:userId" element={<OperatorGuard><OpUserDetail /></OperatorGuard>} />
              <Route path="/operator/analytics" element={<OperatorGuard><OpAnalytics /></OperatorGuard>} />
              <Route path="/operator/health" element={<OperatorGuard><OpHealth /></OperatorGuard>} />
              <Route path="/operator/sessions" element={<OperatorGuard><OpSessions /></OperatorGuard>} />
              <Route path="/operator/logins" element={<OperatorGuard><OpLogins /></OperatorGuard>} />
              <Route path="/operator/identity" element={<OperatorGuard><OpIdentity /></OperatorGuard>} />
              <Route path="/operator/audit" element={<OperatorGuard><OpAudit /></OperatorGuard>} />
              <Route path="/operator/references" element={<OperatorGuard><OpReferences /></OperatorGuard>} />
              <Route path="/operator/featured" element={<OperatorGuard><OpFeatured /></OperatorGuard>} />
              <Route path="/operator/team" element={<OperatorGuard><OpTeam /></OperatorGuard>} />
              <Route path="/operator/blog" element={<OperatorGuard><OpBlog /></OperatorGuard>} />
              <Route path="/operator/faqs" element={<OperatorGuard><OpFaqs /></OperatorGuard>} />
              <Route path="/operator/factions" element={<OperatorGuard><OpFactions /></OperatorGuard>} />
              <Route path="/operator/groups" element={<OperatorGuard><OpGroups /></OperatorGuard>} />
              <Route path="/operator/billing" element={<OperatorGuard><OpBilling /></OperatorGuard>} />
              <Route path="/operator/fleet" element={<OperatorGuard><OpFleet /></OperatorGuard>} />
              <Route path="/operator/broadcasts" element={<OperatorGuard><OpBroadcasts /></OperatorGuard>} />
              <Route path="/operator/support" element={<OperatorGuard><OpSupport /></OperatorGuard>} />
              <Route path="/operator/content" element={<OperatorGuard><OpContent /></OperatorGuard>} />
              <Route path="/operator/lore-library" element={<OperatorGuard><OpLoreLibrary /></OperatorGuard>} />
              <Route path="/operator/lore-library/databases/:slug" element={<OperatorGuard><OpDatabaseFrontend /></OperatorGuard>} />
              <Route path="/operator/sector-map" element={<OperatorGuard><OpSectorMap /></OperatorGuard>} />
              <Route path="/operator/discoveries" element={<OperatorGuard><OpDiscoveries /></OperatorGuard>} />
              <Route path="/operator/appearance" element={<OperatorGuard><OpAppearance /></OperatorGuard>} />
              <Route path="/operator/social-links" element={<OperatorGuard><OpSocialLinks /></OperatorGuard>} />
              <Route path="/operator/events" element={<OperatorGuard><OpEvents /></OperatorGuard>} />
              <Route path="/operator/contests" element={<OperatorGuard><OpContests /></OperatorGuard>} />
              <Route path="/operator/arg" element={<OperatorGuard><OpArg /></OperatorGuard>} />
              <Route path="/operator/log" element={<OperatorGuard><OpLog /></OperatorGuard>} />
              <Route path="/operator/changelog" element={<OperatorGuard><OpChangelog /></OperatorGuard>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppErrorBoundary>
          <Toaster />
          <CookieConsent />
            </BrowserRouter>
          </ConvexAuthProvider>
        ) : (
          <ConvexConfigurationNotice />
        )}
      </I18nProvider>
    </InstrumentationProvider>
  </StrictMode>,
);
