import {
  Building2, Box, Clock, Command, Crosshair, Crown, Droplets, Eclipse, Eye, Feather,
  Flame, Gem, Ghost, Landmark, Layers, Moon, MoonStar, Mountain, Orbit, Rocket, Scale,
  Shield, Sparkles, Star, Sun, Swords, Users, Waves, Weight, Wind, Zap,
} from "lucide-react";

const ICONS: Record<string, any> = {
  shield: Shield,
  crosshair: Crosshair,
  eye: Eye,
  zap: Zap,
  orbit: Orbit,
  landmark: Landmark,
  scale: Scale,
  building2: Building2,
  sun: Sun,
  star: Star,
  rocket: Rocket,
  layers: Layers,
  command: Command,
  swords: Swords,
  waves: Waves,
  ghost: Ghost,
  clock: Clock,
  weight: Weight,
  feather: Feather,
  flame: Flame,
  wind: Wind,
  gem: Gem,
  eclipse: Eclipse,
  "moon-star": MoonStar,
  mountain: Mountain,
  droplets: Droplets,
  box: Box,
  sparkles: Sparkles,
  moon: Moon,
  users: Users,
  crown: Crown,
};

export function FactionIcon({
  name,
  className = "h-4 w-4",
  accent,
}: {
  name?: string;
  className?: string;
  accent?: string;
}) {
  const Icon = (name && ICONS[name]) || Shield;
  return <Icon className={className} style={accent ? { color: accent } : undefined} aria-hidden />;
}