import type { Card } from "@/lib/tienlen/types";

export const SPEED_HAND = 4;
export const SPEED_DEAL = 20;
export const SPEED_STOCK = 6;
export const SPEED_SORT_MS = 1000;
export const SPEED_REVEAL_AT = 5;

export type SpeedStatus = "waiting" | "playing" | "finished";

export interface SpeedPile {
  stock: Card[];
  live: Card | null;
  played: Card[];
}

export interface SpeedPlayerState {
  hand: Card[];
  pile: Card[];
  next: boolean;
  sortUntil: number;
  ready: boolean;
}

export interface SpeedState {
  status: SpeedStatus;
  piles: [SpeedPile, SpeedPile];
  players: [SpeedPlayerState, SpeedPlayerState];
  winnerSeat: 0 | 1 | null;
}

export type SpeedError =
  | "err.notPlaying"
  | "err.sorting"
  | "err.finished"
  | "err.cardsNotInHand"
  | "err.notAdjacent"
  | "err.noLive"
  | "err.handFull"
  | "err.pileEmpty"
  | "err.havePlay"
  | "err.alreadyNext"
  | "err.seat";

export type SpeedOk<T = SpeedState> = { ok: true; state: T };
export type SpeedFail = { ok: false; error: SpeedError };
export type SpeedResult<T = SpeedState> = SpeedOk<T> | SpeedFail;

export interface SpeedPlay {
  card: Card;
  pile: 0 | 1;
}
