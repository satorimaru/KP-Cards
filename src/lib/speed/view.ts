import { sameCard, type Card } from "@/lib/tienlen/types";
import { remainingOf } from "./engine";
import { sortSpeedHand } from "./ranks";
import {
  SPEED_DEAL,
  SPEED_HAND,
  SPEED_REVEAL_AT,
  SPEED_SORT_MS,
  type SpeedState,
  type SpeedStatus,
} from "./types";

export interface SpeedOppView {
  remaining: number;
  showCount: boolean;
  next: boolean;
  ready: boolean;
  sorting: boolean;
}

export interface SpeedPileView {
  live: Card | null;
  stockCount: number;
}

export interface SpeedView {
  status: SpeedStatus;
  you: 0 | 1;
  hand: Card[];
  pile: Card[];
  pileCount: number;
  sortUntil: number;
  next: boolean;
  ready: boolean;
  opponent: SpeedOppView;
  piles: [SpeedPileView, SpeedPileView];
  winnerSeat: 0 | 1 | null;
}

export function toSpeedView(
  state: SpeedState,
  you: 0 | 1,
  now: number = Date.now(),
): SpeedView {
  const me = state.players[you];
  const them = state.players[you === 0 ? 1 : 0];
  const theirLeft = remainingOf(them);
  return {
    status: state.status,
    you,
    hand: me.hand,
    pile: me.pile,
    pileCount: me.pile.length,
    sortUntil: me.sortUntil,
    next: me.next,
    ready: me.ready,
    opponent: {
      remaining: theirLeft,
      showCount: theirLeft <= SPEED_REVEAL_AT,
      next: them.next,
      ready: them.ready,
      sorting: them.sortUntil > now,
    },
    piles: [
      { live: state.piles[0].live, stockCount: state.piles[0].stock.length },
      { live: state.piles[1].live, stockCount: state.piles[1].stock.length },
    ],
    winnerSeat: state.winnerSeat,
  };
}

export function meterTicks(remaining: number, max = SPEED_DEAL): boolean[] {
  return Array.from({ length: max }, (_, i) => i < remaining);
}

export function optimisticPlay(
  view: SpeedView,
  card: Card,
  pile: 0 | 1,
): SpeedView {
  const hand = view.hand.filter((held) => !sameCard(held, card));
  const piles: SpeedView["piles"] = [
    { ...view.piles[0] },
    { ...view.piles[1] },
  ];
  piles[pile] = { ...piles[pile], live: card };
  const leftover = hand.length + view.pileCount;
  return {
    ...view,
    hand,
    next: false,
    piles,
    status: leftover === 0 ? "finished" : view.status,
    winnerSeat: leftover === 0 ? view.you : view.winnerSeat,
  };
}

export function optimisticDraw(view: SpeedView): SpeedView {
  if (view.hand.length >= SPEED_HAND || view.pile.length === 0) return view;
  const [drawn, ...rest] = view.pile;
  return {
    ...view,
    hand: [...view.hand, drawn],
    pile: rest,
    pileCount: rest.length,
    next: false,
  };
}

export function optimisticNext(view: SpeedView): SpeedView {
  return { ...view, next: true };
}

export function optimisticSort(view: SpeedView, now: number = Date.now()): SpeedView {
  return {
    ...view,
    hand: sortSpeedHand(view.hand),
    sortUntil: now + SPEED_SORT_MS,
  };
}
