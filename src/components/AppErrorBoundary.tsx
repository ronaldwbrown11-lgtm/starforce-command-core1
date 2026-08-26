import { Component, type ReactNode } from "react";

type State = { error: Error | null; autoReloaded: boolean };

/**
 * Global error boundary. If anything in the app throws (including a failed
 * module fetch or a runtime crash), show a recovery screen instead of a blank
 * page, and attempt one automatic reload so transient connection drops heal
 * themselves. After that, the reload button stays available.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null, autoReloaded: false };
  private timer: number | undefined;

  static getDerivedStateFromError(error: Error): State {
    return { error, autoReloaded: false };
  }

  componentDidCatch(error: Error) {
    // Keep the real error visible in the console for debugging.
    console.error("App crashed:", error);
  }

  componentDidUpdate(_prevProps: { children: ReactNode }, prevState: State) {
    // One automatic recovery attempt per crash.
    if (this.state.error && !prevState.error && !this.state.autoReloaded) {
      this.timer = window.setTimeout(() => {
        this.setState({ autoReloaded: true });
        window.location.reload();
      }, 3000);
    }
  }

  componentWillUnmount() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="uf-theme"
        style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            textAlign: "center",
            padding: "2.5rem",
            borderRadius: 16,
            border: "1px solid rgba(0,229,255,0.28)",
            background: "rgba(16,24,39,0.72)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            backdropFilter: "blur(18px)",
          }}
        >
          <p className="uf-eyebrow" style={{ margin: 0 }}>Star Force 1198 · Link lost</p>
          <h1 style={{ fontSize: "1.8rem", margin: "0.75rem 0 0.5rem" }}>
            Connection interrupted
          </h1>
          <p style={{ color: "#A9BBDD", fontSize: "0.95rem", lineHeight: 1.6, margin: 0 }}>
            The app hit a snag while loading. Retrying automatically…
            if this screen persists, hit the reload button below.
          </p>
          {this.state.error.message ? (
            <pre
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                borderRadius: 8,
                background: "rgba(255,77,109,0.08)",
                border: "1px solid rgba(255,77,109,0.35)",
                color: "#FFB3C1",
                fontSize: "0.75rem",
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(180deg, #00E5FF, #0099CC)",
              color: "#001018",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            ⟳ Reload now
          </button>
        </div>
      </div>
    );
  }
}
