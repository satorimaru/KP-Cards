"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { ChipStake } from "@/components/ChipStake";
import { ModePicker } from "@/components/ModePicker";
import { ScreenShell } from "@/components/ScreenShell";
import { SettingsSheet } from "@/components/SettingsSheet";
import { revealField, useClientMounted } from "@/lib/client";
import { createRoomRequest, postRoom } from "@/lib/rooms/client";
import {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
} from "@/lib/player";

export default function TienLenHomePage() {
  const router = useRouter();
  const mounted = useClientMounted();
  const { t, te, rules, setRules } = useApp();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? (mounted ? getPlayerName() : "");
  const [joinCode, setJoinCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [bots, setBots] = useState<1 | 2 | 3>(2);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const createRoom = async () => {
    setCreating(true);
    setError(null);
    setPlayerName(name);
    try {
      const room = await createRoomRequest({
        playerId: getOrCreatePlayerId(),
        playerName: name || "Host",
        maxPlayers,
        rules,
      });
      router.push(`/tienlen/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : t("err.createFailed"));
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError(t("home.enterCode"));
      return;
    }
    setJoining(true);
    setError(null);
    setPlayerName(name);
    try {
      const room = await postRoom(code, {
        action: "join",
        playerId: getOrCreatePlayerId(),
        playerName: name || "Guest",
      });
      if (!room) throw new Error(t("err.joinFailed"));
      router.push(`/tienlen/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : t("err.joinFailed"));
      setJoining(false);
    }
  };

  return (
    <ScreenShell
      backHref="/"
      backLabel={t("nav.games")}
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
          {t("meta.tagline")}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.75rem] leading-none tracking-tight">
          Tiến Lên
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--mute)]">
          {t("meta.blurb")}
        </p>
      </header>

      <section className="glass-panel rounded-[1.75rem] p-5">
        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("home.name")}
        </label>
        <input
          value={name}
          onChange={(e) => setNameDraft(e.target.value)}
          maxLength={24}
          placeholder={t("home.namePlaceholder")}
          className="field mb-5"
        />

        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("settings.modes")}
        </label>
        <div className="mb-5">
          <ModePicker
            rules={rules}
            onChange={(next) => {
              setRules(next);
              if (next.siege) {
                setMaxPlayers(4);
                setBots(3);
              }
            }}
          />
          <ChipStake rules={rules} onChange={setRules} />
        </div>

        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("home.bots")}
        </label>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              disabled={rules.siege && n !== 3}
              onClick={() => setBots(n)}
              className={[
                "min-h-12 rounded-xl text-sm font-semibold",
                bots === n
                  ? "bg-[var(--gold)] text-[#1a1408]"
                  : "bg-black/25 text-[var(--mute)]",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setPlayerName(name);
            router.push(`/tienlen/solo?bots=${rules.siege ? 3 : bots}`);
          }}
          className="btn-gold mb-5 w-full touch-manipulation"
        >
          {t("home.dealVsBots", {
            n: bots,
            bots: bots === 1 ? t("home.bot") : t("home.botsWord"),
          })}
        </button>

        <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[var(--mute)]">
          <span className="h-px flex-1 bg-[rgba(244,234,216,0.1)]" />
          {t("home.friends")}
          <span className="h-px flex-1 bg-[rgba(244,234,216,0.1)]" />
        </div>

        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("home.seats")}
        </label>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              disabled={rules.siege && n !== 4}
              onClick={() => setMaxPlayers(n)}
              className={[
                "min-h-12 rounded-xl text-sm font-semibold",
                maxPlayers === n
                  ? "bg-[var(--gold)] text-[#1a1408]"
                  : "bg-black/25 text-[var(--mute)]",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={() => void createRoom()}
          className="btn-ghost mb-5 w-full touch-manipulation"
        >
          {creating ? t("home.creating") : t("home.create")}
        </button>

        <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[var(--mute)]">
          <span className="h-px flex-1 bg-[rgba(244,234,216,0.1)]" />
          {t("home.join")}
          <span className="h-px flex-1 bg-[rgba(244,234,216,0.1)]" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder={t("home.roomPlaceholder")}
            className="field min-w-0 flex-1 font-mono tracking-[0.2em]"
            onFocus={(e) => revealField(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void joinRoom();
            }}
          />
          <button
            type="button"
            disabled={joining}
            onClick={() => void joinRoom()}
            className="btn-ghost min-w-20 touch-manipulation px-4"
          >
            {joining ? "…" : t("home.sit")}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-[rgba(196,30,58,0.12)] px-3 py-2 text-sm text-[#f0b4bd]">
            {error}
          </p>
        )}
      </section>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rules={rules}
        onChangeRules={setRules}
      />
    </ScreenShell>
  );
}
