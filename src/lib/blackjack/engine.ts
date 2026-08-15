import { createDeck, shuffle } from "@/lib/tienlen/deck";
import type { Card, Rank } from "@/lib/tienlen/types";

export const BJ_MAX_SEATS = 6;
export const BJ_BETS = [10, 25, 50] as const;
export const BJ_START = 500;
export const BJ_DECKS = 6;
export const BJ_DEAL_MS = 15_000;

export type BjPhase = "betting" | "insure" | "play" | "settle";

export interface BjHand {
  cards: Card[];
  bet: number;
  stood: boolean;
  doubled: boolean;
}

export interface BjSeat {
  id: string;
  name: string;
  seat: number;
  stack: number;
  isBot: boolean;
  hands: BjHand[];
  current: number;
  insured: boolean;
  ready: boolean;
}

export interface BjState {
  phase: BjPhase;
  seats: BjSeat[];
  dealer: Card[];
  shoe: Card[];
  discard: number;
  toAct: number | null;
  startStack: number;
  /** When the betting deal auto-fires. Set when the first player readies. */
  dealAt: number | null;
}

export type BjError =
  | "err.illegal"
  | "err.notYourTurn"
  | "err.needBet"
  | "err.needChips";

export type BjResult = { ok: true; state: BjState } | { ok: false; error: BjError };

export function cardBj(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J" || rank === "10") return 10;
  return Number(rank);
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardBj(c.rank);
    if (c.rank === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

function makeShoe(random: () => number): Card[] {
  const shoe: Card[] = [];
  for (let i = 0; i < BJ_DECKS; i++) shoe.push(...createDeck());
  return shuffle(shoe, random);
}

function draw(state: BjState): Card {
  if (state.shoe.length < 30) {
    state.shoe = makeShoe(Math.random);
    state.discard = 0;
  }
  const card = state.shoe.pop()!;
  state.discard += 1;
  return card;
}

export function createBjTable(
  names: string[],
  opts?: { botsFrom?: number; startStack?: number },
): BjState {
  const startStack = opts?.startStack ?? BJ_START;
  const botsFrom = opts?.botsFrom ?? 1;
  return {
    phase: "betting",
    seats: names.map((name, seat) => ({
      id: seat === 0 ? "you" : `bot-${seat}`,
      name,
      seat,
      stack: startStack,
      isBot: seat >= botsFrom,
      hands: [],
      current: 0,
      insured: false,
      ready: false,
    })),
    dealer: [],
    shoe: makeShoe(Math.random),
    discard: 0,
    toAct: null,
    startStack,
    dealAt: null,
  };
}

function mustReady(s: BjSeat): boolean {
  if (s.isBot) return false;
  return Boolean(s.hands[0]?.bet) || s.stack >= 10;
}

export function allPlayersReady(state: BjState): boolean {
  const need = state.seats.filter(mustReady);
  return need.length > 0 && need.every((s) => s.ready);
}

export function readyDeal(
  state: BjState,
  seat: number,
  now: number = Date.now(),
): BjResult {
  if (state.phase !== "betting") return { ok: false, error: "err.illegal" };
  const p = state.seats[seat];
  if (!p) return { ok: false, error: "err.illegal" };
  if (!p.hands[0]?.bet) return { ok: false, error: "err.needBet" };
  p.ready = true;
  if (state.dealAt == null) state.dealAt = now + BJ_DEAL_MS;
  return maybeDeal(state, now);
}

export function maybeDeal(state: BjState, now: number = Date.now()): BjResult {
  if (state.phase !== "betting") return { ok: true, state };
  if (!state.seats.some((s) => s.hands[0]?.bet)) return { ok: true, state };
  const due = state.dealAt != null && now >= state.dealAt;
  if (!due && !allPlayersReady(state)) return { ok: true, state };
  return dealRound(state);
}

export function setBet(state: BjState, seat: number, amount: number): BjResult {
  if (state.phase !== "betting") return { ok: false, error: "err.illegal" };
  const p = state.seats[seat];
  if (!p) return { ok: false, error: "err.illegal" };
  if (!BJ_BETS.includes(amount as (typeof BJ_BETS)[number])) {
    return { ok: false, error: "err.illegal" };
  }
  if (p.stack < amount) return { ok: false, error: "err.needChips" };
  p.hands = [{ cards: [], bet: amount, stood: false, doubled: false }];
  p.current = 0;
  p.insured = false;
  return { ok: true, state };
}

export function dealRound(state: BjState): BjResult {
  if (state.phase !== "betting") return { ok: false, error: "err.illegal" };
  const active = state.seats.filter((s) => s.hands[0]?.bet);
  if (active.length === 0) return { ok: false, error: "err.needBet" };
  state.dealAt = null;
  for (const s of state.seats) {
    s.ready = false;
    if (!s.hands[0]?.bet) s.hands = [];
    else {
      s.stack -= s.hands[0].bet;
      s.hands[0].cards = [];
    }
  }
  state.dealer = [];
  for (let i = 0; i < 2; i++) {
    for (const s of state.seats) {
      if (s.hands[0]) s.hands[0].cards.push(draw(state));
    }
    state.dealer.push(draw(state));
  }
  const up = state.dealer[0];
  const dealerBj = isBlackjack(state.dealer);
  if (up?.rank === "A") {
    state.phase = "insure";
    state.toAct = firstPlayer(state);
    return { ok: true, state };
  }
  if (cardBj(up.rank) === 10 && dealerBj) {
    return settle(state);
  }
  return beginPlay(state);
}

function firstPlayer(state: BjState): number | null {
  for (const s of state.seats) {
    if (s.hands.some((h) => h.cards.length && !h.stood && !isBust(h.cards))) {
      return s.seat;
    }
  }
  return null;
}

function beginPlay(state: BjState): BjResult {
  for (const s of state.seats) {
    for (const h of s.hands) {
      if (isBlackjack(h.cards)) h.stood = true;
    }
  }
  if (isBlackjack(state.dealer)) return settle(state);
  state.phase = "play";
  state.toAct = nextActor(state, -1);
  if (state.toAct == null) return dealerPlay(state);
  return { ok: true, state };
}

function nextActor(state: BjState, after: number): number | null {
  for (const s of state.seats) {
    if (s.seat <= after) continue;
    const hand = s.hands[s.current];
    if (hand && !hand.stood && !isBust(hand.cards) && !isBlackjack(hand.cards)) {
      return s.seat;
    }
    if (s.hands[s.current + 1] && !s.hands[s.current + 1].stood) {
      s.current += 1;
      return s.seat;
    }
  }
  return null;
}

export function insure(state: BjState, seat: number, take: boolean): BjResult {
  if (state.phase !== "insure") return { ok: false, error: "err.illegal" };
  const p = state.seats[seat];
  if (!p?.hands[0]) return { ok: false, error: "err.illegal" };
  if (take) {
    const cost = Math.floor(p.hands[0].bet / 2);
    if (p.stack < cost) return { ok: false, error: "err.needChips" };
    p.stack -= cost;
    p.insured = true;
  }
  const next = nextActor(state, seat);
  if (next != null) {
    state.toAct = next;
    return { ok: true, state };
  }
  if (isBlackjack(state.dealer)) return settle(state);
  return beginPlay(state);
}

function finishHand(state: BjState, seat: number): BjResult {
  const p = state.seats[seat];
  const hand = p.hands[p.current];
  hand.stood = true;
  if (p.hands[p.current + 1]) {
    p.current += 1;
    state.toAct = seat;
    return { ok: true, state };
  }
  const next = nextActor(state, seat);
  state.toAct = next;
  if (next == null) return dealerPlay(state);
  return { ok: true, state };
}

export function hit(state: BjState, seat: number): BjResult {
  if (state.phase !== "play" || state.toAct !== seat) {
    return { ok: false, error: "err.notYourTurn" };
  }
  const p = state.seats[seat];
  const hand = p.hands[p.current];
  if (!hand || hand.stood) return { ok: false, error: "err.illegal" };
  hand.cards.push(draw(state));
  if (isBust(hand.cards) || handValue(hand.cards).total === 21) {
    return finishHand(state, seat);
  }
  return { ok: true, state };
}

export function stand(state: BjState, seat: number): BjResult {
  if (state.phase !== "play" || state.toAct !== seat) {
    return { ok: false, error: "err.notYourTurn" };
  }
  return finishHand(state, seat);
}

export function doubleDown(state: BjState, seat: number): BjResult {
  if (state.phase !== "play" || state.toAct !== seat) {
    return { ok: false, error: "err.notYourTurn" };
  }
  const p = state.seats[seat];
  const hand = p.hands[p.current];
  if (!hand || hand.cards.length !== 2 || p.stack < hand.bet) {
    return { ok: false, error: "err.illegal" };
  }
  p.stack -= hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(draw(state));
  return finishHand(state, seat);
}

export function split(state: BjState, seat: number): BjResult {
  if (state.phase !== "play" || state.toAct !== seat) {
    return { ok: false, error: "err.notYourTurn" };
  }
  const p = state.seats[seat];
  const hand = p.hands[p.current];
  if (!hand || hand.cards.length !== 2 || p.hands.length > 1) {
    return { ok: false, error: "err.illegal" };
  }
  if (cardBj(hand.cards[0].rank) !== cardBj(hand.cards[1].rank)) {
    return { ok: false, error: "err.illegal" };
  }
  if (p.stack < hand.bet) return { ok: false, error: "err.needChips" };
  p.stack -= hand.bet;
  const second: BjHand = {
    cards: [hand.cards.pop()!],
    bet: hand.bet,
    stood: false,
    doubled: false,
  };
  hand.cards.push(draw(state));
  second.cards.push(draw(state));
  p.hands.push(second);
  return { ok: true, state };
}

export type BjHandResult = "win" | "blackjack" | "push" | "lose";

export function resultForHand(
  cards: Card[],
  dealer: Card[],
  soleHand: boolean,
): BjHandResult {
  const playerBj = soleHand && isBlackjack(cards);
  const dealerBj = isBlackjack(dealer);
  if (playerBj && !dealerBj) return "blackjack";
  if (playerBj && dealerBj) return "push";
  if (isBust(cards) || dealerBj) return "lose";
  const tot = handValue(cards).total;
  const dealerBust = isBust(dealer);
  const dealerTot = handValue(dealer).total;
  if (dealerBust || tot > dealerTot) return "win";
  if (tot === dealerTot) return "push";
  return "lose";
}

export function profitForHand(kind: BjHandResult, bet: number): number {
  if (kind === "blackjack") return Math.floor((bet * 3) / 2);
  if (kind === "win") return bet;
  return 0;
}

export function seatResult(
  seat: BjSeat,
  dealer: Card[],
): { kind: BjHandResult; n: number } | null {
  const hands = seat.hands.filter((h) => h.cards.length && h.bet);
  if (!hands.length) return null;
  let profit = 0;
  let best: BjHandResult = "lose";
  for (const h of hands) {
    const kind = resultForHand(h.cards, dealer, seat.hands.length === 1);
    profit += profitForHand(kind, h.bet);
    if (kind === "blackjack") best = "blackjack";
    else if (kind === "win" && best !== "blackjack") best = "win";
    else if (kind === "push" && best === "lose") best = "push";
  }
  if (profit > 0) return { kind: best === "blackjack" ? "blackjack" : "win", n: profit };
  return { kind: best, n: 0 };
}

function dealerPlay(state: BjState): BjResult {
  while (true) {
    const { total, soft } = handValue(state.dealer);
    if (total > 17) break;
    if (total === 17 && !soft) break;
    if (total === 17 && soft) break;
    if (total >= 17) break;
    state.dealer.push(draw(state));
  }
  return settle(state);
}

function settle(state: BjState): BjResult {
  const dealerBj = isBlackjack(state.dealer);
  for (const s of state.seats) {
    for (const h of s.hands) {
      if (s.insured && dealerBj && h === s.hands[0]) {
        s.stack += Math.floor(h.bet / 2) * 3;
      }
      const kind = resultForHand(h.cards, state.dealer, s.hands.length === 1);
      if (kind === "blackjack") {
        s.stack += h.bet + Math.floor((h.bet * 3) / 2);
      } else if (kind === "win") {
        s.stack += h.bet * 2;
      } else if (kind === "push") {
        s.stack += h.bet;
      }
    }
  }
  state.phase = "settle";
  state.toAct = null;
  return { ok: true, state };
}

export function nextRound(state: BjState): BjResult {
  for (const s of state.seats) {
    s.hands = [];
    s.current = 0;
    s.insured = false;
    s.ready = false;
  }
  state.dealer = [];
  state.phase = "betting";
  state.toAct = null;
  state.dealAt = null;
  return { ok: true, state };
}

export function rebuyBj(state: BjState, seat: number): BjResult {
  const p = state.seats[seat];
  if (!p || p.stack > 0 || state.phase === "play") {
    return { ok: false, error: "err.illegal" };
  }
  p.stack = state.startStack;
  return { ok: true, state };
}

export function canDouble(state: BjState, seat: number): boolean {
  const p = state.seats[seat];
  const h = p?.hands[p.current];
  return Boolean(h && h.cards.length === 2 && p.stack >= h.bet && !h.doubled);
}

export function canSplit(state: BjState, seat: number): boolean {
  const p = state.seats[seat];
  const h = p?.hands[p.current];
  return Boolean(
    h &&
      h.cards.length === 2 &&
      p.hands.length === 1 &&
      cardBj(h.cards[0].rank) === cardBj(h.cards[1].rank) &&
      p.stack >= h.bet,
  );
}
