"use client";

import { useMemo, useState } from "react";
import { legalActions, potTotal } from "@/lib/holdem/engine";
import type {
  HandWinner,
  HoldemActionKind,
  HoldemLogEntry,
  HoldemState,
} from "@/lib/holdem/types";
import type { MessageKey } from "@/lib/i18n";
import { useApp } from "../AppProviders";
import { FeltStack } from "../FeltStack";

interface HoldemTableProps {
  state: HoldemState;
  youSeat: number;
  busy?: boolean;
  onAct: (kind: HoldemActionKind, raiseTo?: number) => void;
  onDeal: () => void;
  onRebuy: () => void;
  onMenu?: () => void;
}

type Slot = { pos: string; align: string; puck: string };

const YOU_SLOT: Slot = {
  pos: "col-span-3 row-start-3",
  align: "items-center",
  puck: "bottom-[24%] left-1/2 -translate-x-1/2",
};

const RING: Record<number, Slot[]> = {
  2: [
    {
      pos: "col-start-2 row-start-1",
      align: "items-center",
      puck: "top-[20%] left-1/2 -translate-x-1/2",
    },
  ],
  3: [
    {
      pos: "col-start-1 row-start-2",
      align: "items-start",
      puck: "top-[46%] left-[17%]",
    },
    {
      pos: "col-start-3 row-start-2",
      align: "items-end",
      puck: "top-[46%] right-[17%]",
    },
  ],
  4: [
    {
      pos: "col-start-1 row-start-2",
      align: "items-start",
      puck: "top-[46%] left-[17%]",
    },
    {
      pos: "col-start-2 row-start-1",
      align: "items-center",
      puck: "top-[20%] left-1/2 -translate-x-1/2",
    },
    {
      pos: "col-start-3 row-start-2",
      align: "items-end",
      puck: "top-[46%] right-[17%]",
    },
  ],
  5: [
    {
      pos: "col-start-1 row-start-2",
      align: "items-start",
      puck: "top-[46%] left-[17%]",
    },
    {
      pos: "col-start-1 row-start-1",
      align: "items-start",
      puck: "top-[16%] left-[16%]",
    },
    {
      pos: "col-start-3 row-start-1",
      align: "items-end",
      puck: "top-[16%] right-[16%]",
    },
    {
      pos: "col-start-3 row-start-2",
      align: "items-end",
      puck: "top-[46%] right-[17%]",
    },
  ],
  6: [
    {
      pos: "col-start-1 row-start-2",
      align: "items-start",
      puck: "top-[46%] left-[17%]",
    },
    {
      pos: "col-start-1 row-start-1",
      align: "items-start",
      puck: "top-[16%] left-[16%]",
    },
    {
      pos: "col-start-2 row-start-1",
      align: "items-center",
      puck: "top-[20%] left-1/2 -translate-x-1/2",
    },
    {
      pos: "col-start-3 row-start-1",
      align: "items-end",
      puck: "top-[16%] right-[16%]",
    },
    {
      pos: "col-start-3 row-start-2",
      align: "items-end",
      puck: "top-[46%] right-[17%]",
    },
  ],
};

function offsetOf(seat: number, you: number, n: number): number {
  return (seat - you + n) % n;
}

function slotOf(off: number, n: number, isYou: boolean): Slot {
  if (isYou) return YOU_SLOT;
  const ring = RING[Math.min(6, Math.max(2, n))] ?? RING[6];
  return ring[off - 1] ?? RING[2][0];
}

export function HoldemTable({
  state,
  youSeat,
  busy,
  onAct,
  onDeal,
  onRebuy,
  onMenu,
}: HoldemTableProps) {
  const { t } = useApp();
  const n = state.players.length;
  const you = state.players[youSeat];
  const legal = legalActions(state, youSeat);
  const myTurn = state.toAct === youSeat && state.status === "playing";
  const [raiseTo, setRaiseTo] = useState(legal.minBet || state.bb);

  const sliderMin = legal.minBet || state.bb;
  const sliderMax = legal.maxBet || state.bb;
  const raiseValue = Math.min(sliderMax, Math.max(sliderMin, raiseTo));

  const winners = useMemo(() => {
    return state.winners.map((w) => formatWinner(w, state, t)).join(" · ");
  }, [state, t]);
  const lastLog = (state.log ?? []).at(-1);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="table-felt relative grid min-h-0 flex-1 grid-cols-3 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-1 overflow-hidden rounded-[1.2rem] p-1">
        {state.players.map((p) => {
          const off = offsetOf(p.seat, youSeat, n);
          const isYou = p.seat === youSeat;
          const slot = slotOf(off, n, isYou);
          const turn = state.toAct === p.seat;
          const showFace = (isYou || state.status === "handOver") && p.hole.length > 0;
          const dealt =
            !p.sittingOut &&
            (p.hole.length > 0 ||
              state.status === "playing" ||
              state.status === "handOver");
          const hole = dealt
            ? (p.hole.length >= 2 ? p.hole.slice(0, 2) : [p.hole[0] ?? null, p.hole[1] ?? null])
            : [];
          return (
            <div
              key={p.id}
              className={[
                slot.pos,
                slot.align,
                "flex min-h-0 min-w-0 flex-col",
                isYou ? "justify-end" : "justify-start",
              ].join(" ")}
            >
              <div
                className={[
                  "flex min-w-0 flex-col px-1 py-1",
                  slot.align,
                  turn ? "rounded-xl bg-[rgba(212,176,106,0.18)] ring-1 ring-[var(--gold)]" : "",
                  p.folded ? "opacity-45" : "",
                ].join(" ")}
              >
                <p className="max-w-full shrink-0 truncate text-[10px] leading-none text-[var(--ivory)]">
                  {isYou ? t("game.you") : p.name}
                  <span className="ml-1 tabular-nums text-[var(--gold)]">{p.stack}</span>
                  {p.bet > 0 ? (
                    <span className="ml-1 text-[var(--mute)]">{p.bet}</span>
                  ) : null}
                </p>
                {hole.length > 0 && (
                  <div
                    className={[
                      "mt-0.5 min-w-0",
                      isYou ? "h-[7.4rem] w-[12.8rem]" : "h-[5.5rem] w-[7.4rem]",
                    ].join(" ")}
                  >
                    <FeltStack
                      cards={hole}
                      faceDown={!showFace}
                      overlapRem={isYou ? 0 : 0.35}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div
          className={[
            "dealer-puck pointer-events-none absolute z-[12]",
            slotOf(offsetOf(state.dealerSeat, youSeat, n), n, state.dealerSeat === youSeat)
              .puck,
          ].join(" ")}
          aria-label={t("poker.dealer")}
        >
          {t("poker.dealer")}
        </div>

        <div className="pointer-events-none absolute inset-x-[8%] top-[30%] bottom-[28%] z-10 flex flex-col items-center justify-center">
          {lastLog && (
            <p
              className={[
                "mb-1.5 w-full max-w-[20rem] px-1 text-center text-[1.05rem] font-semibold leading-snug",
                lastLog.kind === "flop" ||
                lastLog.kind === "turn" ||
                lastLog.kind === "river"
                  ? "uppercase tracking-[0.16em] text-[var(--gold)]"
                  : "text-[var(--ivory)]",
              ].join(" ")}
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.75), 0 0 14px rgba(0,0,0,0.45)" }}
            >
              {formatLog(lastLog, youSeat, you?.name, t)}
            </p>
          )}
          <p className="mb-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--gold)]">
            {t("poker.pot", { n: potTotal(state) })}
          </p>
          {state.board.length > 0 && (
            <div className="h-[5.8rem] w-full max-w-[20rem]">
              <FeltStack
                cards={state.board}
                overlapRem={state.board.length > 3 ? 0.55 : 0.15}
              />
            </div>
          )}
        </div>
      </div>

      {state.status === "handOver" && (
        <p className="mt-1 truncate px-1 text-center text-xs text-[var(--gold)]">
          {winners}
        </p>
      )}

      <div className="mt-1.5 shrink-0 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {state.status !== "playing" ? (
          <div className="flex gap-2">
            {you && you.stack <= 0 && (
              <button type="button" className="btn-ghost flex-1" onClick={onRebuy}>
                {t("poker.rebuy")}
              </button>
            )}
            <button
              type="button"
              disabled={busy || (you?.stack ?? 0) <= 0}
              className="btn-gold flex-1"
              onClick={onDeal}
            >
              {t("poker.deal")}
            </button>
            {onMenu && (
              <button type="button" className="btn-ghost flex-1" onClick={onMenu}>
                {t("result.menu")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {legal.canRaise && (
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                value={raiseValue}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
                className="w-full accent-[var(--gold)]"
                disabled={!myTurn || busy}
              />
            )}
            <div className="flex gap-1.5">
              {legal.fold && (
                <button
                  type="button"
                  disabled={!myTurn || busy}
                  className="btn-ghost flex-1"
                  onClick={() => onAct("fold")}
                >
                  {t("poker.fold")}
                </button>
              )}
              {legal.check && (
                <button
                  type="button"
                  disabled={!myTurn || busy}
                  className="btn-gold flex-1"
                  onClick={() => onAct("check")}
                >
                  {t("poker.check")}
                </button>
              )}
              {legal.call > 0 && (
                <button
                  type="button"
                  disabled={!myTurn || busy}
                  className="btn-gold flex-1"
                  onClick={() => onAct("call")}
                >
                  {t("poker.call", { n: legal.call })}
                </button>
              )}
              {legal.canRaise && (
                <button
                  type="button"
                  disabled={!myTurn || busy}
                  className="btn-gold flex-1"
                  onClick={() =>
                    onAct(state.currentBet === 0 ? "bet" : "raise", raiseValue)
                  }
                >
                  {t(state.currentBet === 0 ? "poker.bet" : "poker.raise", {
                    n: raiseValue,
                  })}
                </button>
              )}
              <button
                type="button"
                disabled={!myTurn || busy || (you?.stack ?? 0) <= 0}
                className="btn-ghost flex-1"
                onClick={() => onAct("allin")}
              >
                {t("poker.allIn")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const LOG_KEY: Record<HoldemLogEntry["kind"], MessageKey> = {
  sb: "poker.log.sb",
  bb: "poker.log.bb",
  fold: "poker.log.fold",
  check: "poker.log.check",
  call: "poker.log.call",
  bet: "poker.log.bet",
  raise: "poker.log.raise",
  allin: "poker.log.allin",
  flop: "poker.log.flop",
  turn: "poker.log.turn",
  river: "poker.log.river",
  win: "poker.log.win",
  split: "poker.log.split",
};

function formatLog(
  entry: HoldemLogEntry,
  youSeat: number,
  youName: string | undefined,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): string {
  const you = t("game.you");
  const name =
    entry.seat === youSeat
      ? you
      : youName && entry.name
        ? entry.name.replace(youName, you)
        : entry.name;
  return t(LOG_KEY[entry.kind], { name, n: entry.n ?? 0 });
}

function formatWinner(
  w: HandWinner,
  state: HoldemState,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): string {
  const names = w.seats
    .map((s) => state.players[s]?.name ?? "")
    .filter(Boolean)
    .join(" & ");
  return w.seats.length > 1
    ? t("poker.split", { n: w.amount })
    : t("poker.winner", { name: names, n: w.amount });
}
