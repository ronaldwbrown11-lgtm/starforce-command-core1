import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "path";

// Works in both Bun and Node ESM
const __dirname =
  typeof import.meta.dirname !== "undefined"
    ? import.meta.dirname
    : resolve(new URL(".", import.meta.url).pathname);

// https://vite.dev/config/
export default defineConfig({
  plugins: [vlyPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router",
      "@convex-dev/auth/react",
    ],
  },
  server: {
    // Freebuff requires HMR to remain disabled
    hmr: false,
  },
});
