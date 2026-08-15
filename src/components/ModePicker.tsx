"use client";

import type { MessageKey } from "@/lib/i18n";
import type { GameRules } from "@/lib/rules";
import { useApp } from "./AppProviders";

const MODES = [
  {
    key: "chaos" as const,
    title: "mode.chaos",
    hint: "mode.chaosHint",
  },
  {
    key: "blitz" as const,
    title: "mode.blitz",
    hint: "mode.blitzHint",
  },
  {
    key: "siege" as const,
    title: "mode.siege",
    hint: "mode.siegeHint",
  },
  {
    key: "uno" as const,
    title: "mode.uno",
    hint: "mode.unoHint",
  },
  {
    key: "chips" as const,
    title: "mode.chips",
    hint: "mode.chipsHint",
  },
] as const;

interface ModePickerProps {
  rules: GameRules;
  onChange: (rules: GameRules) => void;
  disabled?: boolean;
}

export function ModePicker({ rules, onChange, disabled }: ModePickerProps) {
  const { t } = useApp();

  return (
    <div className="grid grid-cols-2 gap-2">
      {MODES.map((mode) => {
        const on = rules[mode.key];
        return (
          <button
            key={mode.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...rules, [mode.key]: !on })}
            className={[
              "rounded-2xl px-3 py-2.5 text-left",
              on
                ? "bg-[rgba(212,176,106,0.16)] ring-1 ring-[var(--gold)]"
                : "bg-black/25",
              disabled ? "opacity-50" : "",
            ].join(" ")}
          >
            <p className="text-sm font-semibold text-[var(--ivory)]">
              {t(mode.title as MessageKey)}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--mute)]">
              {t(mode.hint as MessageKey)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
