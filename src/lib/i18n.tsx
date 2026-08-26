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
  "nav.maps": "Maps",
  "nav.starAtlas": "Star Atlas",
  "nav.videos": "Videos",
  "nav.missions": "Missions",
  "nav.aiAssistant": "AI Assistant",
  "nav.vault": "Signal Vault",
  "nav.events": "Events",
  "nav.community": "Community",
  "nav.forums": "Forums",
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
  "nav.home": "Home",
  "common.language": "Language",
};

const ES: Dict = {
  "nav.stories": "Historias",
  "nav.lore": "Lore",
  "nav.maps": "Mapas",
  "nav.starAtlas": "Atlas Estelar",
  "nav.videos": "Vídeos",
  "nav.missions": "Misiones",
  "nav.aiAssistant": "Asistente IA",
  "nav.vault": "Bóveda de Señales",
  "nav.events": "Eventos",
  "nav.community": "Comunidad",
  "nav.forums": "Foros",
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
  "nav.home": "Inicio",
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
