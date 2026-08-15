import { cardsPerHand, DEFAULT_RULES, type GameRules } from "@/lib/rules";
import {
  type Card,
  isThreeSpades,
  RANKS,
  sortCards,
  SUITS,
} from "./types";

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle (mutates and returns). */
export function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickReplaceIndex(deck: Card[], random: () => number): number {
  const options: number[] = [];
  for (let i = 0; i < deck.length; i++) {
    const card = deck[i];
    if (card.kind && card.kind !== "std") continue;
    if (isThreeSpades(card)) continue;
    options.push(i);
  }
  const pool = options.length > 0 ? options : deck.map((_, i) => i);
  return pool[Math.floor(random() * pool.length)] ?? 0;
}

export function applyModeCards(
  deck: Card[],
  random: () => number,
  rules: GameRules,
): Card[] {
  const next = [...deck];

  const replace = (count: number, make: (i: number) => Card) => {
    for (let i = 0; i < count; i++) {
      const idx = pickReplaceIndex(next, random);
      next[idx] = make(i);
    }
  };

  if (rules.chaos) {
    replace(2, (i) => ({
      rank: "3",
      suit: "S",
      kind: "joker",
      token: `JK${i + 1}`,
    }));
  }

  if (rules.uno) {
    next.push(
      { rank: "3", suit: "S", kind: "skip", token: "SK1" },
      { rank: "3", suit: "S", kind: "reverse", token: "RV1" },
      { rank: "3", suit: "S", kind: "draw2", token: "D2" },
      { rank: "3", suit: "S", kind: "draw4", token: "D4" },
    );
  }

  return next;
}

/**
 * Deal equal hands for 2–4 players.
 * Chaos replaces two cards with jokers. Uno adds skip / reverse / +2 / +4
 * and deals 14 each. Leftover cards become the draw stock.
 */
export function dealTable(
  playerCount: number,
  random: () => number = Math.random,
  rules: GameRules = DEFAULT_RULES,
): { hands: Card[][]; stock: Card[] } {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error("playerCount must be 2–4");
  }

  const deck = shuffle(applyModeCards(createDeck(), random, rules), random);
  const perHand = cardsPerHand(playerCount, rules);

  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let i = 0;
  for (let p = 0; p < playerCount; p++) {
    for (let c = 0; c < perHand; c++) {
      hands[p].push(deck[i++]);
    }
  }

  return {
    hands: hands.map((h) => sortCards(h)),
    stock: deck.slice(i),
  };
}

export function dealHands(
  playerCount: number,
  random: () => number = Math.random,
  rules: GameRules = DEFAULT_RULES,
): Card[][] {
  return dealTable(playerCount, random, rules).hands;
}
