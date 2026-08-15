import { describe, expect, it } from "vitest";
import { handStateFromHands } from "./engine";
import { enumerateCombos, legalPlays } from "./plays";
import type { Card } from "./types";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("enumerateCombos", () => {
  it("finds singles, pairs, and a sequence", () => {
    const combos = enumerateCombos([
      c("3", "S"),
      c("3", "H"),
      c("4", "D"),
      c("5", "C"),
    ]);
    expect(combos.some((x) => x.type === "single")).toBe(true);
    expect(combos.some((x) => x.type === "pair" && x.highCard.rank === "3")).toBe(
      true,
    );
    expect(combos.some((x) => x.type === "sequence" && x.length === 3)).toBe(
      true,
    );
  });

  it("finds a three-pair chop", () => {
    const combos = enumerateCombos([
      c("3", "S"),
      c("3", "H"),
      c("4", "C"),
      c("4", "D"),
      c("5", "S"),
      c("5", "H"),
    ]);
    expect(
      combos.some((x) => x.type === "double_sequence" && x.length === 3),
    ).toBe(true);
  });
});

describe("legalPlays", () => {
  it("requires the opening lead card", () => {
    const state = handStateFromHands([
      [c("3", "S"), c("9", "H"), c("K", "D")],
      [c("4", "H"), c("5", "H"), c("6", "H")],
    ]);
    const plays = legalPlays(state, 0);
    expect(plays.length).toBeGreaterThan(0);
    expect(plays.every((p) => p.cards.some((card) => card.rank === "3" && card.suit === "S"))).toBe(
      true,
    );
  });
});
