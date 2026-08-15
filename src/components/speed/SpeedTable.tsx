"use client";

import { useEffect, useMemo, useState } from "react";
import { cardId, type Card } from "@/lib/tienlen/types";
import { SPEED_HAND } from "@/lib/speed/types";
import { cardsAdjacent } from "@/lib/speed/ranks";
import { meterTicks, type SpeedView } from "@/lib/speed/view";
import { useApp } from "../AppProviders";
import { CardView } from "../CardView";

interface SpeedTableProps {
  view: SpeedView;
  youName: string;
  oppName: string;
  busy?: boolean;
  error?: string | null;
  onPlay: (card: Card, pile: 0 | 1) => void;
  onDraw: () => void;
  onSort: () => void;
  onNext: () => void;
  onReady: () => void;
  onRematch: () => void;
  onMenu?: () => void;
}

export function SpeedTable({
  view,
  youName,
  oppName,
  busy,
  error,
  onPlay,
  onDraw,
  onSort,
  onNext,
  onReady,
  onRematch,
  onMenu,
}: SpeedTableProps) {
  const { t, te } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const sorting = view.sortUntil > now;
  useEffect(() => {
    if (view.sortUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [view.sortUntil]);

  useEffect(() => {
    const ids = new Set(view.hand.map(cardId));
    if (selected && !ids.has(selected)) setSelected(null);
  }, [view.hand, selected]);

  const selectedCard = view.hand.find((c) => cardId(c) === selected) ?? null;
  const legalPiles = useMemo(() => {
    if (!selectedCard || view.status !== "playing") return [];
    return ([0, 1] as const).filter((i) => {
      const live = view.piles[i].live;
      return Boolean(live && cardsAdjacent(selectedCard, live));
    });
  }, [selectedCard, view.piles, view.status]);

  const locked = Boolean(busy) || sorting || view.status === "finished";
  const canDraw =
    view.status === "playing" &&
    !locked &&
    view.hand.length < SPEED_HAND &&
    view.pileCount > 0;
  const canSort =
    view.status === "playing" && !locked && view.hand.length > 1;
  const canNext = view.status === "playing" && !locked && !view.next;

  const tapCard = (card: Card) => {
    if (view.status !== "playing" || locked) return;
    const id = cardId(card);
    setSelected((prev) => (prev === id ? null : id));
  };

  const tapPile = (pile: 0 | 1) => {
    if (!selectedCard || locked || view.status !== "playing") return;
    onPlay(selectedCard, pile);
    setSelected(null);
  };

  const slots: (Card | null)[] = [
    ...view.hand,
    ...Array.from({ length: Math.max(0, SPEED_HAND - view.hand.length) }, () => null),
  ];

  const ticks = meterTicks(view.opponent.remaining);
  const youWon = view.winnerSeat === view.you;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center gap-2 px-0.5">
        <p className="w-16 shrink-0 truncate text-xs text-[var(--ivory)]">
          {oppName}
        </p>
        <div className="flex h-1.5 min-w-0 flex-1 items-center gap-px">
          {ticks.map((on, i) => (
            <span
              key={i}
              className={[
                "h-1.5 flex-1 rounded-[1px]",
                on ? "bg-[var(--gold)]" : "bg-black/35",
              ].join(" ")}
            />
          ))}
        </div>
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-[var(--gold)]">
          {view.opponent.showCount ? view.opponent.remaining : ""}
        </span>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
            view.status === "waiting" && view.opponent.ready
              ? "bg-[var(--gold)] text-[#1a1408]"
              : view.opponent.next
                ? "bg-[#5a2430] text-[#f0b4bd]"
                : "bg-black/30 text-[var(--mute)]",
          ].join(" ")}
        >
          {view.status === "waiting"
            ? view.opponent.ready
              ? t("speed.ready")
              : t("lobby.waiting")
            : view.opponent.next
              ? t("speed.stuck")
              : view.opponent.sorting
                ? t("speed.sorting")
                : ""}
        </span>
      </div>

      <div className="table-felt relative flex min-h-0 flex-1 items-center justify-center gap-6 overflow-hidden rounded-[1.15rem] px-5 py-4">
        {([0, 1] as const).map((i) => {
          const pile = view.piles[i];
          const hot = legalPiles.includes(i);
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                tapPile(i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") tapPile(i);
              }}
              className={[
                "relative flex w-[min(46%,10.25rem)] shrink-0 flex-col items-center",
                selectedCard ? "cursor-pointer" : "",
                hot ? "scale-[1.02]" : "",
              ].join(" ")}
            >
              <div className="pointer-events-none w-full aspect-[5/7]">
                {pile.live && view.status !== "waiting" ? (
                  <CardView
                    card={pile.live}
                    size="fill"
                    selected={hot}
                  />
                ) : (
                  <div className="h-full w-full rounded-[0.7rem] border border-dashed border-[rgba(212,176,106,0.28)] bg-black/20" />
                )}
              </div>
              <span className="mt-1 h-3 shrink-0 text-[10px] tabular-nums text-[var(--gold-dim)]">
                {pile.stockCount}
              </span>
            </div>
          );
        })}
      </div>

      {view.status === "waiting" ? (
        <button
          type="button"
          disabled={busy || view.ready}
          onClick={onReady}
          className={[
            "speed-next mt-1.5 w-full shrink-0",
            view.ready ? "speed-next-on" : "",
          ].join(" ")}
        >
          {view.ready ? t("speed.waiting") : t("speed.ready")}
        </button>
      ) : (
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className={[
            "speed-next mt-1.5 w-full shrink-0",
            view.next ? "speed-next-on" : "",
          ].join(" ")}
        >
          {view.next ? t("speed.stuck") : t("speed.next")}
        </button>
      )}

      <div className="mt-1.5 flex shrink-0 items-stretch gap-1.5">
        <div className="grid min-w-0 flex-1 grid-cols-4 gap-1">
          {slots.map((card, i) => (
            <div key={card ? cardId(card) : `empty-${i}`} className="aspect-[5/7] min-w-0">
              {card ? (
                <CardView
                  card={card}
                  size="fill"
                  selected={selected === cardId(card)}
                  disabled={locked || view.status !== "playing"}
                  onClick={() => tapCard(card)}
                />
              ) : (
                <div className="h-full w-full rounded-[0.7rem] border border-dashed border-[rgba(244,234,216,0.12)]" />
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!canDraw}
          onClick={onDraw}
          className="flex w-[5.4rem] shrink-0 flex-col items-center justify-center self-stretch rounded-[1rem] bg-black/35 active:brightness-95 disabled:opacity-40"
        >
          <span
            className="card-back h-[4.6rem] w-[3.2rem] rounded-[0.55rem] border border-[#3a0d16]"
            aria-hidden
          />
          <span className="mt-1.5 text-sm font-semibold tabular-nums text-[var(--gold)]">
            {view.pileCount}
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--mute)]">
            {t("speed.draw")}
          </span>
        </button>
      </div>

      <div className="mt-1.5 flex shrink-0 flex-col items-center pb-[max(0.2rem,env(safe-area-inset-bottom))]">
        {view.status !== "waiting" && (
          <button
            type="button"
            disabled={!canSort}
            onClick={onSort}
            className="h-9 w-full max-w-xs rounded-full bg-black/30 text-xs font-semibold tracking-[0.14em] text-[var(--ivory)] uppercase disabled:opacity-35"
          >
            {sorting ? t("speed.sorting") : t("speed.sort")}
          </button>
        )}
        <p className="mt-1 h-4 truncate text-[11px] text-[var(--mute)]">
          {youName}
        </p>
      </div>

      {error && (
        <p className="pointer-events-none absolute inset-x-3 bottom-[15.6rem] z-20 rounded-lg bg-[rgba(196,30,58,0.92)] px-3 py-1.5 text-center text-sm text-[#f0b4bd]">
          {te(error)}
        </p>
      )}

      {view.status === "finished" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="glass-panel w-full max-w-sm rounded-[1.75rem] p-6">
            <h2 className="text-center font-[family-name:var(--font-display)] text-3xl">
              {youWon ? t("speed.youWin") : t("speed.theyWin", { name: oppName })}
            </h2>
            <button type="button" onClick={onRematch} className="btn-gold mt-6 w-full">
              {t("speed.again")}
            </button>
            {onMenu && (
              <button type="button" onClick={onMenu} className="btn-ghost mt-2 w-full">
                {t("result.menu")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
