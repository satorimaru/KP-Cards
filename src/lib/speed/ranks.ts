import { suitIndex, type Card, type Rank } from "@/lib/tienlen/types";

/** Ace through King, wrapping. Ace sits next to King and 2. */
export const SPEED_RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function speedRankIndex(rank: Rank): number {
  return SPEED_RANKS.indexOf(rank);
}

export function ranksAdjacent(a: Rank, b: Rank): boolean {
  const i = speedRankIndex(a);
  const j = speedRankIndex(b);
  if (i < 0 || j < 0) return false;
  const n = SPEED_RANKS.length;
  return (i + 1) % n === j || (j + 1) % n === i;
}

export function cardsAdjacent(a: Card, b: Card): boolean {
  return ranksAdjacent(a.rank, b.rank);
}

export function sortSpeedHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const byRank = speedRankIndex(a.rank) - speedRankIndex(b.rank);
    if (byRank !== 0) return byRank;
    return suitIndex(a.suit) - suitIndex(b.suit);
  });
}
