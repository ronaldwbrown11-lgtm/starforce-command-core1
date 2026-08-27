import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || "production",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    // Performance monitoring — sample 20% of transactions
    tracesSampleRate: 0.2,
    // Session replay — capture 10% of sessions, plus on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Don't report common noise
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "NetworkError",
      "ChunkLoadError",
      "Loading chunk",
    ],
  });
}
