import type { Card } from "@/lib/tienlen/types";
import type { EvaluatedHand } from "./ranks";

export const HOLDEM_MAX = 6;
export const HOLDEM_DEFAULT_SB = 5;
export const HOLDEM_DEFAULT_BB = 10;
export const HOLDEM_DEFAULT_STACK = 500;

export type HoldemStatus = "waiting" | "playing" | "handOver";
export type Street = "preflop" | "flop" | "turn" | "river";
export type HoldemActionKind = "fold" | "check" | "call" | "bet" | "raise" | "allin";
export type HoldemLogKind =
  | "sb"
  | "bb"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "allin"
  | "flop"
  | "turn"
  | "river"
  | "win"
  | "split"
  | "show";

export interface HoldemLogEntry {
  id: number;
  seat: number;
  name: string;
  kind: HoldemLogKind;
  n?: number;
}

export interface HoldemPlayer {
  id: string;
  name: string;
  seat: number;
  stack: number;
  hole: Card[];
  /** Chips in this street. */
  bet: number;
  /** Chips put in this hand (all streets). */
  contributed: number;
  folded: boolean;
  allIn: boolean;
  sittingOut: boolean;
  isBot: boolean;
  /** Cards tabled at showdown, or shown after winning a fold. */
  shown: boolean;
}

export interface HandWinner {
  seats: number[];
  amount: number;
  category?: EvaluatedHand["category"];
}

export interface HoldemState {
  status: HoldemStatus;
  players: HoldemPlayer[];
  dealerSeat: number;
  toAct: number | null;
  street: Street;
  board: Card[];
  deck: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  lastAggressor: number | null;
  /** Seats that still need to act this street (matched or checked). */
  pending: number[];
  sb: number;
  bb: number;
  startStack: number;
  winners: HandWinner[];
  log: HoldemLogEntry[];
  /** True when the pot was won because everyone else folded. */
  uncontested: boolean;
}

export type HoldemError =
  | "err.notPlaying"
  | "err.notYourTurn"
  | "err.needPlayers"
  | "err.illegal"
  | "err.seat"
  | "err.needChips";

export type HoldemResult =
  | { ok: true; state: HoldemState }
  | { ok: false; error: HoldemError };

export interface LegalActions {
  fold: boolean;
  check: boolean;
  call: number;
  minBet: number;
  maxBet: number;
  canRaise: boolean;
}
