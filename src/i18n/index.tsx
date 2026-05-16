import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import vi, { type TranslationKey } from "./vi";
import en from "./en";

type Lang = "en" | "vi";
const TRANSLATIONS: Record<Lang, Record<TranslationKey, string>> = { vi, en };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => en[k] ?? k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const stored = (typeof localStorage !== "undefined" && localStorage.getItem("dashboard_lang")) as Lang | null;
  const [lang, setLangState] = useState<Lang>(stored || "en");

  // Sync from config API
  const { data: config } = useQuery<{ language?: string }>({
    queryKey: ["config_lang"],
    queryFn: () => fetch("/api/config", { credentials: "include" }).then((r) => r.ok ? r.json() : {}),
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (config?.language === "en" || config?.language === "vi") {
      setLangState(config.language);
      localStorage.setItem("dashboard_lang", config.language);
    }
  }, [config?.language]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("dashboard_lang", l);
  };

  const t = (key: TranslationKey): string =>
    TRANSLATIONS[lang][key] ?? TRANSLATIONS["en"][key] ?? key;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
