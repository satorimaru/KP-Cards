"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { MultiplayerGame } from "@/components/MultiplayerGame";
import { revealField, useClientMounted } from "@/lib/client";
import { useApp } from "@/components/AppProviders";
import {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
} from "@/lib/player";

export default function TienLenRoomPage() {
  const params = useParams();
  const roomId = String(params.roomId ?? "").toUpperCase();
  const mounted = useClientMounted();
  const playerId = mounted ? getOrCreatePlayerId() : null;
  const storedName = mounted ? getPlayerName() : "";
  const [nameDraft, setNameDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { t } = useApp();
  const playerName = nameDraft || storedName;
  const nameReady = confirmed || Boolean(storedName);

  if (!roomId) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#f0b4bd]">
        {t("game.invalid")}
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
        {t("game.loading")}
      </div>
    );
  }

  if (!nameReady) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
        <div className="glass-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--gold-dim)]">
            {t("game.joinTable")}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl">
            {roomId}
          </h1>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={24}
            placeholder={t("home.name")}
            className="field mt-5"
            onFocus={(e) => revealField(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nameDraft.trim()) {
                setPlayerName(nameDraft);
                setConfirmed(true);
              }
            }}
          />
          <button
            type="button"
            disabled={!nameDraft.trim()}
            onClick={() => {
              setPlayerName(nameDraft);
              setConfirmed(true);
            }}
            className="btn-gold mt-4 w-full"
          >
            {t("game.sitDown")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <MultiplayerGame
      roomId={roomId}
      playerId={playerId}
      playerName={playerName || "Player"}
    />
  );
}
