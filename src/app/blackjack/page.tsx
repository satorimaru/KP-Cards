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
  createBjRoomRequest,
  postBjRoom,
} from "@/lib/blackjack/rooms/client";

export default function BlackjackHomePage() {
  const router = useRouter();
  const mounted = useClientMounted();
  const { t, te } = useApp();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? (mounted ? getPlayerName() : "");
  const [bots, setBots] = useState(2);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ScreenShell backHref="/" backLabel={t("nav.games")}>
      <header className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold)]">
          {t("blackjack.tagline")}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.75rem] leading-none">
          {t("blackjack.title")}
        </h1>
        <p className="mt-3 text-sm text-[var(--mute)]">{t("blackjack.blurb")}</p>
      </header>
      <section className="glass-panel rounded-[1.75rem] p-5">
        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("home.name")}
        </label>
        <input
          value={name}
          onChange={(e) => setNameDraft(e.target.value)}
          maxLength={24}
          className="field mb-5"
          placeholder={t("home.namePlaceholder")}
        />
        <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("home.bots")}
        </label>
        <div className="mb-3 grid grid-cols-6 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBots(n)}
              className={[
                "min-h-11 rounded-xl text-sm font-semibold",
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
          className="btn-gold mb-5 w-full"
          onClick={() => {
            setPlayerName(name);
            router.push(`/blackjack/solo?bots=${bots}`);
          }}
        >
          {t("blackjack.vsBots", {
            n: bots,
            bots: bots === 1 ? t("home.bot") : t("home.botsWord"),
          })}
        </button>
        <button
          type="button"
          disabled={creating}
          className="btn-ghost mb-5 w-full"
          onClick={() => {
            void (async () => {
              setCreating(true);
              setPlayerName(name);
              try {
                const room = await createBjRoomRequest({
                  playerId: getOrCreatePlayerId(),
                  playerName: name || "Host",
                });
                router.push(`/blackjack/${room.id}`);
              } catch (e) {
                setError(e instanceof Error ? te(e.message) : t("err.createFailed"));
                setCreating(false);
              }
            })();
          }}
        >
          {creating ? t("home.creating") : t("home.create")}
        </button>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder={t("home.roomPlaceholder")}
            className="field min-w-0 flex-1 font-mono tracking-[0.2em]"
            onFocus={(e) => revealField(e.currentTarget)}
          />
          <button
            type="button"
            disabled={joining}
            className="btn-ghost min-w-20 px-4"
            onClick={() => {
              const code = joinCode.trim().toUpperCase();
              if (!code) {
                setError(t("home.enterCode"));
                return;
              }
              setJoining(true);
              setPlayerName(name);
              void postBjRoom(code, {
                action: "join",
                playerId: getOrCreatePlayerId(),
                playerName: name || "Guest",
              })
                .then((room) => {
                  if (room) router.push(`/blackjack/${room.id}`);
                })
                .catch((e) => {
                  setError(e instanceof Error ? te(e.message) : t("err.joinFailed"));
                  setJoining(false);
                });
            }}
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
