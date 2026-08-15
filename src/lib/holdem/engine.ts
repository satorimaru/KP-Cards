import { createDeck, shuffle } from "@/lib/tienlen/deck";
import type { Card } from "@/lib/tienlen/types";
import { compareHands, evaluateBest } from "./ranks";
import {
  HOLDEM_DEFAULT_BB,
  HOLDEM_DEFAULT_SB,
  HOLDEM_DEFAULT_STACK,
  type HandWinner,
  type HoldemActionKind,
  type HoldemError,
  type HoldemLogEntry,
  type HoldemPlayer,
  type HoldemResult,
  type HoldemState,
  type LegalActions,
  type Street,
} from "./types";

function fail(error: HoldemError): HoldemResult {
  return { ok: false, error };
}

function live(p: HoldemPlayer): boolean {
  return !p.sittingOut && p.stack + p.contributed > 0;
}

function inHand(p: HoldemPlayer): boolean {
  return live(p) && !p.folded;
}

function canAct(p: HoldemPlayer): boolean {
  return inHand(p) && !p.allIn && p.stack > 0;
}

export function potTotal(state: HoldemState): number {
  return state.pot + state.players.reduce((n, p) => n + p.bet, 0);
}

function nextLiveSeat(state: HoldemState, from: number, pred: (p: HoldemPlayer) => boolean): number | null {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    const p = state.players[seat];
    if (p && pred(p)) return seat;
  }
  return null;
}

function pushLog(
  state: HoldemState,
  entry: Omit<HoldemLogEntry, "id">,
): void {
  if (!state.log) state.log = [];
  const id = (state.log.at(-1)?.id ?? 0) + 1;
  state.log.push({ id, ...entry });
  if (state.log.length > 28) state.log.splice(0, state.log.length - 28);
}

function putChips(p: HoldemPlayer, amount: number): number {
  const take = Math.min(p.stack, Math.max(0, amount));
  p.stack -= take;
  p.bet += take;
  p.contributed += take;
  if (p.stack === 0) p.allIn = true;
  return take;
}

export function createTable(
  names: string[],
  opts?: { sb?: number; bb?: number; startStack?: number; botsFrom?: number },
): HoldemState {
  const startStack = opts?.startStack ?? HOLDEM_DEFAULT_STACK;
  const botsFrom = opts?.botsFrom ?? 1;
  const players: HoldemPlayer[] = names.map((name, seat) => ({
    id: seat === 0 ? "you" : `bot-${seat}`,
    name,
    seat,
    stack: startStack,
    hole: [],
    bet: 0,
    contributed: 0,
    folded: false,
    allIn: false,
    sittingOut: false,
    isBot: seat >= botsFrom,
  }));
  return {
    status: "waiting",
    players,
    dealerSeat: players.length - 1,
    toAct: null,
    street: "preflop",
    board: [],
    deck: [],
    pot: 0,
    currentBet: 0,
    minRaise: opts?.bb ?? HOLDEM_DEFAULT_BB,
    lastAggressor: null,
    pending: [],
    sb: opts?.sb ?? HOLDEM_DEFAULT_SB,
    bb: opts?.bb ?? HOLDEM_DEFAULT_BB,
    startStack,
    winners: [],
    log: [],
  };
}

function sweepBets(state: HoldemState): void {
  for (const p of state.players) {
    state.pot += p.bet;
    p.bet = 0;
  }
}

function resetHand(state: HoldemState): void {
  for (const p of state.players) {
    p.hole = [];
    p.bet = 0;
    p.contributed = 0;
    p.folded = p.stack <= 0;
    p.allIn = false;
    p.sittingOut = p.stack <= 0;
  }
  state.board = [];
  state.pot = 0;
  state.winners = [];
  state.street = "preflop";
  state.log = [];
}

export function dealHand(
  state: HoldemState,
  random: () => number = Math.random,
): HoldemResult {
  const seated = state.players.filter((p) => p.stack > 0);
  if (seated.length < 2) return fail("err.needPlayers");
  resetHand(state);
  const n = state.players.length;
  state.dealerSeat = nextLiveSeat(state, state.dealerSeat, (p) => p.stack > 0) ?? 0;
  const headsUp = seated.length === 2;
  const sbSeat = headsUp
    ? state.dealerSeat
    : nextLiveSeat(state, state.dealerSeat, (p) => p.stack > 0)!;
  const bbSeat = nextLiveSeat(state, sbSeat, (p) => p.stack > 0)!;
  state.deck = shuffle(createDeck(), random);
  for (let i = 0; i < 2; i++) {
    for (let s = 0; s < n; s++) {
      const seat = (state.dealerSeat + 1 + s) % n;
      const p = state.players[seat];
      if (p.stack <= 0) continue;
      p.folded = false;
      p.hole.push(state.deck.pop()!);
    }
  }
  const sbAmt = putChips(state.players[sbSeat], state.sb);
  const bbAmt = putChips(state.players[bbSeat], state.bb);
  pushLog(state, {
    seat: sbSeat,
    name: state.players[sbSeat].name,
    kind: "sb",
    n: sbAmt,
  });
  pushLog(state, {
    seat: bbSeat,
    name: state.players[bbSeat].name,
    kind: "bb",
    n: bbAmt,
  });
  state.currentBet = Math.max(state.players[sbSeat].bet, state.players[bbSeat].bet);
  state.minRaise = state.bb;
  state.lastAggressor = bbSeat;
  state.toAct = nextLiveSeat(state, bbSeat, canAct);
  state.pending = state.players.filter(canAct).map((p) => p.seat);
  state.status = "playing";
  if (state.toAct == null) return advanceStreet(state);
  return { ok: true, state };
}

export function legalActions(state: HoldemState, seat: number): LegalActions {
  const p = state.players[seat];
  const none: LegalActions = {
    fold: false,
    check: false,
    call: 0,
    minBet: 0,
    maxBet: 0,
    canRaise: false,
  };
  if (state.status !== "playing" || state.toAct !== seat || !p || !canAct(p)) {
    return none;
  }
  const toCall = Math.max(0, state.currentBet - p.bet);
  const check = toCall === 0;
  const call = Math.min(p.stack, toCall);
  const minRaiseTo = state.currentBet + state.minRaise;
  const minBet = state.currentBet === 0 ? state.bb : minRaiseTo;
  return {
    fold: toCall > 0,
    check,
    call,
    minBet: Math.min(p.stack + p.bet, minBet),
    maxBet: p.stack + p.bet,
    canRaise: p.stack + p.bet > state.currentBet,
  };
}

function othersToAct(state: HoldemState, actor: number): number[] {
  return state.players
    .filter((p) => p.seat !== actor && canAct(p))
    .map((p) => p.seat);
}

function streetDone(state: HoldemState): boolean {
  const active = state.players.filter(inHand);
  if (active.length <= 1) return true;
  const actors = state.players.filter(canAct);
  if (actors.length === 0) return true;
  if (state.pending.length > 0) return false;
  return actors.every((p) => p.bet === state.currentBet || p.allIn);
}

function dealBoard(state: HoldemState, count: number): void {
  state.deck.pop();
  for (let i = 0; i < count; i++) {
    const card = state.deck.pop();
    if (card) state.board.push(card);
  }
}

function startStreet(state: HoldemState, street: Street): void {
  sweepBets(state);
  state.street = street;
  state.currentBet = 0;
  state.minRaise = state.bb;
  state.lastAggressor = null;
  const first = nextLiveSeat(state, state.dealerSeat, canAct);
  state.toAct = first;
  state.pending = state.players.filter(canAct).map((p) => p.seat);
  if (street !== "preflop") {
    pushLog(state, { seat: -1, name: "", kind: street });
  }
}

function awardUncontested(state: HoldemState): HoldemState {
  sweepBets(state);
  const winner = state.players.find(inHand)!;
  winner.stack += state.pot;
  state.winners = [{ seats: [winner.seat], amount: state.pot }];
  pushLog(state, {
    seat: winner.seat,
    name: winner.name,
    kind: "win",
    n: state.pot,
  });
  state.pot = 0;
  state.toAct = null;
  state.status = "handOver";
  return state;
}

function buildPots(state: HoldemState): { amount: number; seats: number[] }[] {
  const contrib = state.players.map((p) => p.contributed);
  const levels = [...new Set(contrib.filter((n) => n > 0))].sort((a, b) => a - b);
  const pots: { amount: number; seats: number[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    const layer = level - prev;
    let amount = 0;
    const seats: number[] = [];
    for (const p of state.players) {
      if (p.contributed >= level) {
        amount += layer;
        if (!p.folded) seats.push(p.seat);
      } else if (p.contributed > prev) {
        amount += p.contributed - prev;
      }
    }
    if (amount > 0 && seats.length) pots.push({ amount, seats });
    prev = level;
  }
  return pots;
}

function showdown(state: HoldemState): HoldemState {
  sweepBets(state);
  const pots = buildPots(state);
  const evs = state.players.map((p) =>
    inHand(p) && p.hole.length + state.board.length >= 5
      ? evaluateBest([...p.hole, ...state.board])
      : null,
  );
  const winners: HandWinner[] = [];
  for (const pot of pots) {
    let bestSeats: number[] = [];
    let best = evs[pot.seats[0]];
    for (const seat of pot.seats) {
      const ev = evs[seat];
      if (!ev) continue;
      if (!best || compareHands(ev, best) > 0) {
        best = ev;
        bestSeats = [seat];
      } else if (compareHands(ev, best) === 0) {
        bestSeats.push(seat);
      }
    }
    const share = Math.floor(pot.amount / bestSeats.length);
    let rem = pot.amount - share * bestSeats.length;
    const order = bestSeats
      .slice()
      .sort(
        (a, b) =>
          ((a - state.dealerSeat + state.players.length) % state.players.length) -
          ((b - state.dealerSeat + state.players.length) % state.players.length),
      );
    for (const seat of order) {
      const extra = rem > 0 ? 1 : 0;
      rem -= extra;
      state.players[seat].stack += share + extra;
    }
    winners.push({
      seats: bestSeats,
      amount: pot.amount,
      category: best?.category,
    });
  }
  state.winners = winners;
  for (const w of winners) {
    const names = w.seats
      .map((s) => state.players[s]?.name ?? "")
      .filter(Boolean)
      .join(" & ");
    pushLog(state, {
      seat: w.seats[0] ?? -1,
      name: names,
      kind: w.seats.length > 1 ? "split" : "win",
      n: w.amount,
    });
  }
  state.pot = 0;
  state.toAct = null;
  state.status = "handOver";
  return state;
}

function advanceStreet(state: HoldemState): HoldemResult {
  const remaining = state.players.filter(inHand);
  if (remaining.length <= 1) {
    return { ok: true, state: awardUncontested(state) };
  }
  const actors = state.players.filter(canAct);
  if (actors.length <= 1 && state.street !== "river") {
    if (state.street === "preflop") dealBoard(state, 3);
    if (state.street === "preflop" || state.street === "flop") dealBoard(state, 1);
    dealBoard(state, 1);
    while (state.board.length < 5) dealBoard(state, 1);
    return { ok: true, state: showdown(state) };
  }
  if (state.street === "preflop") {
    dealBoard(state, 3);
    startStreet(state, "flop");
  } else if (state.street === "flop") {
    dealBoard(state, 1);
    startStreet(state, "turn");
  } else if (state.street === "turn") {
    dealBoard(state, 1);
    startStreet(state, "river");
  } else {
    return { ok: true, state: showdown(state) };
  }
  if (state.toAct == null) return advanceStreet(state);
  return { ok: true, state };
}

function markActed(state: HoldemState, seat: number): void {
  state.pending = state.pending.filter((s) => s !== seat);
}

function reopen(state: HoldemState, actor: number): void {
  state.pending = othersToAct(state, actor);
}

export function applyAction(
  state: HoldemState,
  seat: number,
  kind: HoldemActionKind,
  raiseTo?: number,
): HoldemResult {
  if (state.status !== "playing") return fail("err.notPlaying");
  if (state.toAct !== seat) return fail("err.notYourTurn");
  const p = state.players[seat];
  if (!p || !canAct(p)) return fail("err.illegal");
  const legal = legalActions(state, seat);

  if (kind === "fold") {
    if (!legal.fold) return fail("err.illegal");
    p.folded = true;
    markActed(state, seat);
    pushLog(state, { seat, name: p.name, kind: "fold" });
  } else if (kind === "check") {
    if (!legal.check) return fail("err.illegal");
    markActed(state, seat);
    pushLog(state, { seat, name: p.name, kind: "check" });
  } else if (kind === "call") {
    if (legal.call <= 0 && !legal.check) return fail("err.illegal");
    const called = putChips(p, state.currentBet - p.bet);
    markActed(state, seat);
    pushLog(state, {
      seat,
      name: p.name,
      kind: p.allIn ? "allin" : "call",
      n: called,
    });
  } else if (kind === "bet" || kind === "raise" || kind === "allin") {
    const to = kind === "allin" ? p.stack + p.bet : Math.round(raiseTo ?? 0);
    if (to < p.bet) return fail("err.illegal");
    const add = to - p.bet;
    if (add > p.stack) return fail("err.illegal");
    const newBet = p.bet + add;
    if (kind !== "allin" && newBet < legal.minBet && newBet < legal.maxBet) {
      return fail("err.illegal");
    }
    const raiseSize = newBet - state.currentBet;
    putChips(p, add);
    if (newBet > state.currentBet) {
      if (raiseSize >= state.minRaise) state.minRaise = raiseSize;
      state.currentBet = p.bet;
      state.lastAggressor = seat;
      reopen(state, seat);
    } else {
      markActed(state, seat);
    }
    pushLog(state, {
      seat,
      name: p.name,
      kind: p.allIn || kind === "allin" ? "allin" : kind === "bet" ? "bet" : "raise",
      n: kind === "raise" || (kind === "allin" && raiseSize > 0) ? newBet : add,
    });
  } else {
    return fail("err.illegal");
  }

  const next = nextLiveSeat(state, seat, (pl) => canAct(pl) && state.pending.includes(pl.seat));
  state.toAct = next;
  if (state.players.filter(inHand).length <= 1 || streetDone(state) || state.toAct == null) {
    return advanceStreet(state);
  }
  return { ok: true, state };
}

export function rebuy(state: HoldemState, seat: number): HoldemResult {
  const p = state.players[seat];
  if (!p) return fail("err.seat");
  if (state.status === "playing") return fail("err.notPlaying");
  if (p.stack > 0) return fail("err.illegal");
  p.stack = state.startStack;
  p.sittingOut = false;
  p.folded = false;
  return { ok: true, state };
}
