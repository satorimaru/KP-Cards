import {
  canDouble,
  canSplit,
  handValue,
  hit,
  stand,
  doubleDown,
  split,
  setBet,
  insure,
  type BjState,
} from "./engine";

export function botBet(state: BjState, seat: number): BjState {
  const p = state.seats[seat];
  const amount = p.stack >= 25 ? 25 : 10;
  if (p.stack < 10) return state;
  const next = setBet(state, seat, amount <= p.stack ? amount : 10);
  if (!next.ok) return state;
  next.state.seats[seat].ready = true;
  return next.state;
}

export function botInsure(state: BjState, seat: number): BjState {
  const next = insure(state, seat, false);
  return next.ok ? next.state : state;
}

export function botPlay(state: BjState, seat: number): BjState {
  const p = state.seats[seat];
  const hand = p.hands[p.current];
  if (!hand) return state;
  const { total, soft } = handValue(hand.cards);
  const up = state.dealer[0] ? handValue([state.dealer[0]]).total : 10;

  if (canSplit(state, seat) && (total === 16 || total === 18) && up < 8) {
    const next = split(state, seat);
    if (next.ok) return next.state;
  }
  if (canDouble(state, seat) && ((total === 11) || (total === 10 && up < 10))) {
    const next = doubleDown(state, seat);
    if (next.ok) return next.state;
  }
  if (soft && total <= 17) {
    const next = hit(state, seat);
    return next.ok ? next.state : state;
  }
  if (!soft && total <= 11) {
    const next = hit(state, seat);
    return next.ok ? next.state : state;
  }
  if (!soft && total <= 16 && up >= 7) {
    const next = hit(state, seat);
    return next.ok ? next.state : state;
  }
  const next = stand(state, seat);
  return next.ok ? next.state : state;
}
