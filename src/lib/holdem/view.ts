import { legalActions, potTotal } from "./engine";
import type { EvaluatedHand } from "./ranks";
import type { HoldemLogEntry, HoldemPlayer, HoldemState, LegalActions } from "./types";
import type { Card } from "@/lib/tienlen/types";

export interface HoldemSeatView {
  id: string;
  name: string;
  seat: number;
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  sittingOut: boolean;
  hole: Card[];
  holeCount: number;
}

export interface HoldemView {
  status: HoldemState["status"];
  street: HoldemState["street"];
  board: Card[];
  pot: number;
  dealerSeat: number;
  toAct: number | null;
  you: number;
  players: HoldemSeatView[];
  legal: LegalActions;
  winners: HoldemState["winners"];
  currentBet: number;
  minRaise: number;
  bb: number;
  startStack: number;
  log: HoldemLogEntry[];
}

export function toHoldemView(state: HoldemState, you: number): HoldemView {
  const show = state.status === "handOver";
  return {
    status: state.status,
    street: state.street,
    board: state.board,
    pot: potTotal(state),
    dealerSeat: state.dealerSeat,
    toAct: state.toAct,
    you,
    legal: legalActions(state, you),
    winners: state.winners,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    bb: state.bb,
    startStack: state.startStack,
    log: state.log ?? [],
    players: state.players.map((p) => seatView(p, you, show)),
  };
}

function seatView(p: HoldemPlayer, you: number, show: boolean): HoldemSeatView {
  const reveal = p.seat === you || show;
  return {
    id: p.id,
    name: p.name,
    seat: p.seat,
    stack: p.stack,
    bet: p.bet,
    folded: p.folded,
    allIn: p.allIn,
    sittingOut: p.sittingOut,
    hole: reveal ? p.hole : [],
    holeCount: p.hole.length,
  };
}

export function viewToState(view: HoldemView): HoldemState {
  const streetBets = view.players.reduce((n, p) => n + p.bet, 0);
  return {
    status: view.status,
    players: view.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      stack: p.stack,
      hole:
        p.hole.length > 0
          ? p.hole
          : Array.from({ length: p.holeCount }, () => ({
              rank: "A" as const,
              suit: "S" as const,
            })),
      bet: p.bet,
      contributed: 0,
      folded: p.folded,
      allIn: p.allIn,
      sittingOut: p.sittingOut,
      isBot: false,
    })),
    dealerSeat: view.dealerSeat,
    toAct: view.toAct,
    street: view.street,
    board: view.board,
    deck: [],
    pot: Math.max(0, view.pot - streetBets),
    currentBet: view.currentBet,
    minRaise: view.minRaise,
    lastAggressor: null,
    pending: [],
    sb: Math.floor(view.bb / 2),
    bb: view.bb,
    startStack: view.startStack,
    winners: view.winners,
    log: view.log ?? [],
  };
}

export type { EvaluatedHand };
