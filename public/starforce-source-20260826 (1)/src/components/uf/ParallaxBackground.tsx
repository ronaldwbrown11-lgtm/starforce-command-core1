import { useRef, useState, useCallback, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type NebulaPalette =
  | "cyan-violet"
  | "amber-magenta"
  | "emerald-cyan"
  | "sapphire"
  | "magenta-gold"
  | "void";

// ---- 6 high-resolution sci-fi backgrounds (2560px–3840px wide) -----------
// Each URL is curl-verified: HTTP 200, image/jpeg, 1.1–7.0 MB.
// Sources: Wallhaven (concept art), Pexels (digital art), Unsplash (space photo).
// Real telescope photos (NASA, Hubble, Webb) were explicitly rejected —
// these are sci-fi concept art: spaceships, space stations, alien landscapes.
// Filters tuned per image: hue shifts + saturation for distinct palettes.

type ImageSource = { url: string; sciFiFilter: string; description: string };

const IMAGE_SOURCES: Record<NebulaPalette, ImageSource> = {
  "cyan-violet": {
    url: "https://w.wallhaven.cc/full/yq/wallhaven-yqgxok.jpg",
    sciFiFilter: "hue-rotate(190deg) saturate(2.2) contrast(1.25)",
    description: "Spaceship The Frontenac in deep space — 2.1 MB Wallhaven",
  },
  "amber-magenta": {
    url: "https://images.pexels.com/photos/417104/pexels-photo-417104.jpeg?w=3840&q=90",
    sciFiFilter: "hue-rotate(22deg) saturate(2.4) contrast(1.15)",
    description: "Futuristic landscape with neon atmosphere — 1.3 MB Pexels",
  },
  "emerald-cyan": {
    url: "https://images.pexels.com/photos/2387793/pexels-photo-2387793.jpeg?w=3840&q=90",
    sciFiFilter: "hue-rotate(60deg) saturate(1.9) contrast(1.1)",
    description: "Alien landscape with nebulous lighting — 1.3 MB Pexels",
  },
  sapphire: {
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=3840&q=90",
    sciFiFilter: "hue-rotate(200deg) saturate(2.0) contrast(1.2)",
    description: "Deep space galaxy rendering — 1.3 MB Unsplash",
  },
  "magenta-gold": {
    url: "https://w.wallhaven.cc/full/rd/wallhaven-rdyxdq.jpg",
    sciFiFilter: "hue-rotate(332deg) saturate(2.6) contrast(1.25)",
    description: "Retro astronaut on space station — 6.9 MB Wallhaven",
  },
  void: {
    url: "https://images.pexels.com/photos/110854/pexels-photo-110854.jpeg?w=3840&q=90",
    sciFiFilter: "grayscale(0.88) contrast(1.5) brightness(0.72)",
    description: "Space station orbiting a planetary body — 1.1 MB Pexels",
  },
};

// CSS gradient fallback per palette (shown while loading or on error)
const FALLBACK_GRADIENTS: Record<NebulaPalette, string> = {
  "cyan-violet":
    "linear-gradient(135deg, #020A1F 0%, #0F2D55 40%, #0B1A40 100%)",
  "amber-magenta":
    "linear-gradient(135deg, #1A0802 0%, #4A1A0A 40%, #2A0A18 100%)",
  "emerald-cyan":
    "linear-gradient(135deg, #021A12 0%, #0A3D2A 40%, #021A20 100%)",
  sapphire:
    "linear-gradient(135deg, #020A20 0%, #0F2A55 40%, #081830 100%)",
  "magenta-gold":
    "linear-gradient(135deg, #1A0518 0%, #4A0A38 40%, #1A0A02 100%)",
  void:
    "linear-gradient(135deg, #020408 0%, #0A0F18 40%, #040810 100%)",
};

const INTENSITY_SPEEDS = {
  low: { layer1: 8, layer2: 18, layer3: 32 },
  medium: { layer1: 16, layer2: 32, layer3: 55 },
  high: { layer1: 24, layer2: 50, layer3: 80 },
};

// Accent colors per palette — used for particles and nebula blobs
const PALETTE_ACCENTS: Record<NebulaPalette, string> = {
  "cyan-violet": "#00E5FF",
  "amber-magenta": "#E6A817",
  "emerald-cyan": "#2DFF88",
  sapphire: "#1E88E5",
  "magenta-gold": "#FF3DF2",
  void: "#8899AA",
};

// ---- Particle system -------------------------------------------------------
// Deterministic particle positions seeded per palette, so they don't shift
// on re-renders but each palette gets a unique arrangement.

type Particle = { x: number; y: number; size: number; speed: number; opacity: number; delay: number };

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTICLE_SEEDS: Record<NebulaPalette, number> = {
  "cyan-violet": 91,
  "amber-magenta": 173,
  "emerald-cyan": 59,
  sapphire: 37,
  "magenta-gold": 281,
  void: 149,
};

const PARTICLE_COUNT = 35;

const particleCache = new Map<NebulaPalette, Particle[]>();
function getParticles(palette: NebulaPalette): Particle[] {
  if (particleCache.has(palette)) return particleCache.get(palette)!;
  const rng = mulberry32(PARTICLE_SEEDS[palette]);
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: rng() * 100,           // vw %
      y: 100 + rng() * 20,      // start below viewport
      size: 1 + rng() * 3,
      speed: 12 + rng() * 18,   // seconds to traverse
      opacity: 0.08 + rng() * 0.22,
      delay: rng() * 10,
    });
  }
  particleCache.set(palette, particles);
  return particles;
}

// Nebula glow blob definitions — two large blobs per palette
const NEBULA_BLOBS: Record<NebulaPalette, { cx: number; cy: number; rx: number; ry: number; opacity: number; rotate: number }[]> = {
  "cyan-violet": [
    { cx: 20, cy: 30, rx: 45, ry: 30, opacity: 0.04, rotate: -12 },
    { cx: 75, cy: 70, rx: 50, ry: 25, opacity: 0.03, rotate: 18 },
  ],
  "amber-magenta": [
    { cx: 80, cy: 25, rx: 40, ry: 35, opacity: 0.05, rotate: 22 },
    { cx: 30, cy: 65, rx: 55, ry: 28, opacity: 0.04, rotate: -8 },
  ],
  "emerald-cyan": [
    { cx: 15, cy: 40, rx: 48, ry: 32, opacity: 0.04, rotate: -15 },
    { cx: 70, cy: 75, rx: 42, ry: 30, opacity: 0.03, rotate: 10 },
  ],
  sapphire: [
    { cx: 25, cy: 20, rx: 50, ry: 28, opacity: 0.04, rotate: -20 },
    { cx: 65, cy: 60, rx: 45, ry: 35, opacity: 0.03, rotate: 25 },
  ],
  "magenta-gold": [
    { cx: 70, cy: 35, rx: 42, ry: 38, opacity: 0.05, rotate: 15 },
    { cx: 20, cy: 70, rx: 48, ry: 28, opacity: 0.04, rotate: -10 },
  ],
  void: [
    { cx: 50, cy: 45, rx: 35, ry: 22, opacity: 0.03, rotate: 0 },
    { cx: 85, cy: 15, rx: 30, ry: 20, opacity: 0.02, rotate: 30 },
  ],
};

// ============================================================================

export function ParallaxBackground({
  className,
  palette = "cyan-violet",
  intensity = "medium",
}: {
  className?: string;
  palette?: NebulaPalette;
  intensity?: "low" | "medium" | "high";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const imgSource = IMAGE_SOURCES[palette];
  const imgUrl = imgSource.url;
  const sciFiFilter = imgSource.sciFiFilter;
  const fallbackGradient = FALLBACK_GRADIENTS[palette];

  // Track per-layer load state so we can fade each in gracefully
  const [farLoaded, setFarLoaded] = useState(false);
  const [midLoaded, setMidLoaded] = useState(false);
  const [nearLoaded, setNearLoaded] = useState(false);
  const [farFailed, setFarFailed] = useState(false);
  const [midFailed, setMidFailed] = useState(false);
  const [nearFailed, setNearFailed] = useState(false);

  const handleFarLoad = useCallback(() => setFarLoaded(true), []);
  const handleMidLoad = useCallback(() => setMidLoaded(true), []);
  const handleNearLoad = useCallback(() => setNearLoaded(true), []);
  const handleFarError = useCallback(() => setFarFailed(true), []);
  const handleMidError = useCallback(() => setMidFailed(true), []);
  const handleNearError = useCallback(() => setNearFailed(true), []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const speeds = INTENSITY_SPEEDS[intensity];

  const layer1Y = useTransform(scrollYProgress, [0, 1], ["0%", `-${speeds.layer1}%`]);
  const layer2Y = useTransform(scrollYProgress, [0, 1], ["0%", `-${speeds.layer2}%`]);
  const layer3Y = useTransform(scrollYProgress, [0, 1], ["0%", `-${speeds.layer3}%`]);

  const layer1Opacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 0.75, 0.45]);
  const layer2Opacity = useTransform(scrollYProgress, [0, 0.6, 1], [0.85, 0.55, 0.15]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      style={{ zIndex: 0 }}
    >
      {/* Solid fallback background always present */}
      <div className="absolute inset-0" style={{ background: fallbackGradient }} />

      {/* Layer 1 — far, slow, blurred */}
      <motion.div className="absolute inset-0" style={{ y: layer1Y, opacity: layer1Opacity }}>
        {!farFailed && (
          <img
            src={imgUrl}
            alt=""
            onLoad={handleFarLoad}
            onError={handleFarError}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{
              filter: `blur(10px) brightness(0.55) ${sciFiFilter}`,
              opacity: farLoaded ? 1 : 0,
            }}
          />
        )}
      </motion.div>

      {/* Layer 2 — mid, less blurred, offset scale */}
      <motion.div className="absolute inset-0" style={{ y: layer2Y, opacity: layer2Opacity }}>
        {!midFailed && (
          <img
            src={imgUrl}
            alt=""
            onLoad={handleMidLoad}
            onError={handleMidError}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{
              transform: "scale(1.15)",
              transformOrigin: "35% 65%",
              filter: `blur(3px) brightness(0.65) ${sciFiFilter}`,
              opacity: midLoaded ? 1 : 0,
            }}
          />
        )}
      </motion.div>

      {/* Layer 3 — near, sharp, offset scale */}
      <motion.div className="absolute inset-0" style={{ y: layer3Y }}>
        {!nearFailed && (
          <img
            src={imgUrl}
            alt=""
            onLoad={handleNearLoad}
            onError={handleNearError}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{
              transform: "scale(1.35)",
              transformOrigin: "70% 30%",
              filter: `brightness(0.75) ${sciFiFilter}`,
              opacity: nearLoaded ? 1 : 0,
            }}
          />
        )}
      </motion.div>

      {/* Ambient particle / nebula overlay */}
      <AmbientOverlay palette={palette} />

      {/* Dark vignette overlay — keeps text readable regardless of image brightness */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,8,22,0.70) 0%, rgba(5,8,22,0.35) 40%, rgba(5,8,22,0.15) 70%, rgba(5,8,22,0.40) 100%)",
        }}
      />
    </div>
  );
}

// ---- AmbientOverlay: floating particles + nebula blobs --------------------

function AmbientOverlay({ palette }: { palette: NebulaPalette }) {
  const accent = PALETTE_ACCENTS[palette];
  const particles = useMemo(() => getParticles(palette), [palette]);
  const blobs = NEBULA_BLOBS[palette];

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
      {/* Pulsing nebula glow blobs */}
      {blobs.map((blob, i) => (
        <motion.div
          key={`blob-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${blob.cx}%`,
            top: `${blob.cy}%`,
            width: `${blob.rx * 2}%`,
            height: `${blob.ry * 2}%`,
            background: `radial-gradient(ellipse at center, ${accent} 0%, transparent 70%)`,
            opacity: blob.opacity,
            transform: `translate(-50%, -50%) rotate(${blob.rotate}deg)`,
            filter: "blur(60px)",
          }}
          animate={{
            scale: [0.95, 1.08, 0.92, 1.05, 0.95],
            opacity: [blob.opacity, blob.opacity * 1.4, blob.opacity * 0.7, blob.opacity * 1.2, blob.opacity],
          }}
          transition={{
            duration: 7 + i * 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Floating particles */}
      {particles.map((p, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "-4px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: accent,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${accent}`,
          }}
          animate={{
            y: ["0vh", "-110vh"],
            x: ["0px", `${(p.x % 20) - 10}px`, `${-(p.x % 15)}px`, "0px"],
            opacity: [p.opacity, p.opacity * 1.5, p.opacity * 0.5, p.opacity],
          }}
          transition={{
            y: {
              duration: p.speed,
              repeat: Infinity,
              ease: "linear",
              delay: p.delay,
            },
            x: {
              duration: p.speed * 0.7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay,
            },
            opacity: {
              duration: p.speed * 0.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay,
            },
          }}
        />
      ))}
    </div>
  );
}
