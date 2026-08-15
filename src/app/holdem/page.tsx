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
  createHoldemRoomRequest,
  postHoldemRoom,
} from "@/lib/holdem/rooms/client";

export default function HoldemHomePage() {
  const router = useRouter();
  const mounted = useClientMounted();
  const { t, te } = useApp();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? (mounted ? getPlayerName() : "");
  const [bots, setBots] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ScreenShell backHref="/" backLabel={t("nav.games")}>
      <header className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold)]">
          {t("holdem.tagline")}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.75rem] leading-none">
          {t("holdem.title")}
        </h1>
        <p className="mt-3 text-sm text-[var(--mute)]">{t("holdem.blurb")}</p>
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
          {t("holdem.seats")}
        </label>
        <div className="mb-3 grid grid-cols-5 gap-2">
          {([1, 2, 3, 4, 5] as const).map((n) => (
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
            router.push(`/holdem/solo?bots=${bots}`);
          }}
        >
          {t("holdem.vsBots", {
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
              setError(null);
              setPlayerName(name);
              try {
                const room = await createHoldemRoomRequest({
                  playerId: getOrCreatePlayerId(),
                  playerName: name || "Host",
                });
                router.push(`/holdem/${room.id}`);
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const code = joinCode.trim().toUpperCase();
                if (!code) return;
                setJoining(true);
                setPlayerName(name);
                void postHoldemRoom(code, {
                  action: "join",
                  playerId: getOrCreatePlayerId(),
                  playerName: name || "Guest",
                })
                  .then((room) => {
                    if (room) router.push(`/holdem/${room.id}`);
                  })
                  .catch((err) => {
                    setError(err instanceof Error ? te(err.message) : t("err.joinFailed"));
                    setJoining(false);
                  });
              }
            }}
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
              void postHoldemRoom(code, {
                action: "join",
                playerId: getOrCreatePlayerId(),
                playerName: name || "Guest",
              })
                .then((room) => {
                  if (room) router.push(`/holdem/${room.id}`);
                })
                .catch((err) => {
                  setError(err instanceof Error ? te(err.message) : t("err.joinFailed"));
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
