"use client";

import { useState } from "react";
import { parseRules, type GameRules } from "@/lib/rules";
import type { RoomView } from "@/lib/rooms/types";
import { useApp } from "./AppProviders";
import { ChatButton } from "./ChatSheet";
import { ModePicker } from "./ModePicker";

interface LobbyProps {
  room: RoomView;
  playerId: string;
  inviteUrl: string;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onOpenChat: () => void;
  unread?: number;
  busy?: boolean;
  error?: string | null;
  onChangeRules?: (rules: GameRules) => void;
}

export function Lobby({
  room,
  playerId,
  inviteUrl,
  onReady,
  onStart,
  onLeave,
  onOpenChat,
  unread = 0,
  busy,
  error,
  onChangeRules,
}: LobbyProps) {
  const { t, te } = useApp();
  const [copied, setCopied] = useState(false);
  const rules = parseRules(room.rules);
  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const allReady =
    room.players.length >= 2 && room.players.every((p) => p.ready);
  const seats = Array.from({ length: room.maxPlayers }, (_, i) => {
    return room.players.find((p) => p.seat === i) ?? null;
  });

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
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--gold-dim)]">
            {t("lobby.waiting")}
          </p>
          <h1 className="mt-1 font-mono text-[2rem] tracking-[0.18em] text-[var(--ivory)]">
            {room.id}
          </h1>
          <p className="mt-1 text-sm text-[var(--mute)]">
            {t("lobby.seatedCount", {
              n: room.players.length,
              max: room.maxPlayers,
            })}
          </p>
        </div>
        <ChatButton
          unread={unread}
          onClick={onOpenChat}
          className="min-h-11 rounded-full border border-[rgba(212,176,106,0.22)] px-3 text-xs tracking-wide text-[var(--gold)]"
        />
      </div>

      <div className="mb-5 flex gap-2">
        <input
          readOnly
          value={inviteUrl}
          className="field min-w-0 flex-1 truncate text-xs"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="btn-ghost min-w-20 px-4 text-sm"
        >
          {copied ? t("lobby.copied") : t("lobby.copy")}
        </button>
      </div>

      <ul className="mb-5 space-y-2">
        {seats.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-2xl bg-black/25 px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(212,176,106,0.12)] text-sm text-[var(--gold)]">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--ivory)]">
                  {p ? p.name : t("lobby.openSeat")}
                </p>
                <p className="text-[11px] text-[var(--mute)]">
                  {p?.id === room.hostId
                    ? t("lobby.host")
                    : p?.id === playerId
                      ? t("lobby.you")
                      : p
                        ? t("lobby.seated")
                        : t("lobby.waitingSeat")}
                </p>
              </div>
            </div>
            {p ? (
              <span
                className={
                  p.ready
                    ? "text-xs font-semibold text-[var(--gold)]"
                    : "text-xs text-[var(--mute)]"
                }
              >
                {p.ready ? t("lobby.ready") : t("lobby.notReady")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mb-5">
        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {t("settings.modes")}
        </p>
        <ModePicker
          rules={rules}
          disabled={!isHost || busy || !onChangeRules}
          onChange={(next) => onChangeRules?.(next)}
        />
      </div>

      <div className="mb-5 space-y-2">
        {room.maxPlayers === 3 && (
          <button
            type="button"
            disabled={!isHost || busy || !onChangeRules}
            onClick={() =>
              onChangeRules?.({
                ...rules,
                threePlayerSeventeen: !rules.threePlayerSeventeen,
              })
            }
            className="flex w-full items-center justify-between rounded-2xl bg-black/25 px-3 py-2.5 text-left text-sm disabled:opacity-70"
          >
            <span className="text-[var(--ivory)]">{t("settings.seventeen")}</span>
            <span className="text-xs text-[var(--gold)]">
              {rules.threePlayerSeventeen ? "17" : "13"}
            </span>
          </button>
        )}
        <button
          type="button"
          disabled={!isHost || busy || !onChangeRules}
          onClick={() =>
            onChangeRules?.({
              ...rules,
              noFinishOnTwo: !rules.noFinishOnTwo,
            })
          }
          className="flex w-full items-center justify-between rounded-2xl bg-black/25 px-3 py-2.5 text-left text-sm disabled:opacity-70"
        >
          <span className="text-[var(--ivory)]">{t("settings.noTwo")}</span>
          <span className="text-xs text-[var(--gold)]">
            {rules.noFinishOnTwo ? t("settings.on") : t("settings.off")}
          </span>
        </button>
        <button
          type="button"
          disabled={!isHost || busy || !onChangeRules}
          onClick={() =>
            onChangeRules?.({
              ...rules,
              playAfterPass: !rules.playAfterPass,
            })
          }
          className="flex w-full items-center justify-between rounded-2xl bg-black/25 px-3 py-2.5 text-left text-sm disabled:opacity-70"
        >
          <span className="text-[var(--ivory)]">{t("settings.playAfterPass")}</span>
          <span className="text-xs text-[var(--gold)]">
            {rules.playAfterPass ? t("settings.on") : t("settings.off")}
          </span>
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-[rgba(196,30,58,0.12)] px-3 py-2 text-sm text-[#f0b4bd]">
          {te(error)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {me && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onReady(!me.ready)}
            className={me.ready ? "btn-ghost w-full" : "btn-gold w-full"}
          >
            {me.ready ? t("lobby.hold") : t("lobby.ready")}
          </button>
        )}
        {isHost && (
          <button
            type="button"
            disabled={busy || !allReady}
            onClick={onStart}
            className="btn-ghost w-full"
          >
            {t("lobby.deal")}
          </button>
        )}
      </div>

      {isHost && !allReady && (
        <p className="mt-3 text-center text-xs text-[var(--mute)]">
          {t("lobby.needReady")}
        </p>
      )}

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
