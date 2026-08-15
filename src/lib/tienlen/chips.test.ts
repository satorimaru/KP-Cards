import { describe, expect, it } from "vitest";
import { chipPayouts, parseStartChips, settleChips } from "./chips";

describe("chips", () => {
  it("parses a starting stack between 1 and 99", () => {
    expect(parseStartChips(10)).toBe(10);
    expect(parseStartChips(0)).toBe(1);
    expect(parseStartChips(200)).toBe(99);
    expect(parseStartChips("20")).toBe(20);
    expect(parseStartChips(undefined)).toBe(10);
  });

  it("settles a 4-player table: 4th→1st 2, 3rd→2nd 1", () => {
    const { chips, pays } = settleChips([10, 10, 10, 10], [0, 1, 2, 3]);
    expect(chips).toEqual([12, 11, 9, 8]);
    expect(pays).toEqual([
      { fromSeat: 3, toSeat: 0, amount: 2 },
      { fromSeat: 2, toSeat: 1, amount: 1 },
    ]);
    expect(chipPayouts(4)).toHaveLength(2);
  });

  it("settles a 3-player table: 3rd→1st 2, 2nd sits", () => {
    const { chips, pays } = settleChips([10, 10, 10], [1, 0, 2]);
    expect(chips).toEqual([10, 12, 8]);
    expect(pays).toEqual([{ fromSeat: 2, toSeat: 1, amount: 2 }]);
  });

  it("settles a 2-player table: loser→winner 2", () => {
    const { chips, pays } = settleChips([10, 10], [1, 0]);
    expect(chips).toEqual([8, 12]);
    expect(pays).toEqual([{ fromSeat: 0, toSeat: 1, amount: 2 }]);
  });

  it("pays only what the loser still holds", () => {
    const { chips, pays } = settleChips([10, 10, 10, 1], [0, 1, 2, 3]);
    expect(chips).toEqual([11, 11, 9, 0]);
    expect(pays[0]).toEqual({ fromSeat: 3, toSeat: 0, amount: 1 });
  });

  it("skips a pay when the loser is already broke", () => {
    const { chips, pays } = settleChips([10, 10, 10, 0], [0, 1, 2, 3]);
    expect(chips).toEqual([10, 11, 9, 0]);
    expect(pays).toEqual([{ fromSeat: 2, toSeat: 1, amount: 1 }]);
  });

  it("has no payouts for a one-player table", () => {
    expect(chipPayouts(1)).toEqual([]);
    expect(settleChips([10], [0]).pays).toEqual([]);
  });
});
