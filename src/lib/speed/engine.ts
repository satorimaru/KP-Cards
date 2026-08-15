import { createDeck, shuffle } from "@/lib/tienlen/deck";
import { sameCard, type Card } from "@/lib/tienlen/types";
import { cardsAdjacent, sortSpeedHand } from "./ranks";
import {
  SPEED_DEAL,
  SPEED_HAND,
  SPEED_SORT_MS,
  SPEED_STOCK,
  type SpeedFail,
  type SpeedPile,
  type SpeedPlay,
  type SpeedPlayerState,
  type SpeedResult,
  type SpeedState,
} from "./types";

export type { SpeedResult, SpeedState };

function fail(error: SpeedFail["error"]): SpeedFail {
  return { ok: false, error };
}

export function remainingOf(player: SpeedPlayerState): number {
  return player.hand.length + player.pile.length;
}

export function isSorting(player: SpeedPlayerState, now: number): boolean {
  return player.sortUntil > now;
}

function takePlayer(
  state: SpeedState,
  seat: number,
): SpeedFail | { player: SpeedPlayerState; seat: 0 | 1 } {
  if (seat !== 0 && seat !== 1) return fail("err.seat");
  return { player: state.players[seat], seat };
}

export function legalPlays(state: SpeedState, seat: 0 | 1): SpeedPlay[] {
  if (state.status !== "playing") return [];
  const player = state.players[seat];
  const plays: SpeedPlay[] = [];
  for (const card of player.hand) {
    for (const pile of [0, 1] as const) {
      const live = state.piles[pile].live;
      if (live && cardsAdjacent(card, live)) {
        plays.push({ card, pile });
      }
    }
  }
  return plays;
}

export function hasLegalPlay(state: SpeedState, seat: 0 | 1): boolean {
  return legalPlays(state, seat).length > 0;
}

export function dealSpeed(random: () => number = Math.random): SpeedState {
  const deck = shuffle(createDeck(), random);
  const p0 = deck.slice(0, SPEED_DEAL);
  const p1 = deck.slice(SPEED_DEAL, SPEED_DEAL * 2);
  const s0 = deck.slice(SPEED_DEAL * 2, SPEED_DEAL * 2 + SPEED_STOCK);
  const s1 = deck.slice(SPEED_DEAL * 2 + SPEED_STOCK);

  const makePlayer = (cards: Card[]): SpeedPlayerState => ({
    hand: cards.slice(0, SPEED_HAND),
    pile: cards.slice(SPEED_HAND),
    next: false,
    sortUntil: 0,
    ready: false,
  });

  return {
    status: "waiting",
    piles: [
      { stock: s0, live: null, played: [] },
      { stock: s1, live: null, played: [] },
    ],
    players: [makePlayer(p0), makePlayer(p1)],
    winnerSeat: null,
  };
}

function requireLive(
  state: SpeedState,
  seat: 0 | 1,
  now: number,
): SpeedFail | SpeedPlayerState {
  if (state.status === "finished") return fail("err.finished");
  if (state.status !== "playing") return fail("err.notPlaying");
  const player = state.players[seat];
  if (isSorting(player, now)) return fail("err.sorting");
  return player;
}

function withPlayer(
  state: SpeedState,
  seat: 0 | 1,
  player: SpeedPlayerState,
): SpeedState {
  const players: SpeedState["players"] = [state.players[0], state.players[1]];
  players[seat] = player;
  return { ...state, players };
}

export function setReady(
  state: SpeedState,
  seat: 0 | 1,
  ready: boolean,
): SpeedResult {
  if (state.status === "finished") return fail("err.finished");
  if (state.status === "playing") return fail("err.notPlaying");
  const checked = takePlayer(state, seat);
  if ("error" in checked) return checked;
  let next = withPlayer(state, checked.seat, { ...checked.player, ready });
  if (next.players[0].ready && next.players[1].ready) {
    next = {
      ...flipLives(next),
      status: "playing",
      players: [
        { ...next.players[0], ready: false, next: false },
        { ...next.players[1], ready: false, next: false },
      ],
    };
  }
  return { ok: true, state: next };
}

function flipOneFromStock(pile: SpeedPile): SpeedPile {
  const stock = [...pile.stock];
  const played = [...pile.played];
  if (pile.live) played.push(pile.live);
  const live = stock.shift() ?? null;
  return { stock, live, played };
}

function recyclePile(pile: SpeedPile): SpeedPile {
  const stacked = [
    ...pile.played,
    ...(pile.live ? [pile.live] : []),
  ];
  const live = stacked[0] ?? null;
  return { stock: stacked.slice(1), live, played: [] };
}

export function flipLives(state: SpeedState): SpeedState {
  const stocksEmpty = state.piles.every((p) => p.stock.length === 0);
  const piles: SpeedState["piles"] = stocksEmpty
    ? [recyclePile(state.piles[0]), recyclePile(state.piles[1])]
    : [flipOneFromStock(state.piles[0]), flipOneFromStock(state.piles[1])];
  return {
    ...state,
    piles,
    players: [
      { ...state.players[0], next: false },
      { ...state.players[1], next: false },
    ],
  };
}

export function playCard(
  state: SpeedState,
  seat: 0 | 1,
  card: Card,
  pileIndex: 0 | 1,
  now: number = Date.now(),
): SpeedResult {
  const playerOrErr = requireLive(state, seat, now);
  if ("error" in playerOrErr) return playerOrErr;
  const player = playerOrErr;
  const handIndex = player.hand.findIndex((c) => sameCard(c, card));
  if (handIndex < 0) return fail("err.cardsNotInHand");
  const pile = state.piles[pileIndex];
  if (!pile.live) return fail("err.noLive");
  if (!cardsAdjacent(card, pile.live)) return fail("err.notAdjacent");

  const hand = player.hand.filter((_, i) => i !== handIndex);
  const nextPlayer: SpeedPlayerState = { ...player, hand, next: false };
  const nextPile: SpeedPile = {
    stock: pile.stock,
    live: card,
    played: [...pile.played, pile.live],
  };
  const piles: SpeedState["piles"] = [state.piles[0], state.piles[1]];
  piles[pileIndex] = nextPile;
  let next: SpeedState = {
    ...withPlayer(state, seat, nextPlayer),
    piles,
  };
  if (remainingOf(nextPlayer) === 0) {
    next = { ...next, status: "finished", winnerSeat: seat };
  }
  return { ok: true, state: next };
}

export function drawCard(
  state: SpeedState,
  seat: 0 | 1,
  now: number = Date.now(),
): SpeedResult {
  const playerOrErr = requireLive(state, seat, now);
  if ("error" in playerOrErr) return playerOrErr;
  const player = playerOrErr;
  if (player.hand.length >= SPEED_HAND) return fail("err.handFull");
  if (player.pile.length === 0) return fail("err.pileEmpty");
  const [drawn, ...rest] = player.pile;
  return {
    ok: true,
    state: withPlayer(state, seat, {
      ...player,
      hand: [...player.hand, drawn],
      pile: rest,
      next: false,
    }),
  };
}

export function sortHand(
  state: SpeedState,
  seat: 0 | 1,
  now: number = Date.now(),
): SpeedResult {
  const playerOrErr = requireLive(state, seat, now);
  if ("error" in playerOrErr) return playerOrErr;
  const player = playerOrErr;
  return {
    ok: true,
    state: withPlayer(state, seat, {
      ...player,
      hand: sortSpeedHand(player.hand),
      sortUntil: now + SPEED_SORT_MS,
    }),
  };
}

export function signalNext(
  state: SpeedState,
  seat: 0 | 1,
  now: number = Date.now(),
): SpeedResult {
  const playerOrErr = requireLive(state, seat, now);
  if ("error" in playerOrErr) return playerOrErr;
  if (hasLegalPlay(state, seat)) return fail("err.havePlay");
  if (playerOrErr.next) return fail("err.alreadyNext");
  let next = withPlayer(state, seat, { ...playerOrErr, next: true });
  if (next.players[0].next && next.players[1].next) {
    next = flipLives(next);
  }
  return { ok: true, state: next };
}


