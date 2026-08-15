"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  translate,
  translateError,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";
import { parseRules, type GameRules } from "@/lib/rules";
import { getSettings, updateSettings } from "@/lib/settings";

type Vars = Record<string, string | number>;

interface AppContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  rules: GameRules;
  setRules: (rules: GameRules) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  te: (message: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === "undefined" ? "en" : getSettings().locale,
  );
  const [rules, setRulesState] = useState<GameRules>(() =>
    typeof window === "undefined" ? parseRules(undefined) : getSettings().rules,
  );

  useEffect(() => {
    const apply = () => {
      const next = getSettings();
      setLocaleState(next.locale);
      setRulesState(next.rules);
      document.documentElement.lang = next.locale;
    };
    apply();
    window.addEventListener("tienlen-settings", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("tienlen-settings", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    updateSettings({ locale: next });
  }, []);

  const setRules = useCallback((next: GameRules) => {
    updateSettings({ rules: parseRules(next) });
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => translate(locale, key, vars),
    [locale],
  );
  const te = useCallback(
    (message: string) => translateError(locale, message),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, rules, setRules, t, te }),
    [locale, setLocale, rules, setRules, t, te],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within AppProviders");
  }
  return ctx;
}
