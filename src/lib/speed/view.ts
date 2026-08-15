import { SPEED_DEAL, SPEED_REVEAL_AT, type SpeedState, type SpeedStatus } from "./types";
import { remainingOf } from "./engine";
import type { Card } from "@/lib/tienlen/types";

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
