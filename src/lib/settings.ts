import { isLocale, type Locale } from "./i18n";
import { DEFAULT_RULES, parseRules, type GameRules } from "./rules";

const KEY = "tienlen_settings";

export interface AppSettings {
  locale: Locale;
  rules: GameRules;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "en",
  rules: { ...DEFAULT_RULES },
};

function parseSettings(raw: unknown): AppSettings {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    locale: isLocale(data.locale) ? data.locale : "en",
    rules: parseRules(data.rules),
  };
}

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return parseSettings(JSON.parse(stored));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: AppSettings): AppSettings {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("tienlen-settings"));
  }
  return next;
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const prev = getSettings();
  return saveSettings({
    locale: patch.locale ?? prev.locale,
    rules: patch.rules ? parseRules(patch.rules) : prev.rules,
  });
}
