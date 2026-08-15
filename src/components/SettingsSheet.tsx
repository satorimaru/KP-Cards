"use client";

import type { GameRules } from "@/lib/rules";
import { useApp } from "./AppProviders";
import { ChipStake } from "./ChipStake";
import { LangToggle } from "./LangToggle";
import { ModePicker } from "./ModePicker";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  rules: GameRules;
  onChangeRules: (rules: GameRules) => void;
  rulesLocked?: boolean;
  /** House rules and modes are Tiến Lên-only. */
  houseRules?: boolean;
}

function RuleToggle({
  on,
  disabled,
  title,
  hint,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  title: string;
  hint: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-start justify-between gap-3 rounded-2xl bg-black/25 px-3 py-3 text-left disabled:opacity-50"
    >
      <span>
        <span className="block text-sm text-[var(--ivory)]">{title}</span>
        <span className="mt-1 block text-[11px] leading-relaxed text-[var(--mute)]">
          {hint}
        </span>
      </span>
      <span
        className={[
          "mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5",
          on ? "bg-[var(--gold)]" : "bg-black/40",
        ].join(" ")}
      >
        <span
          className={[
            "h-5 w-5 rounded-full bg-[#1a1408] transition-transform",
            on ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

export function SettingsSheet({
  open,
  onClose,
  rules,
  onChangeRules,
  rulesLocked,
  houseRules = true,
}: SettingsSheetProps) {
  const { t } = useApp();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("nav.close")}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        className="glass-panel relative z-10 flex max-h-[78dvh] flex-col overflow-y-auto rounded-t-3xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[rgba(244,234,216,0.18)]" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ivory)]">
            {t("settings.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full px-3 text-sm text-[var(--mute)]"
          >
            {t("nav.close")}
          </button>
        </div>

        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("settings.language")}
        </p>
        <div className="mb-5">
          <LangToggle />
        </div>

        {houseRules && (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
              {t("settings.modes")}
            </p>
            <div className="mb-5">
              <ModePicker
                rules={rules}
                onChange={onChangeRules}
                disabled={rulesLocked}
              />
              <ChipStake
                rules={rules}
                onChange={onChangeRules}
                disabled={rulesLocked}
              />
            </div>

            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
              {t("settings.rules")}
            </p>
            <div className="space-y-2">
              <RuleToggle
                on={rules.threePlayerSeventeen}
                disabled={rulesLocked}
                title={t("settings.seventeen")}
                hint={t("settings.seventeenHint")}
                onToggle={() =>
                  onChangeRules({
                    ...rules,
                    threePlayerSeventeen: !rules.threePlayerSeventeen,
                  })
                }
              />
              <RuleToggle
                on={rules.noFinishOnTwo}
                disabled={rulesLocked}
                title={t("settings.noTwo")}
                hint={t("settings.noTwoHint")}
                onToggle={() =>
                  onChangeRules({
                    ...rules,
                    noFinishOnTwo: !rules.noFinishOnTwo,
                  })
                }
              />
              <RuleToggle
                on={rules.playAfterPass}
                disabled={rulesLocked}
                title={t("settings.playAfterPass")}
                hint={t("settings.playAfterPassHint")}
                onToggle={() =>
                  onChangeRules({
                    ...rules,
                    playAfterPass: !rules.playAfterPass,
                  })
                }
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
