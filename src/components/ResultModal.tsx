"use client";

import { teamOf } from "@/lib/rules";
import type { RoomView } from "@/lib/rooms/types";
import { useApp } from "./AppProviders";

interface ResultModalProps {
  room: RoomView;
  playerId: string;
  onRematch: () => void;
  busy?: boolean;
  rematchLabel?: string;
  rematchHint?: string;
}

export function ResultModal({
  room,
  playerId,
  onRematch,
  busy,
  rematchLabel,
  rematchHint,
}: ResultModalProps) {
  const { t } = useApp();
  const ranked = room.winners
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);
  const places = [
    t("result.1st"),
    t("result.2nd"),
    t("result.3rd"),
    t("result.4th"),
  ];
  const siege = room.rules?.siege && room.players.length === 4;
  const winningSeat = room.players.find(
    (p) => p.id === room.winners[0],
  )?.seat;
  const winningTeam =
    siege && winningSeat != null
      ? teamOf(winningSeat) === 0
        ? t("game.teamA")
        : t("game.teamB")
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <div className="glass-panel w-full max-w-sm rounded-[1.75rem] p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[var(--gold-dim)]">
          {t("game.handOver")}
        </p>
        <h2 className="mt-1 text-center font-[family-name:var(--font-display)] text-3xl">
          {winningTeam
            ? t("result.teamWin", { team: winningTeam })
            : t("result.places")}
        </h2>
        <ol className="mt-5 space-y-2">
          {ranked.map((p, i) => (
            <li
              key={p!.id}
              className={[
                "flex items-center justify-between rounded-2xl px-4 py-3",
                p!.id === playerId
                  ? "bg-[rgba(212,176,106,0.12)]"
                  : "bg-black/25",
              ].join(" ")}
            >
              <span className="text-sm text-[var(--ivory)]">
                {places[i] ?? `${i + 1}`} · {p!.name}
                {p!.id === playerId ? ` · ${t("result.you")}` : ""}
              </span>
              {i === 0 && (
                <span className="text-xs tracking-wide text-[var(--gold)]">
                  {t("result.first")}
                </span>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={busy}
          onClick={onRematch}
          className="btn-gold mt-6 w-full"
        >
          {rematchLabel ?? t("result.lobby")}
        </button>
        <p className="mt-3 text-center text-xs text-[var(--mute)]">
          {rematchHint ?? t("result.lobbyHint")}
        </p>
      </div>
    </div>
  );
}
