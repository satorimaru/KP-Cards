"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { ScreenShell } from "@/components/ScreenShell";
import { revealField, useClientMounted } from "@/lib/client";
import {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
} from "@/lib/player";
import {
  createSpeedRoomRequest,
  postSpeedRoom,
} from "@/lib/speed/rooms/client";

export default function SpeedHomePage() {
  const router = useRouter();
  const mounted = useClientMounted();
  const { t, te } = useApp();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? (mounted ? getPlayerName() : "");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = async () => {
    setCreating(true);
    setError(null);
    setPlayerName(name);
    try {
      const room = await createSpeedRoomRequest({
        playerId: getOrCreatePlayerId(),
        playerName: name || "Host",
      });
      router.push(`/speed/${room.id}`);
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
      const room = await postSpeedRoom(code, {
        action: "join",
        playerId: getOrCreatePlayerId(),
        playerName: name || "Guest",
      });
      if (!room) throw new Error(t("err.joinFailed"));
      router.push(`/speed/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : t("err.joinFailed"));
      setJoining(false);
    }
  };

  return (
    <ScreenShell backHref="/" backLabel={t("nav.games")}>
      <header className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold)]">
          {t("speed.tagline")}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.75rem] leading-none tracking-tight">
          {t("speed.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--mute)]">
          {t("speed.blurb")}
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

        <button
          type="button"
          onClick={() => {
            setPlayerName(name);
            router.push("/speed/tutorial");
          }}
          className="btn-gold mb-5 w-full touch-manipulation"
        >
          {t("speed.tutorial")}
        </button>

        <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[var(--mute)]">
          <span className="h-px flex-1 bg-[rgba(244,234,216,0.1)]" />
          {t("home.friends")}
          <span className="h-px flex-1 bg-[rgba(244,234,216,0.1)]" />
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
    </ScreenShell>
  );
}
