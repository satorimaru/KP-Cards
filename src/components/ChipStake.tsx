"use client";

import { START_CHIP_CHOICES } from "@/lib/tienlen/chips";
import type { GameRules } from "@/lib/rules";
import { useApp } from "./AppProviders";

export function ChipStake({
  rules,
  onChange,
  disabled,
}: {
  rules: GameRules;
  onChange: (rules: GameRules) => void;
  disabled?: boolean;
}) {
  const { t } = useApp();
  if (!rules.chips) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
        {t("chips.start")}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {START_CHIP_CHOICES.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...rules, startChips: n })}
            className={[
              "min-h-11 rounded-xl text-sm font-semibold tabular-nums disabled:opacity-50",
              rules.startChips === n
                ? "bg-[var(--gold)] text-[#1a1408]"
                : "bg-black/25 text-[var(--mute)]",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--mute)]">
        {t("chips.pays")}
      </p>
    </div>
  );
}
