"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import { GameTile } from "@/components/GameTile";
import { ScreenShell } from "@/components/ScreenShell";
import { SettingsSheet } from "@/components/SettingsSheet";
import { useClientMounted } from "@/lib/client";
import { GAMES } from "@/lib/games";
import { getPlayerName, setPlayerName } from "@/lib/player";

export default function HomePage() {
  const mounted = useClientMounted();
  const { t, rules, setRules } = useApp();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const name = nameDraft ?? (mounted ? getPlayerName() : "");

  return (
    <ScreenShell
      trailing={
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="min-h-9 text-xs text-[var(--gold)]"
        >
          {t("nav.settings")}
        </button>
      }
    >
      <header className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold)]">
          KP-Cards
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.75rem] leading-none tracking-tight">
          {t("app.choose")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--mute)]">
          {t("app.blurb")}
        </p>
      </header>

      <section>
        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("home.name")}
        </label>
        <input
          value={name}
          onChange={(e) => {
            setNameDraft(e.target.value);
            setPlayerName(e.target.value);
          }}
          maxLength={24}
          placeholder={t("home.namePlaceholder")}
          className="field mb-5"
        />

        <div className="space-y-3">
          {GAMES.map((game) => (
            <GameTile key={game.id} game={game} />
          ))}
        </div>
      </section>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rules={rules}
        onChangeRules={setRules}
        houseRules={false}
      />
    </ScreenShell>
  );
}
