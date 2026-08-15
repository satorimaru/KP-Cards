import { describe, expect, it } from "vitest";
import { compareHands, evaluate5, evaluateBest } from "./ranks";
import type { Card, Rank, Suit } from "@/lib/tienlen/types";

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

describe("holdem hands", () => {
  it("ranks a wheel straight below six-high", () => {
    const wheel = evaluate5([
      c("A", "S"),
      c("2", "H"),
      c("3", "C"),
      c("4", "D"),
      c("5", "S"),
    ]);
    const six = evaluate5([
      c("2", "S"),
      c("3", "H"),
      c("4", "C"),
      c("5", "D"),
      c("6", "S"),
    ]);
    expect(wheel.category).toBe("straight");
    expect(six.category).toBe("straight");
    expect(compareHands(six, wheel)).toBeGreaterThan(0);
  });

  it("detects flush, full house, and quads", () => {
    expect(
      evaluate5([c("2", "H"), c("7", "H"), c("9", "H"), c("J", "H"), c("K", "H")])
        .category,
    ).toBe("flush");
    expect(
      evaluate5([c("9", "H"), c("9", "S"), c("9", "C"), c("4", "D"), c("4", "H")])
        .category,
    ).toBe("full_house");
    expect(
      evaluate5([c("A", "H"), c("A", "S"), c("A", "C"), c("A", "D"), c("2", "H")])
        .category,
    ).toBe("quads");
  });

  it("picks the best five from seven", () => {
    const ev = evaluateBest([
      c("A", "H"),
      c("A", "S"),
      c("K", "H"),
      c("K", "S"),
      c("K", "C"),
      c("2", "D"),
      c("3", "D"),
    ]);
    expect(ev.category).toBe("full_house");
    expect(ev.kickers[0]).toBe(13);
    expect(ev.kickers[1]).toBe(14);
  });

  it("ranks a royal as a straight flush", () => {
    const royal = evaluate5([
      c("10", "S"),
      c("J", "S"),
      c("Q", "S"),
      c("K", "S"),
      c("A", "S"),
    ]);
    expect(royal.category).toBe("straight_flush");
    expect(royal.kickers[0]).toBe(14);
  });
});
