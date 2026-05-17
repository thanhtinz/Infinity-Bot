import { createContext, useContext, type ReactNode } from "react";
import type { TranslationKey } from "./en";
import en from "./en";

interface I18nCtx {
  lang: "en";
  setLang: (l: string) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => en[k as TranslationKey] ?? k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const t = (key: string): string => en[key as TranslationKey] ?? key;

  return <I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
