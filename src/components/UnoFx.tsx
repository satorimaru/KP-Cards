"use client";

import type { RoomEvent, RoomPlayer, RoomView } from "@/lib/rooms/types";
import { useApp } from "./AppProviders";
import { playEventSignature, useEphemeralFx } from "./fxEvent";

const FX_MS = 2400;

export type UnoPlayEvent = Extract<RoomEvent, { kind: "play" }>;

export function unoEffectOf(event: UnoPlayEvent) {
  return (
    event.uno ??
    (event.comboType === "skip" ||
    event.comboType === "reverse" ||
    event.comboType === "draw2" ||
    event.comboType === "draw4"
      ? event.comboType
      : undefined)
  );
}

export function isUnoFxEvent(event: RoomEvent | null): event is UnoPlayEvent {
  return event?.kind === "play" && Boolean(unoEffectOf(event));
}

export function useUnoFx(room: RoomView) {
  const event = isUnoFxEvent(room.lastEvent) ? room.lastEvent : null;
  return useEphemeralFx(
    event,
    event ? playEventSignature(event) : "",
    FX_MS,
  );
}

export function UnoDirectionBar({
  direction,
  reversing,
}: {
  direction: 1 | -1;
  reversing?: boolean;
}) {
  const { t } = useApp();
  const left = direction === -1;
  const label = left ? t("game.counterClockwise") : t("game.clockwise");
  return (
    <div
      className={[
        "dir-banner",
        reversing ? "uno-dir-flip" : "",
      ].join(" ")}
      aria-label={label}
    >
      <span className={left ? "dir-arrows dir-arrows-left" : "dir-arrows"} aria-hidden>
        {left ? "◀◀◀" : "▶▶▶"}
      </span>
      <span className="dir-banner-text">{t("game.playThisWay")}</span>
      <span className="dir-banner-name">{label}</span>
      <span className={left ? "dir-arrows dir-arrows-left" : "dir-arrows"} aria-hidden>
        {left ? "◀◀◀" : "▶▶▶"}
      </span>
    </div>
  );
}

export function UnoSeatArrow({ direction }: { direction: 1 | -1 }) {
  const left = direction === -1;
  return (
    <div
      className={["dir-seat-arrow", left ? "dir-seat-arrow-left" : ""].join(" ")}
      aria-hidden
    >
      {left ? "◀" : "▶"}
    </div>
  );
}



export function UnoBurst({
  event,
  burstKey,
  actor,
  target,
}: {
  event: UnoPlayEvent;
  burstKey: number;
  actor: string;
  target: string;
}) {
  const { t } = useApp();
  const type = unoEffectOf(event) ?? event.comboType;
  const mark =
    type === "skip"
      ? "⏭"
      : type === "reverse"
        ? "↻"
        : type === "draw2"
          ? "+2"
          : "+4";
  const label =
    type === "skip"
      ? t("game.skipped", { name: actor, target })
      : type === "reverse"
        ? t("game.reversed", { name: actor })
        : t("game.drew", {
            name: actor,
            target,
            n: event.drawn ?? (type === "draw2" ? 2 : 4),
          });

  return (
    <div
      key={burstKey}
      className="uno-burst pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center"
    >
      <div
        className={[
          "uno-burst-mark font-[family-name:var(--font-display)] leading-none text-[var(--gold)]",
          type === "reverse" ? "uno-burst-spin" : "",
          type === "skip" ? "uno-burst-slash" : "",
          type === "draw2" || type === "draw4" ? "uno-burst-draw" : "",
        ].join(" ")}
      >
        {mark}
      </div>
      <p className="mt-2 max-w-[16rem] px-3 text-center text-xs font-semibold text-[var(--ivory)]">
        {label}
      </p>
    </div>
  );
}

export function UnoPlayedBadge({
  playerId,
  fx,
}: {
  playerId: string;
  fx: UnoPlayEvent | null;
}) {
  const { t } = useApp();
  if (!fx || fx.playerId !== playerId) return null;
  const type = unoEffectOf(fx);
  if (type !== "skip" && type !== "reverse") return null;
  const mark = type === "skip" ? "⏭" : "↻";
  const label = type === "skip" ? t("combo.skip") : t("combo.reverse");
  return (
    <div className="uno-played" aria-hidden={false}>
      <span className="uno-played-mark">{mark}</span>
      <span className="uno-played-label">{label}</span>
    </div>
  );
}

export function SkipX({ burstKey }: { burstKey: number }) {
  return (
    <div key={burstKey} className="skip-x" aria-hidden>
      <svg viewBox="0 0 32 32" className="skip-x-mark">
        <path
          d="M7 7 L25 25 M25 7 L7 25"
          fill="none"
          stroke="#f0b4bd"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function UnoPlayerMark({
  player,
  fx,
  youId,
}: {
  player: RoomPlayer;
  fx: UnoPlayEvent | null;
  youId: string;
}) {
  const { t } = useApp();
  if (!fx || fx.targetPlayerId !== player.id) return null;
  const hit = unoEffectOf(fx);
  if (hit === "skip") return null;
  if (hit === "draw2" || hit === "draw4") {
    const n = fx.drawn ?? (hit === "draw2" ? 2 : 4);
    return (
      <div className="uno-played">
        <span className="uno-played-mark">+{n}</span>
        <span className="uno-played-label">
          {hit === "draw2" ? t("combo.draw2") : t("combo.draw4")}
        </span>
      </div>
    );
  }
  return null;
}

export function playerLabel(
  players: RoomPlayer[],
  id: string | undefined,
  youId: string,
  youWord: string,
  fallback: string,
): string {
  if (!id) return fallback;
  if (id === youId) return youWord;
  return players.find((p) => p.id === id)?.name ?? fallback;
}
