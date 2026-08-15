"use client";

import { teamOf } from "@/lib/rules";
import type { RoomView } from "@/lib/rooms/types";
import { useApp } from "./AppProviders";

interface ResultModalProps {
  room: RoomView;
  playerId: string;
  onRematch: () => void;
  onBuyIn?: () => void;
  onMenu?: () => void;
  busy?: boolean;
  rematchLabel?: string;
  rematchHint?: string;
  menuLabel?: string;
}

export function ResultModal({
  room,
  playerId,
  onRematch,
  onBuyIn,
  onMenu,
  busy,
  rematchLabel,
  rematchHint,
  menuLabel,
}: ResultModalProps) {
  const { t } = useApp();
  const chipsOn = Boolean(room.rules?.chips);
  const me = room.players.find((p) => p.id === playerId);
  const broke = chipsOn && (me?.chips ?? 0) <= 0;
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
        {chipsOn && (
          <ul className="mt-4 space-y-1.5">
            {room.players
              .slice()
              .sort((a, b) => (b.chips ?? 0) - (a.chips ?? 0))
              .map((p) => {
                const delta = (room.lastChipPays ?? []).reduce((n, pay) => {
                  if (pay.toPlayerId === p.id) return n + pay.amount;
                  if (pay.fromPlayerId === p.id) return n - pay.amount;
                  return n;
                }, 0);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-sm text-[var(--ivory)]"
                  >
                    <span>
                      {p.name}
                      {(p.buyIns ?? 0) > 0 && (
                        <span className="ml-1 text-[10px] text-[var(--gold)]">
                          ↻{p.buyIns}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {delta !== 0 && (
                        <span
                          className={
                            delta > 0
                              ? "mr-2 text-[var(--gold)]"
                              : "mr-2 text-[#f0b4bd]"
                          }
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                      {p.chips ?? 0}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
        {broke && onBuyIn && (
          <button
            type="button"
            disabled={busy}
            onClick={onBuyIn}
            className="btn-gold mt-6 w-full"
          >
            {t("chips.buyIn", { n: room.rules?.startChips ?? 10 })}
          </button>
        )}
        <button
          type="button"
          disabled={busy || broke}
          onClick={onRematch}
          className={[
            "w-full",
            broke && onBuyIn ? "btn-ghost mt-2" : "btn-gold mt-6",
          ].join(" ")}
        >
          {rematchLabel ?? t("result.lobby")}
        </button>
        <p className="mt-3 text-center text-xs text-[var(--mute)]">
          {broke ? t("chips.broke") : rematchHint ?? t("result.lobbyHint")}
        </p>
        {onMenu && (
          <button
            type="button"
            disabled={busy}
            onClick={onMenu}
            className="btn-ghost mt-3 w-full"
          >
            {menuLabel ?? t("result.menu")}
          </button>
        )}
      </div>
    </div>
  );
}
