import { describe, expect, it } from "vitest";
import {
  FIFTY_LIMIT,
  addFiftyScores,
  fiftyMatchOver,
  fiftyWinnerSeats,
  leftoverPoints,
} from "./fifty";
import type { Card } from "./types";

function nCards(n: number): Card[] {
  return Array.from({ length: n }, () => ({ rank: "3", suit: "S" }) as Card);
}

describe("fifty scoring", () => {
  it("gives the first-out player 0 and others their leftover count", () => {
    expect(leftoverPoints([nCards(0), nCards(4), nCards(7)], [1])).toEqual([
      0, 0, 7,
    ]);
    expect(leftoverPoints([nCards(0), nCards(4), nCards(7)], [0])).toEqual([
      0, 4, 7,
    ]);
  });

  it("ends the match when someone reaches 50, lowest score wins", () => {
    const scores = addFiftyScores([48, 12, 30], [3, 0, 2]);
    expect(scores).toEqual([51, 12, 32]);
    expect(fiftyMatchOver(scores)).toBe(true);
    expect(fiftyWinnerSeats(scores)).toEqual([1]);
    expect(fiftyMatchOver([49, 20])).toBe(false);
    expect(fiftyWinnerSeats([49, 20])).toEqual([]);
    expect(FIFTY_LIMIT).toBe(50);
  });

  it("treats a lowest-score tie as shared winners", () => {
    expect(fiftyWinnerSeats([50, 12, 12])).toEqual([1, 2]);
  });
});
