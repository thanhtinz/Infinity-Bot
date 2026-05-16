import { createContext, useContext, useState, type ReactNode } from "react";
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

function getStoredLang(): Lang {
  try {
    const v = localStorage.getItem("dashboard_lang");
    if (v === "en" || v === "vi") return v;
  } catch {}
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getStoredLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("dashboard_lang", l); } catch {}
  };

  const t = (key: TranslationKey): string =>
    TRANSLATIONS[lang][key] ?? TRANSLATIONS["en"][key] ?? key;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
