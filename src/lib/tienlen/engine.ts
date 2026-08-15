import { DEFAULT_RULES, parseRules, teamOf, type GameRules } from "@/lib/rules";
import { beats, detectCombo } from "./combos";
import { dealTable } from "./deck";
import {
  type Card,
  type Combo,
  type ComboType,
  cardValue,
  drawCountFor,
  heldCard,
  isJoker,
  isSpecial,
  isUnoCard,
  isUnoComboType,
  sameCard,
  sortCards,
} from "./types";

export interface HandState {
  hands: Card[][];
  pile: Combo | null;
  currentSeat: number;
  lastPlaySeat: number | null;
  passesInRow: number;
  finishOrder: number[];
  /** First lead of the hand must include this card. Cleared after that play. */
  leadCard: Card | null;
  playerCount: number;
  rules: GameRules;
  /** 1 = clockwise, -1 = reversed (Uno mode). */
  direction: 1 | -1;
  /** Undealt leftover cards. Draw 2 / draw 4 take from here. */
  stock: Card[];
  /** Played cards no longer on the table. Recycled when stock is empty. */
  discard: Card[];
  /** Seats that passed this trick. Sit out until the pile clears. */
  satOut: number[];
  /** Earlier plays this lead, oldest first. Cleared when the pile resets. */
  trick: Combo[];
}

export function isStuckOnLastTwo(hand: Card[], rules: GameRules): boolean {
  return rules.noFinishOnTwo && hand.length === 1 && hand[0]?.rank === "2";
}

function wouldFinishOnTwo(
  hand: Card[],
  cards: Card[],
  rules: GameRules,
): boolean {
  return (
    rules.noFinishOnTwo &&
    cards.length === hand.length &&
    cards.some((c) => c.rank === "2")
  );
}

export function lowestCardInPlay(
  hands: Card[][],
): { seat: number; card: Card } | null {
  let bestSeat = -1;
  let best: Card | null = null;
  for (let s = 0; s < hands.length; s++) {
    for (const card of hands[s]) {
      if (isSpecial(card)) continue;
      if (!best || cardValue(card) < cardValue(best)) {
        best = card;
        bestSeat = s;
      }
    }
  }
  return best ? { seat: bestSeat, card: best } : null;
}

export function createHandState(
  playerCount: number,
  random: () => number = Math.random,
  rules: Partial<GameRules> = DEFAULT_RULES,
): HandState {
  const nextRules = parseRules(rules);
  const dealt = dealTable(playerCount, random, nextRules);
  return handStateFromHands(dealt.hands, nextRules, dealt.stock);
}

/** Build a new hand from already-dealt cards (tests + rematch). */
export function handStateFromHands(
  hands: Card[][],
  rules: Partial<GameRules> = DEFAULT_RULES,
  stock: Card[] = [],
): HandState {
  const playerCount = hands.length;
  if (playerCount < 2 || playerCount > 4) {
    throw new Error("playerCount must be 2–4");
  }

  const opening = lowestCardInPlay(hands);

  return {
    hands: hands.map((h) => sortCards(h)),
    pile: null,
    currentSeat: opening?.seat ?? 0,
    lastPlaySeat: null,
    passesInRow: 0,
    finishOrder: [],
    leadCard: opening?.card ?? null,
    playerCount,
    rules: parseRules(rules),
    direction: 1,
    stock: [...stock],
    discard: [],
    satOut: [],
    trick: [],
  };
}

function takeFromStock(
  stock: Card[],
  discard: Card[],
  n: number,
): { taken: Card[]; stock: Card[]; discard: Card[] } {
  let nextStock = [...stock];
  let nextDiscard = [...discard];
  const taken: Card[] = [];
  while (taken.length < n) {
    if (nextStock.length === 0) {
      if (nextDiscard.length === 0) break;
      nextStock = nextDiscard;
      nextDiscard = [];
    }
    const card = nextStock.shift();
    if (card) taken.push(heldCard(card));
  }
  return { taken, stock: nextStock, discard: nextDiscard };
}

function activeSeats(state: HandState): number[] {
  return Array.from({ length: state.playerCount }, (_, i) => i).filter(
    (s) => state.hands[s].length > 0 && !state.finishOrder.includes(s),
  );
}

function satOutSet(state: HandState): Set<number> {
  return new Set(state.satOut ?? []);
}

function inRoundSeats(state: HandState): number[] {
  const active = activeSeats(state);
  if (state.rules.playAfterPass) return active;
  const sat = satOutSet(state);
  return active.filter((s) => !sat.has(s));
}

/** Next in-round seat after `from`. Used for skip / draw targets. */
export function unoTargetSeat(
  state: HandState,
  actorSeat: number,
  type: ComboType,
): number | null {
  if (type !== "skip" && type !== "draw2" && type !== "draw4") return null;
  const target = nextActiveSeat(state, actorSeat);
  return target === actorSeat ? null : target;
}

function nextActiveSeat(state: HandState, from: number): number {
  const active = inRoundSeats(state);
  if (active.length === 0) return from;
  const dir = state.direction >= 0 ? 1 : -1;
  let s = (from + dir + state.playerCount) % state.playerCount;
  for (let i = 0; i < state.playerCount; i++) {
    if (active.includes(s)) return s;
    s = (s + dir + state.playerCount) % state.playerCount;
  }
  return from;
}

function cardsInHand(hand: Card[], cards: Card[]): boolean {
  const remaining = [...hand];
  for (const c of cards) {
    const idx = remaining.findIndex((h) => sameCard(h, c));
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

function removeCards(hand: Card[], cards: Card[]): Card[] {
  const remaining = [...hand];
  for (const c of cards) {
    const idx = remaining.findIndex((h) => sameCard(h, c));
    if (idx === -1) throw new Error("Card not in hand");
    remaining.splice(idx, 1);
  }
  return sortCards(remaining);
}

function siegeTeamDone(state: HandState, team: 0 | 1): boolean {
  return [0, 1, 2, 3]
    .filter((s) => teamOf(s) === team)
    .every((s) => state.finishOrder.includes(s));
}

function finishOrderComplete(state: HandState): boolean {
  if (state.rules.siege && state.playerCount === 4) {
    return siegeTeamDone(state, 0) || siegeTeamDone(state, 1);
  }
  return state.finishOrder.length >= state.playerCount - 1;
}

function completeFinishOrder(state: HandState, finishOrder: number[]): number[] {
  const next = [...finishOrder];
  if (state.rules.siege && state.playerCount === 4) {
    const winner = siegeTeamDone({ ...state, finishOrder: next }, 0)
      ? 0
      : siegeTeamDone({ ...state, finishOrder: next }, 1)
        ? 1
        : null;
    if (winner == null) return next;
    const leftover = [0, 1, 2, 3]
      .filter((s) => !next.includes(s))
      .sort(
        (a, b) =>
          (state.hands[a]?.length ?? 0) - (state.hands[b]?.length ?? 0),
      );
    return [...next, ...leftover];
  }
  if (next.length >= state.playerCount - 1) {
    for (let s = 0; s < state.playerCount; s++) {
      if (!next.includes(s)) next.push(s);
    }
  }
  return next;
}

export function mustIncludeLeadCard(state: HandState, seat: number): boolean {
  if (state.pile || !state.leadCard) return false;
  return (state.hands[seat] ?? []).some((c) => sameCard(c, state.leadCard!));
}

export function validatePlay(
  state: HandState,
  seat: number,
  cards: Card[],
): { ok: true; combo: Combo } | { ok: false; error: string } {
  if (finishOrderComplete(state)) {
    return { ok: false, error: "err.finished" };
  }
  if (seat !== state.currentSeat) {
    return { ok: false, error: "err.notYourTurn" };
  }
  if (state.finishOrder.includes(seat)) {
    return { ok: false, error: "err.alreadyFinished" };
  }
  if (
    !state.rules.playAfterPass &&
    state.pile &&
    satOutSet(state).has(seat)
  ) {
    return { ok: false, error: "err.satOut" };
  }

  const hand = state.hands[seat];
  if (!cardsInHand(hand, cards)) {
    return { ok: false, error: "err.cardsNotInHand" };
  }

  const jokers = cards.filter(isJoker);
  if (jokers.some((card) => !card.as)) {
    return { ok: false, error: "err.jokerNeedFace" };
  }
  if (jokers.some((card) => card.as?.rank === "2")) {
    return { ok: false, error: "err.jokerNotTwo" };
  }

  const combo = detectCombo(cards);
  if (!combo) {
    if (cards.some(isUnoCard) && cards.every((c) => isUnoCard(c) || isJoker(c))) {
      return { ok: false, error: "err.unoNeedPlay" };
    }
    return { ok: false, error: "err.invalidCombo" };
  }

  if (wouldFinishOnTwo(hand, cards, state.rules)) {
    return { ok: false, error: "err.cannotFinishOnTwo" };
  }

  if (combo.uno && !state.rules.uno) {
    return { ok: false, error: "err.invalidCombo" };
  }
  if (isUnoComboType(combo.type)) {
    return { ok: false, error: "err.unoNeedPlay" };
  }

  if (!state.pile) {
    if (
      mustIncludeLeadCard(state, seat) &&
      state.leadCard &&
      !cards.some((c) => sameCard(c, state.leadCard!))
    ) {
      return {
        ok: false,
        error: "err.mustLead",
      };
    }
    return { ok: true, combo };
  }

  if (!beats(combo, state.pile)) {
    return {
      ok: false,
      error: "err.mustBeat",
    };
  }

  return { ok: true, combo };
}

function sweepLead(state: HandState): HandState {
  return {
    ...state,
    pile: null,
    trick: [],
    lastPlaySeat: null,
    passesInRow: 0,
    satOut: [],
    discard: [
      ...(state.discard ?? []),
      ...(state.trick ?? []).flatMap((combo) => combo.cards),
      ...(state.pile?.cards ?? []),
    ].map(heldCard),
  };
}

export function applyPlay(
  state: HandState,
  seat: number,
  cards: Card[],
): HandState {
  const result = validatePlay(state, seat, cards);
  if (!result.ok) throw new Error(result.error);

  const hands = state.hands.map((h, i) =>
    i === seat ? removeCards(h, cards) : [...h],
  );

  let finishOrder = [...state.finishOrder];
  if (hands[seat].length === 0 && !finishOrder.includes(seat)) {
    finishOrder.push(seat);
  }

  const effect = result.combo.uno;
  let direction = state.direction;
  if (effect === "reverse") {
    direction = state.direction === 1 ? -1 : 1;
  }

  let stock = [...(state.stock ?? [])];
  let discard = [...(state.discard ?? [])];
  let trick = [...(state.trick ?? [])];
  if (state.pile) {
    trick = [...trick, state.pile];
  }

  const drawN = drawCountFor(effect ?? result.combo.type);
  let victim: number | null = null;
  if (effect === "draw2" || effect === "draw4") {
    const probe: HandState = {
      ...state,
      hands,
      finishOrder,
      direction,
    };
    victim = nextActiveSeat(probe, seat);
    const pulled = takeFromStock(stock, discard, drawN);
    stock = pulled.stock;
    discard = pulled.discard;
    hands[victim] = sortCards([
      ...(hands[victim] ?? []),
      ...pulled.taken,
    ]);
  }

  let satOut = [...(state.satOut ?? [])];
  if (!state.pile) {
    satOut = [];
  } else if (state.rules.playAfterPass) {
    satOut = satOut.filter((s) => s !== seat);
  }

  const next: HandState = {
    ...state,
    hands,
    pile: result.combo,
    lastPlaySeat: seat,
    passesInRow: 0,
    finishOrder,
    leadCard: null,
    currentSeat: seat,
    direction,
    stock,
    discard,
    satOut,
    trick,
  };

  finishOrder = completeFinishOrder(next, finishOrder);
  next.finishOrder = finishOrder;

  if (finishOrderComplete(next)) {
    const done = sweepLead(next);
    done.currentSeat = seat;
    return done;
  }

  const stillIn = inRoundSeats(next).filter((s) => s !== seat);
  if (stillIn.length === 0) {
    const won = sweepLead(next);
    won.currentSeat =
      (won.hands[seat]?.length ?? 0) > 0
        ? seat
        : nextActiveSeat(won, seat);
    return won;
  }

  let after = nextActiveSeat(next, seat);
  if (effect === "skip") {
    after = nextActiveSeat({ ...next, currentSeat: after }, after);
  }
  next.currentSeat = after;
  return next;
}

export function validatePass(
  state: HandState,
  seat: number,
): { ok: true } | { ok: false; error: string } {
  if (finishOrderComplete(state)) {
    return { ok: false, error: "err.finished" };
  }
  if (seat !== state.currentSeat) {
    return { ok: false, error: "err.notYourTurn" };
  }
  if (!state.pile) {
    if (isStuckOnLastTwo(state.hands[seat] ?? [], state.rules)) {
      return { ok: true };
    }
    return { ok: false, error: "err.cannotPassLead" };
  }
  return { ok: true };
}

export function applyPass(state: HandState, seat: number): HandState {
  const result = validatePass(state, seat);
  if (!result.ok) throw new Error(result.error);

  const active = activeSeats(state);
  if (!state.pile) {
    return {
      ...state,
      pile: null,
      lastPlaySeat: null,
      passesInRow: 0,
      satOut: [],
      trick: [],
      currentSeat: nextActiveSeat(state, seat),
    };
  }

  const satOut = [...new Set([...(state.satOut ?? []), seat])];
  const marked: HandState = { ...state, satOut };
  const othersActive = active.filter((s) => s !== state.lastPlaySeat);
  const passesInRow = state.passesInRow + 1;
  const inRoundLeft = inRoundSeats(marked).filter(
    (s) => s !== state.lastPlaySeat,
  );
  const roundOver = state.rules.playAfterPass
    ? passesInRow >= othersActive.length
    : inRoundLeft.length === 0;

  if (roundOver) {
    const leader = state.lastPlaySeat ?? seat;
    const cleared = sweepLead(state);
    return {
      ...cleared,
      currentSeat: active.includes(leader)
        ? leader
        : nextActiveSeat(cleared, leader),
    };
  }

  return {
    ...state,
    satOut,
    passesInRow,
    currentSeat: nextActiveSeat(marked, seat),
  };
}

export function isGameFinished(state: HandState): boolean {
  return finishOrderComplete(state);
}
