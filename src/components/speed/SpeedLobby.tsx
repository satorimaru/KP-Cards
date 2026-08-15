"use client";

import { useState } from "react";
import type { SpeedRoomView } from "@/lib/speed/rooms/types";
import { useApp } from "../AppProviders";

interface SpeedLobbyProps {
  room: SpeedRoomView;
  playerId: string;
  inviteUrl: string;
  busy?: boolean;
  error?: string | null;
  onLeave: () => void;
}

export function SpeedLobby({
  room,
  playerId,
  inviteUrl,
  busy,
  error,
  onLeave,
}: SpeedLobbyProps) {
  const { t, te } = useApp();
  const [copied, setCopied] = useState(false);
  const me = room.players.find((p) => p.id === playerId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="glass-panel mx-auto w-full max-w-md rounded-[1.75rem] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--gold-dim)]">
        {t("lobby.waiting")}
      </p>
      <h1 className="mt-1 font-mono text-[2rem] tracking-[0.18em] text-[var(--ivory)]">
        {room.id}
      </h1>
      <p className="mt-1 text-sm text-[var(--mute)]">
        {t("lobby.seatedCount", { n: room.players.length, max: 2 })}
      </p>

      <div className="mt-5 flex gap-2">
        <input readOnly value={inviteUrl} className="field min-w-0 flex-1 truncate text-xs" />
        <button type="button" onClick={() => void copy()} className="btn-ghost min-w-20 px-4 text-sm">
          {copied ? t("lobby.copied") : t("lobby.copy")}
        </button>
      </div>

      <ul className="mt-5 space-y-2">
        {[0, 1].map((seat) => {
          const p = room.players.find((x) => x.seat === seat) ?? null;
          return (
            <li
              key={seat}
              className="flex items-center justify-between rounded-2xl bg-black/25 px-3 py-3"
            >
              <span className="text-sm text-[var(--ivory)]">
                {p ? p.name : t("lobby.openSeat")}
                {p?.id === room.hostId ? ` · ${t("lobby.host")}` : ""}
                {p?.id === playerId ? ` · ${t("lobby.you")}` : ""}
              </span>
              <span className="text-xs text-[var(--mute)]">
                {p ? t("lobby.seated") : t("lobby.waitingSeat")}
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-4 rounded-xl bg-[rgba(196,30,58,0.12)] px-3 py-2 text-sm text-[#f0b4bd]">
          {te(error)}
        </p>
      )}

      <p className="mt-4 text-center text-xs text-[var(--mute)]">
        {me ? t("speed.waiting") : t("game.joinTable")}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={onLeave}
        className="mt-4 w-full text-center text-xs text-[var(--mute)]"
      >
        {t("lobby.leave")}
      </button>
    </div>
  );
}
