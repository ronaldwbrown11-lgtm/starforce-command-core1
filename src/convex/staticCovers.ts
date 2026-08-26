// =========================================================================
// Static cover images — seeded imagery served from the site host
// (`public/covers/*.jpg`) instead of Convex file storage.
//
// Why: every page view used to re-download these ~0.5–1 MB images from
// Convex, which is the main driver of Convex data egress. Serving them as
// static site files moves that traffic to the web host and drops it from
// the Convex bill entirely. Pages render identically — same pixels, just a
// different URL.
//
// Precedence: for the slugs listed here the static file WINS over any
// `coverStorageId` on the row. If an operator uploads a custom replacement
// cover for one of these items via the Content Desk, also replace the
// matching file in `public/covers/` (or remove the slug from this map) so
// the upload becomes visible.
// =========================================================================

export const STATIC_IMAGES: Record<string, string> = {
  "story-signal-sol": "/covers/story-signal-sol.jpg",
  "story-outer-belt": "/covers/story-outer-belt.jpg",
  "lore-sol-system": "/covers/lore-sol-system.jpg",
  "lore-outer-belt": "/covers/lore-outer-belt.jpg",
  "lore-cmdr-singh": "/covers/lore-cmdr-singh.jpg",
  "transmission-bridge-041": "/covers/transmission-bridge-041.jpg",
  // Lore Library image plates (image is both cover and file)
  "lore-image-cosmic-cliffs": "/covers/lore-image-cosmic-cliffs.jpg",
  "lore-image-pillars": "/covers/lore-image-pillars.jpg",
};

/** Returns the static path for a row slug, or null when none is mapped. */
export function staticImageFor(slug?: string | null): string | null {
  if (!slug) return null;
  return STATIC_IMAGES[slug] ?? null;
}
