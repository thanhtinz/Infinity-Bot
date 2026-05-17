import { createContext, useContext, type ReactNode } from "react";
import type { TranslationKey } from "./en";
import en from "./en";

interface I18nCtx {
  lang: "en";
  setLang: (l: string) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => en[k] ?? k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const t = (key: TranslationKey): string => en[key] ?? key;

  return <I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
