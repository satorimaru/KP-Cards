import { applyAction, legalActions } from "./engine";
import { evaluateBest, pokerValue } from "./ranks";
import type { HoldemActionKind, HoldemState } from "./types";

export function chooseHoldemAction(
  state: HoldemState,
  seat: number,
): { kind: HoldemActionKind; raiseTo?: number } {
  const p = state.players[seat];
  const legal = legalActions(state, seat);
  if (!p || (!legal.fold && !legal.check && legal.call <= 0 && !legal.canRaise)) {
    return { kind: "check" };
  }

  const hole = p.hole;
  const vals = hole.map((c) => pokerValue(c.rank)).sort((a, b) => b - a);
  const pair = vals.length === 2 && vals[0] === vals[1];
  const suited = hole.length === 2 && hole[0].suit === hole[1].suit;
  const high = vals[0] ?? 0;
  const connected = vals.length === 2 && vals[0] - vals[1] <= 2;

  let strength = 0;
  if (pair) strength += high >= 10 ? 8 : 5;
  if (high >= 13) strength += 2;
  if (suited) strength += 1;
  if (connected) strength += 1;
  if (state.board.length >= 3) {
    const ev = evaluateBest([...hole, ...state.board]);
    const cat = ev.category;
    if (cat === "straight_flush" || cat === "quads" || cat === "full_house") strength = 12;
    else if (cat === "flush" || cat === "straight" || cat === "trips") strength = 9;
    else if (cat === "two_pair") strength = 7;
    else if (cat === "pair") strength = ev.kickers[0] >= 10 ? 6 : 4;
    else strength = Math.min(strength, 2);
  }

  const toCall = legal.call;
  const pot = state.pot + state.players.reduce((n, pl) => n + pl.bet, 0);

  if (legal.check && strength < 4) return { kind: "check" };
  if (toCall > 0 && strength < 3) return { kind: "fold" };
  if (toCall > 0 && strength < 5 && toCall > pot / 2) return { kind: "fold" };

  if (strength >= 8 && legal.canRaise) {
    const raiseTo = Math.min(legal.maxBet, Math.max(legal.minBet, Math.floor(pot * 0.7) + state.currentBet));
    return { kind: state.currentBet === 0 ? "bet" : "raise", raiseTo };
  }
  if (legal.check) return { kind: "check" };
  if (toCall > 0) return { kind: "call" };
  return { kind: "check" };
}

export function applyBotAction(state: HoldemState, seat: number) {
  const choice = chooseHoldemAction(state, seat);
  return applyAction(state, seat, choice.kind, choice.raiseTo);
}
