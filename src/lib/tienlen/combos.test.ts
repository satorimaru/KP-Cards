import { describe, expect, it } from "vitest";
import { beats, detectCombo } from "./combos";
import type { Card } from "./types";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("detectCombo", () => {
  it("detects singles, pairs, triples, and quads", () => {
    expect(detectCombo([c("7", "H")])?.type).toBe("single");
    expect(detectCombo([c("7", "S"), c("7", "H")])?.type).toBe("pair");
    expect(detectCombo([c("7", "S"), c("7", "C"), c("7", "H")])?.type).toBe(
      "triple",
    );
    expect(
      detectCombo([c("7", "S"), c("7", "C"), c("7", "D"), c("7", "H")])?.type,
    ).toBe("quad");
  });

  it("detects sequences and rejects 2s or gaps", () => {
    expect(
      detectCombo([c("3", "S"), c("4", "H"), c("5", "D")])?.type,
    ).toBe("sequence");
    expect(detectCombo([c("3", "S"), c("4", "H"), c("6", "D")])).toBeNull();
    expect(detectCombo([c("A", "S"), c("2", "H"), c("3", "D")])).toBeNull();
  });

  it("keeps a named joker in rank order inside a sequence", () => {
    const joker: Card = {
      rank: "3",
      suit: "S",
      kind: "joker",
      token: "JK1",
      as: { rank: "8", suit: "H" },
    };
    const seq = detectCombo([c("7", "S"), c("9", "D"), joker]);
    expect(seq?.type).toBe("sequence");
    expect(seq?.cards.map((card) => card.kind === "joker" ? "J" : card.rank)).toEqual([
      "7",
      "J",
      "9",
    ]);
  });

  it("detects double sequences of 3+ pairs", () => {
    const chop = detectCombo([
      c("3", "S"),
      c("3", "H"),
      c("4", "C"),
      c("4", "D"),
      c("5", "S"),
      c("5", "H"),
    ]);
    expect(chop?.type).toBe("double_sequence");
    expect(chop?.length).toBe(3);
  });
});

describe("beats", () => {
  it("requires the same shape and a higher top card", () => {
    const low = detectCombo([c("5", "S")])!;
    const high = detectCombo([c("9", "D")])!;
    const pair = detectCombo([c("9", "S"), c("9", "H")])!;
    expect(beats(high, low)).toBe(true);
    expect(beats(low, high)).toBe(false);
    expect(beats(pair, low)).toBe(false);
  });

  it("lets a quad or 3-pair chop beat a single 2", () => {
    const two = detectCombo([c("2", "S")])!;
    const quad = detectCombo([c("4", "S"), c("4", "C"), c("4", "D"), c("4", "H")])!;
    const chop = detectCombo([
      c("3", "S"),
      c("3", "H"),
      c("4", "C"),
      c("4", "D"),
      c("5", "S"),
      c("5", "H"),
    ])!;
    expect(beats(quad, two)).toBe(true);
    expect(beats(chop, two)).toBe(true);
  });

  it("lets longer chops beat pairs and triples of 2s", () => {
    const pairTwos = detectCombo([c("2", "S"), c("2", "H")])!;
    const fourPairs = detectCombo([
      c("3", "S"),
      c("3", "H"),
      c("4", "C"),
      c("4", "D"),
      c("5", "S"),
      c("5", "H"),
      c("6", "C"),
      c("6", "D"),
    ])!;
    const threePairs = detectCombo([
      c("3", "S"),
      c("3", "H"),
      c("4", "C"),
      c("4", "D"),
      c("5", "S"),
      c("5", "H"),
    ])!;
    expect(beats(fourPairs, pairTwos)).toBe(true);
    expect(beats(threePairs, pairTwos)).toBe(false);
  });
});
