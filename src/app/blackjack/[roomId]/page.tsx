"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { BlackjackMultiplayer } from "@/components/blackjack/BlackjackMultiplayer";
import { revealField, useClientMounted } from "@/lib/client";
import { useApp } from "@/components/AppProviders";
import {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
} from "@/lib/player";

export default function BlackjackRoomPage() {
  const params = useParams();
  const roomId = String(params.roomId ?? "").toUpperCase();
  const mounted = useClientMounted();
  const playerId = mounted ? getOrCreatePlayerId() : null;
  const storedName = mounted ? getPlayerName() : "";
  const [nameDraft, setNameDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { t } = useApp();
  const nameReady = confirmed || Boolean(storedName);
  const playerName = nameDraft || storedName;

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
          <h1 className="font-[family-name:var(--font-display)] text-2xl">{roomId}</h1>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={24}
            placeholder={t("home.name")}
            className="field mt-5"
            onFocus={(e) => revealField(e.currentTarget)}
          />
          <button
            type="button"
            disabled={!nameDraft.trim()}
            className="btn-gold mt-4 w-full"
            onClick={() => {
              setPlayerName(nameDraft);
              setConfirmed(true);
            }}
          >
            {t("game.sitDown")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <BlackjackMultiplayer
      roomId={roomId}
      playerId={playerId}
      playerName={playerName || "Player"}
    />
  );
}
