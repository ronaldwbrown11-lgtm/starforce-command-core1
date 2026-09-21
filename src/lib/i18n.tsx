import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Lightweight i18n (#34): a language provider + dictionary for the shared
// site chrome (navigation, footer, common actions). Full page-level
// translation can grow the dictionary per page over time — the hook contract
// stays the same.
export type Locale = "en" | "es";
export const LOCALES: Locale[] = ["en", "es"];

type Dict = Record<string, string>;

const EN: Dict = {
  "nav.stories": "Stories",
  "nav.lore": "Lore",
  "nav.arcs": "Lore Arcs",
  "desc.arcs": "Collaborative storylines",
  "nav.maps": "Maps",
  "nav.starAtlas": "Star Atlas",
  "nav.videos": "Videos",
  "nav.missions": "Missions",
  "nav.aiAssistant": "AI Assistant",
  "nav.vault": "Signal Vault",
  "nav.events": "Events",
  "nav.community": "Community",
  "nav.groups": "Groups",
  "nav.forums": "Forums",
  "nav.contests": "Contests",
  "nav.store": "Requisition Depot",
  "nav.members": "Members",
  "nav.leaderboard": "Leaderboard",
  "nav.submit": "Submit",
  "nav.messages": "Messages",
  "nav.blog": "Blog",
  "nav.faqs": "FAQs",
  "nav.changelog": "Changelog",
  "nav.resources": "Resources",
  "nav.membership": "Membership",
  "nav.support": "Support",
  "nav.manual": "Cadet Manual",
  "nav.home": "Home",
  "group.archive": "Archive",
  "group.community": "Community",
  "group.network": "Network",
  "group.access": "Access",
  "desc.stories": "Fiction & narratives",
  "desc.lore": "Universe canon",
  "desc.maps": "Sector charts",
  "desc.starAtlas": "Interactive galaxy",
  "desc.videos": "Video & audio",
  "desc.missions": "Active operations",
  "desc.vault": "ARG puzzles",
  "desc.community": "Central command",
  "desc.groups": "Fleets & ship formations",
  "desc.forums": "Discussion threads",
  "desc.contests": "Member lore contests",
  "desc.store": "Lore bibles & merch",
  "desc.members": "Fleet roster",
  "desc.leaderboard": "Top contributors",
  "desc.events": "Upcoming ops",
  "desc.submit": "File a report",
  "desc.messages": "Direct comms",
  "desc.blog": "Dispatches",
  "desc.faqs": "Common queries",
  "desc.changelog": "System updates",
  "desc.resources": "Reference files",
  "desc.membership": "Join the fleet",
  "desc.manual": "New recruit orientation",
  "desc.support": "Get help",
  "common.language": "Language",
};

const ES: Dict = {
  "nav.stories": "Historias",
  "nav.lore": "Lore",
  "nav.arcs": "Arcos Narrativos",
  "desc.arcs": "Tramas colaborativas",
  "nav.maps": "Mapas",
  "nav.starAtlas": "Atlas Estelar",
  "nav.videos": "Transmisiones",
  "nav.missions": "Misiones",
  "nav.aiAssistant": "Asistente IA",
  "nav.vault": "Bóveda de Señales",
  "nav.events": "Eventos",
  "nav.community": "Comunidad",
  "nav.forums": "Foros",
  "nav.groups": "Grupos",
  "nav.contests": "Concursos",
  "nav.store": "Depósito de Requisiciones",
  "nav.members": "Miembros",
  "nav.leaderboard": "Clasificación",
  "nav.submit": "Enviar",
  "nav.messages": "Mensajes",
  "nav.blog": "Blog",
  "nav.faqs": "Preguntas",
  "nav.changelog": "Registro de Cambios",
  "nav.resources": "Recursos",
  "nav.membership": "Membresía",
  "nav.support": "Soporte",
  "nav.manual": "Manual de Cadetes",
  "nav.home": "Inicio",
  "group.archive": "Archivo",
  "group.community": "Comunidad",
  "group.network": "Red",
  "group.access": "Acceso",
  "desc.stories": "Ficción y narrativas",
  "desc.lore": "Cánones del universo",
  "desc.maps": "Cartas de sectores",
  "desc.starAtlas": "Galaxia interactiva",
  "desc.videos": "Vídeo y audio",
  "desc.missions": "Operaciones activas",
  "desc.vault": "Puzles ARG",
  "desc.community": "Mando central",
  "desc.groups": "Flotas y formaciones",
  "desc.forums": "Hilos de debate",
  "desc.contests": "Concursos de lore",
  "desc.store": "Lore & mercancía",
  "desc.members": "Lista de la flota",
  "desc.leaderboard": "Mejores contribuyentes",
  "desc.events": "Próximas operaciones",
  "desc.submit": "Enviar un informe",
  "desc.messages": "Comunicaciones directas",
  "desc.blog": "Despachos",
  "desc.faqs": "Consultas comunes",
  "desc.changelog": "Actualizaciones del sistema",
  "desc.resources": "Archivos de referencia",
  "desc.membership": "Únete a la flota",
  "desc.manual": "Orientación de reclutas",
  "desc.support": "Obtener ayuda",
  "common.language": "Idioma",
};

const DICT: Record<Locale, Dict> = { en: EN, es: ES };

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem("uf-locale");
    return saved === "es" ? "es" : "en";
  });

  useEffect(() => {
    window.localStorage.setItem("uf-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);
  const t = (key: string) => DICT[locale][key] ?? DICT.en[key] ?? key;

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
