import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { NeonButton } from "@/components/uf/NeonButton";

const STORAGE_KEY = "uf-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl uf-panel !rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        style={{ background: "rgba(10, 15, 30, 0.95)", border: "1px solid rgba(0,229,255,0.25)", boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-100 font-medium">
            🛰️ Navigation telemetry active
          </p>
          <p className="text-xs text-gray-400 mt-1">
            We use essential cookies to keep you signed in and track your session. Optional analytics help us improve the fleet experience. No third-party tracking. Read our{" "}
            <a href="/privacy" className="text-cyan-400 underline hover:text-cyan-300">Privacy Policy</a>.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <NeonButton variant="ghost" onClick={decline} className="text-xs">
            Essential only
          </NeonButton>
          <NeonButton variant="primary" onClick={accept} className="text-xs">
            Accept all
          </NeonButton>
          <button
            type="button"
            onClick={decline}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-uf-muted hover:text-uf-text transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
