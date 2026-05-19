import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { TranslationKey } from "./en";
import en from "./en";

type Lang = "en" | "vi";

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => en[k as TranslationKey] ?? k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("dashboard_lang") as Lang | null;
    return saved === "vi" ? "vi" : "en";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("dashboard_lang", l);
  }, []);

  const t = useCallback(
    (key: string): string => en[key as TranslationKey] ?? key,
    [],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}

export function useLanguage() {
  const { lang, setLang } = useContext(I18nContext);
  return { language: lang, setLanguage: setLang };
}
