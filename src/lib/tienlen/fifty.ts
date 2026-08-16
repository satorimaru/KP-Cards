import type { Card } from "./types";

export const FIFTY_LIMIT = 50;

/** First out scores 0. Everyone else scores leftover card count. */
export function leftoverPoints(hands: Card[][], finishOrder: number[]): number[] {
  const first = finishOrder[0];
  return hands.map((hand, seat) => (seat === first ? 0 : hand.length));
}

export function addFiftyScores(scores: number[], points: number[]): number[] {
  const n = Math.max(scores.length, points.length);
  return Array.from({ length: n }, (_, i) => (scores[i] ?? 0) + (points[i] ?? 0));
}

export function fiftyMatchOver(scores: number[]): boolean {
  return scores.some((n) => n >= FIFTY_LIMIT);
}

/** Seats tied for the lowest score. Empty if the match is still going. */
export function fiftyWinnerSeats(scores: number[]): number[] {
  if (!fiftyMatchOver(scores)) return [];
  const low = Math.min(...scores);
  return scores
    .map((n, i) => (n === low ? i : -1))
    .filter((i) => i >= 0);
}
