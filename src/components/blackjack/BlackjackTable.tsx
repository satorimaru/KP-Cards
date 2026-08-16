"use client";

import { useEffect, useState } from "react";
import {
  BJ_BETS,
  canDouble,
  canSplit,
  handValue,
  isBlackjack,
  isBust,
  seatResult,
  type BjSeat,
  type BjState,
} from "@/lib/blackjack/engine";
import type { MessageKey } from "@/lib/i18n";
import { playSfx, type SfxName } from "@/lib/sfx";
import { useApp } from "../AppProviders";
import { FeltStack } from "../FeltStack";
import { useSfxWatch } from "../useSfx";

interface BlackjackTableProps {
  state: BjState;
  youSeat: number;
  busy?: boolean;
  onBet: (n: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onInsure: (take: boolean) => void;
  onDeal: () => void;
  onNext: () => void;
  onRebuy: () => void;
  onMenu?: () => void;
}

/** Rail seats around you. Never the center under the dealer. */
const RAIL = {
  L0: "top-[58%] left-2",
  R0: "top-[58%] right-2",
  L1: "top-[36%] left-2",
  R1: "top-[36%] right-2",
  L2: "top-[13%] left-2",
  R2: "top-[13%] right-2",
} as const;

const LEFT_SLOTS = ["L0", "L1", "L2"] as const;
const RIGHT_SLOTS = ["R0", "R1", "R2"] as const;

function railSeats(seats: BjSeat[], youSeat: number): Array<BjSeat & { rail: string }> {
  const n = seats.length;
  const left: BjSeat[] = [];
  const right: BjSeat[] = [];
  for (let i = 1; i < n; i++) {
    if (i % 2 === 1) {
      left.push(seats[(youSeat - Math.ceil(i / 2) + n) % n]);
    } else {
      right.push(seats[(youSeat + i / 2) % n]);
    }
  }
  if (left.length === 1 && right.length === 0) {
    return [{ ...left[0], rail: RAIL.L1 }];
  }
  return [
    ...left.map((s, i) => ({ ...s, rail: RAIL[LEFT_SLOTS[i] ?? "L2"] })),
    ...right.map((s, i) => ({ ...s, rail: RAIL[RIGHT_SLOTS[i] ?? "R2"] })),
  ];
}

function formatSettle(
  state: BjState,
  youSeat: number,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): string {
  const you = t("game.you");
  const parts: string[] = [];
  for (const s of state.seats) {
    const result = seatResult(s, state.dealer);
    if (!result) continue;
    const name = s.seat === youSeat ? you : s.name;
    if (result.kind === "blackjack" || result.kind === "win") {
      parts.push(
        t(result.kind === "blackjack" ? "bj.log.blackjack" : "bj.log.win", {
          name,
          n: result.n,
        }),
      );
    }
  }
  if (parts.length) return parts.join(" · ");
  const yours = state.seats[youSeat]
    ? seatResult(state.seats[youSeat], state.dealer)
    : null;
  if (yours?.kind === "push") return t("bj.log.push", { name: you });
  return t("bj.lose");
}

function handLabel(s: BjSeat, t: (key: MessageKey) => string) {
  const hand = s.hands[s.current] ?? s.hands[0];
  if (!hand) return "";
  const val = hand.cards.length ? handValue(hand.cards) : null;
  const extra = val
    ? ` · ${isBlackjack(hand.cards) ? t("bj.blackjack") : isBust(hand.cards) ? t("bj.bust") : val.total}`
    : "";
  return `${hand.bet}${extra}`;
}

export function BlackjackTable({
  state,
  youSeat,
  busy,
  onBet,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onInsure,
  onDeal,
  onNext,
  onRebuy,
  onMenu,
}: BlackjackTableProps) {
  const { t, sound } = useApp();
  const you = state.seats[youSeat];
  const yourTurn = state.toAct === youSeat;
  const hideHole = state.phase !== "settle";
  const dealerVal = handValue(hideHole ? state.dealer.slice(0, 1) : state.dealer);
  const others = railSeats(state.seats, youSeat);
  const youHand = you?.hands[you.current] ?? you?.hands[0];
  const tight = others.length >= 4;
  const [dealLeft, setDealLeft] = useState(0);
  const settleSfx: SfxName | null = (() => {
    if (state.phase !== "settle") return null;
    const yours = you ? seatResult(you, state.dealer) : null;
    if (yours?.kind === "win" || yours?.kind === "blackjack") return "win";
    if (yours?.kind === "push") return "check";
    return "lose";
  })();
  useSfxWatch(`bj-phase|${state.phase}`, state.phase === "play" || state.phase === "insure" ? "deal" : settleSfx);
  useSfxWatch(
    `bj-hit|${youHand?.cards.length ?? 0}`,
    state.phase === "play" && (youHand?.cards.length ?? 0) > 2 ? "play" : null,
  );

  useEffect(() => {
    if (state.phase !== "betting" || state.dealAt == null) {
      setDealLeft(0);
      return;
    }
    const tick = () =>
      setDealLeft(Math.max(0, Math.ceil((state.dealAt! - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [state.phase, state.dealAt]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="table-felt relative min-h-0 flex-1 overflow-hidden rounded-[1.2rem]">
        <div className="absolute top-1 left-1/2 z-[5] flex w-[min(100%,14rem)] -translate-x-1/2 flex-col items-center">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--gold)]">
            {t("bj.dealer")}
            {state.dealer.length > 0
              ? ` · ${dealerVal.total}${hideHole ? "+" : ""}`
              : ""}
          </p>
          {state.phase === "betting" && state.dealAt != null && (
            <p className="text-[11px] tabular-nums text-[var(--gold)]">
              {t("bj.dealIn", { n: dealLeft })}
            </p>
          )}
          {state.dealer.length > 0 && (
            <div className="mt-0.5 h-[6.4rem] w-full max-w-[11.6rem]">
              <FeltStack
                cards={state.dealer}
                faceDown={(i) => i === 1 && hideHole}
                overlapRem={state.dealer.length > 2 ? 1.05 : 0.2}
              />
            </div>
          )}
        </div>

        {others.map((s) => {
          const hand = s.hands[s.current] ?? s.hands[0];
          return (
            <div
              key={s.id}
              className={[
                "absolute z-[6] flex w-[7.2rem] flex-col items-center px-0.5 py-0.5",
                s.rail,
                state.toAct === s.seat
                  ? "rounded-xl bg-[rgba(212,176,106,0.18)] ring-1 ring-[var(--gold)]"
                  : "",
              ].join(" ")}
            >
              <p className="w-full truncate text-center text-[10px] leading-none text-[var(--ivory)]">
                {s.name}
                <span className="ml-0.5 tabular-nums text-[var(--gold)]">{s.stack}</span>
              </p>
              {state.phase === "betting" && s.ready ? (
                <p className="text-[9px] leading-none text-[var(--gold)]">
                  {t("bj.ready")}
                </p>
              ) : hand ? (
                <p className="text-[9px] leading-none text-[var(--mute)]">
                  {handLabel(s, t)}
                </p>
              ) : null}
              {hand?.cards.length ? (
                <div
                  className={[
                    "mt-0.5 w-full",
                    tight ? "h-[5.1rem]" : "h-[5.6rem]",
                  ].join(" ")}
                >
                  <FeltStack
                    cards={hand.cards}
                    overlapRem={hand.cards.length > 2 ? 1.25 : 0.2}
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        {state.phase === "settle" && (
          <p
            className="pointer-events-none absolute top-[46%] left-1/2 z-[8] w-[min(92%,20rem)] -translate-x-1/2 -translate-y-1/2 px-1 text-center text-[1.05rem] font-semibold leading-snug text-[var(--ivory)]"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.75), 0 0 14px rgba(0,0,0,0.45)" }}
          >
            {formatSettle(state, youSeat, t)}
          </p>
        )}

        {you && (
          <div
            className={[
              "absolute bottom-1 left-1/2 z-[6] flex w-[13.4rem] -translate-x-1/2 flex-col items-center px-1 py-0.5",
              state.toAct === you.seat
                ? "rounded-xl bg-[rgba(212,176,106,0.18)] ring-1 ring-[var(--gold)]"
                : "",
            ].join(" ")}
          >
            <p className="truncate text-[10px] leading-none text-[var(--ivory)]">
              {t("game.you")}
              <span className="ml-1 tabular-nums text-[var(--gold)]">{you.stack}</span>
              {state.phase === "betting" && you.ready ? (
                <span className="ml-1 text-[var(--gold)]">{t("bj.ready")}</span>
              ) : youHand ? (
                <span className="ml-1 text-[var(--mute)]">{handLabel(you, t)}</span>
              ) : null}
            </p>
            {youHand?.cards.length ? (
              <div className="mt-0.5 h-[7.4rem] w-full max-w-[13rem]">
                <FeltStack
                  cards={youHand.cards}
                  overlapRem={youHand.cards.length > 2 ? 1.05 : 0.15}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-1.5 shrink-0 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {state.phase === "betting" && (
          <div className="flex gap-2">
            {BJ_BETS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy || (you?.stack ?? 0) < n}
                className={[
                  "flex-1",
                  you?.hands[0]?.bet === n ? "btn-gold" : "btn-ghost",
                ].join(" ")}
                onClick={() => {
                  if (sound) playSfx("chip");
                  onBet(n);
                }}
              >
                {t("bj.bet", { n })}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || !you?.hands[0]?.bet || Boolean(you.ready)}
              className="btn-gold flex-1"
              onClick={onDeal}
            >
              {you?.ready ? t("bj.ready") : t("bj.deal")}
            </button>
          </div>
        )}
        {state.phase === "insure" && yourTurn && (
          <div className="flex gap-2">
            <button type="button" className="btn-gold flex-1" onClick={() => onInsure(true)}>
              {t("bj.insurance")}
            </button>
            <button type="button" className="btn-ghost flex-1" onClick={() => onInsure(false)}>
              {t("bj.stand")}
            </button>
          </div>
        )}
        {state.phase === "play" && yourTurn && (
          <div className="flex gap-1.5">
            <button type="button" disabled={busy} className="btn-gold flex-1" onClick={onHit}>
              {t("bj.hit")}
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn-ghost flex-1"
              onClick={() => {
                if (sound) playSfx("check");
                onStand();
              }}
            >
              {t("bj.stand")}
            </button>
            {canDouble(state, youSeat) && (
              <button type="button" disabled={busy} className="btn-ghost flex-1" onClick={onDouble}>
                {t("bj.double")}
              </button>
            )}
            {canSplit(state, youSeat) && (
              <button type="button" disabled={busy} className="btn-ghost flex-1" onClick={onSplit}>
                {t("bj.split")}
              </button>
            )}
          </div>
        )}
        {state.phase === "settle" && (
          <div className="flex gap-2">
            {(you?.stack ?? 0) <= 0 && (
              <button type="button" className="btn-ghost flex-1" onClick={onRebuy}>
                {t("bj.rebuy")}
              </button>
            )}
            <button type="button" className="btn-gold flex-1" onClick={onNext}>
              {t("bj.deal")}
            </button>
            {onMenu && (
              <button type="button" className="btn-ghost flex-1" onClick={onMenu}>
                {t("result.menu")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
