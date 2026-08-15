import type { Card, Rank, Suit } from "@/lib/tienlen/types";

export type HandCategory =
  | "high"
  | "pair"
  | "two_pair"
  | "trips"
  | "straight"
  | "flush"
  | "full_house"
  | "quads"
  | "straight_flush";

export const HAND_CATEGORIES: HandCategory[] = [
  "high",
  "pair",
  "two_pair",
  "trips",
  "straight",
  "flush",
  "full_house",
  "quads",
  "straight_flush",
];

export interface EvaluatedHand {
  category: HandCategory;
  /** Five ranks high-first for lexicographic compare. */
  kickers: number[];
}

export function pokerValue(rank: Rank): number {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "10") return 10;
  return Number(rank);
}

function combo5<T>(items: T[]): T[][] {
  const out: T[][] = [];
  const n = items.length;
  if (n < 5) return out;
  if (n === 5) return [items.slice()];
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            out.push([items[a], items[b], items[c], items[d], items[e]]);
          }
        }
      }
    }
  }
  return out;
}

function straightHigh(values: number[]): number | null {
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  if (uniq.includes(14)) uniq.push(1);
  for (let i = 0; i <= uniq.length - 5; i++) {
    const slice = uniq.slice(i, i + 5);
    if (slice[0] - slice[4] === 4 && new Set(slice).size === 5) {
      return slice[0] === 14 && slice[1] === 5 ? 5 : slice[0];
    }
  }
  return null;
}

export function evaluate5(cards: Card[]): EvaluatedHand {
  const values = cards.map((c) => pokerValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);
  const sHigh = straightHigh(values);
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  if (flush && sHigh != null) {
    return { category: "straight_flush", kickers: [sHigh] };
  }
  if (groups[0][1] === 4) {
    return { category: "quads", kickers: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
    return { category: "full_house", kickers: [groups[0][0], groups[1][0]] };
  }
  if (flush) {
    return { category: "flush", kickers: values };
  }
  if (sHigh != null) {
    return { category: "straight", kickers: [sHigh] };
  }
  if (groups[0][1] === 3) {
    return {
      category: "trips",
      kickers: [groups[0][0], ...groups.slice(1).map((g) => g[0])],
    };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return { category: "two_pair", kickers: [...pairs, groups[2][0]] };
  }
  if (groups[0][1] === 2) {
    return {
      category: "pair",
      kickers: [groups[0][0], ...groups.slice(1).map((g) => g[0])],
    };
  }
  return { category: "high", kickers: values };
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  const ca = HAND_CATEGORIES.indexOf(a.category);
  const cb = HAND_CATEGORIES.indexOf(b.category);
  if (ca !== cb) return ca - cb;
  const n = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < n; i++) {
    const d = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function evaluateBest(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    const vals = cards.map((c) => pokerValue(c.rank)).sort((a, b) => b - a);
    return { category: "high", kickers: vals };
  }
  let best: EvaluatedHand | null = null;
  for (const five of combo5(cards)) {
    const ev = evaluate5(five);
    if (!best || compareHands(ev, best) > 0) best = ev;
  }
  return best!;
}

export function suited(cards: Card[]): boolean {
  return cards.length >= 2 && cards.every((c) => c.suit === cards[0].suit);
}
