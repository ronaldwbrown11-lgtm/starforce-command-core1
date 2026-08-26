import { Link } from "react-router";
import { motion } from "framer-motion";
import { AlertTriangle, Radio, ArrowLeft } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function NotFound() {
  usePageMeta({
    title: "Signal Lost (404) — Star Force 1198",
    description:
      "This sector has not been charted. Return to Star Force Base 1198 and resume the mission.",
    noindex: true,
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#050816]">
      {/* Starfield background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,229,255,0.06) 0%, transparent 60%), " +
            "radial-gradient(ellipse at 80% 100%, rgba(139,92,246,0.05) 0%, transparent 50%)",
        }}
      />

      {/* Grid lines */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,229,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-lg"
        >
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <AlertTriangle className="h-10 w-10 text-red-400" />
              </div>
              {/* Pulse ring */}
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 0, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full border border-red-500/30"
              />
            </div>
          </motion.div>

          {/* Error code */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <span className="uf-eyebrow text-red-400/80">
              <Radio className="inline h-3 w-3 mr-1" />
              Signal Lost
            </span>
          </motion.div>

          {/* 404 */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-7xl font-bold mt-4 tracking-tight"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,229,255,0.9), rgba(139,92,246,0.8))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            404
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-uf-muted mt-4 text-lg"
          >
            This sector has not been charted. The transmission could not reach
            the requested coordinates.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-uf-muted/60 text-sm mt-2"
          >
            Possible causes: coordinates out of range, sector decommissioned, or
            signal interference.
          </motion.p>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-8"
          >
            <Link
              to="/"
              className="uf-btn uf-btn--primary inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Base
            </Link>
            <Link
              to="/map"
              className="uf-btn uf-btn--ghost inline-flex items-center gap-2"
            >
              View Star Atlas
            </Link>
          </motion.div>

          {/* Status line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="mt-10 pt-6 border-t border-[color:var(--uf-border)]"
          >
            <p className="text-uf-muted/40 text-xs font-mono">
              ERR::SECTOR_NOT_FOUND • SIGNAL_INTEGRITY: 0% • NAVIGATION:
              COMPROMISED
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
