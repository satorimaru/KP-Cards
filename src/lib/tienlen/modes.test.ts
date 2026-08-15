import { describe, expect, it } from "vitest";
import { detectCombo } from "./combos";
import {
  applyPlay,
  createHandState,
  handStateFromHands,
  isGameFinished,
  unoTargetSeat,
  validatePlay,
} from "./engine";
import type { Card } from "./types";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const joker = (n: number): Card => ({
  rank: "3",
  suit: "S",
  kind: "joker",
  token: `JK${n}`,
});

const skip = (n: number): Card => ({
  rank: "3",
  suit: "S",
  kind: "skip",
  token: `SK${n}`,
});

const reverse = (n: number): Card => ({
  rank: "3",
  suit: "S",
  kind: "reverse",
  token: `RV${n}`,
});

describe("chaos jokers", () => {
  it("lets a named joker complete a pair but not a quad, and never a 2", () => {
    expect(detectCombo([joker(1), c("5", "S")])).toBeNull();

    const pair = detectCombo([
      { ...joker(1), as: { rank: "5", suit: "H" } },
      c("5", "S"),
    ]);
    expect(pair?.type).toBe("pair");

    const asTwo = detectCombo([
      { ...joker(1), as: { rank: "2", suit: "H" } },
    ]);
    expect(asTwo).toBeNull();

    const quad = detectCombo([
      { ...joker(1), as: { rank: "5", suit: "H" } },
      c("5", "S"),
      c("5", "C"),
      c("5", "D"),
    ]);
    expect(quad).toBeNull();
  });

  it("deals two jokers in chaos mode", () => {
    const state = createHandState(4, () => 0.4, {
      threePlayerSeventeen: true,
      noFinishOnTwo: false,
      chaos: true,
      blitz: false,
      siege: false,
      uno: false,
    });
    const jokers = state.hands.flat().filter((card) => card.kind === "joker");
    expect(jokers).toHaveLength(2);
  });

  it("rejects a joker play until a non-2 face is named", () => {
    const wild = joker(1);
    const state = handStateFromHands(
      [
        [wild, c("9", "H")],
        [c("3", "S"), c("5", "D")],
      ],
      { chaos: true },
    );
    state.currentSeat = 0;
    state.leadCard = null;
    expect(validatePlay(state, 0, [wild]).ok).toBe(false);
    expect(
      validatePlay(state, 0, [{ ...wild, as: { rank: "2", suit: "H" } }]).ok,
    ).toBe(false);
    expect(
      validatePlay(state, 0, [{ ...wild, as: { rank: "9", suit: "S" } }]).ok,
    ).toBe(true);
  });
});

describe("Uno skip, reverse, and draws", () => {
  it("skips the next seat", () => {
    const rules = {
      threePlayerSeventeen: true,
      noFinishOnTwo: false,
      chaos: false,
      blitz: false,
      siege: false,
      uno: true,
    };
    const state = handStateFromHands(
      [
        [skip(1), c("9", "H")],
        [c("4", "H"), c("5", "H")],
        [c("6", "H"), c("7", "H")],
      ],
      rules,
    );
    state.currentSeat = 0;
    state.leadCard = null;
    expect(validatePlay(state, 0, [skip(1)]).ok).toBe(false);
    const next = applyPlay(state, 0, [c("9", "H"), skip(1)]);
    expect(next.pile?.type).toBe("single");
    expect(next.pile?.uno).toBe("skip");
    expect(next.currentSeat).toBe(2);
    expect(unoTargetSeat(next, 0, "skip")).toBe(1);
  });

  it("reverses play direction", () => {
    const rules = {
      threePlayerSeventeen: true,
      noFinishOnTwo: false,
      chaos: false,
      blitz: false,
      siege: false,
      uno: true,
    };
    const state = handStateFromHands(
      [
        [reverse(1), c("3", "S")],
        [c("4", "H"), c("5", "H")],
        [c("6", "H"), c("7", "H")],
      ],
      rules,
    );
    // 3S is in seat 0, they lead.
    expect(state.currentSeat).toBe(0);
    const next = applyPlay(state, 0, [c("3", "S"), reverse(1)]);
    expect(next.direction).toBe(-1);
    expect(next.currentSeat).toBe(2);
    expect(next.pile?.type).toBe("single");
    expect(next.pile?.uno).toBe("reverse");
  });

  it("adds four uno cards and deals 14 without replacing the deck", () => {
    const state = createHandState(4, () => 0.4, {
      threePlayerSeventeen: true,
      noFinishOnTwo: false,
      chaos: false,
      blitz: false,
      siege: false,
      uno: true,
    });
    const all = state.hands.flat();
    expect(all).toHaveLength(56);
    expect(state.hands.every((hand) => hand.length === 14)).toBe(true);
    expect(state.stock).toHaveLength(0);
    expect(all.filter((card) => card.kind === "skip")).toHaveLength(1);
    expect(all.filter((card) => card.kind === "reverse")).toHaveLength(1);
    expect(all.filter((card) => card.kind === "draw2")).toHaveLength(1);
    expect(all.filter((card) => card.kind === "draw4")).toHaveLength(1);
    expect(
      all.some(
        (card) =>
          card.rank === "3" && card.suit === "S" && (!card.kind || card.kind === "std"),
      ),
    ).toBe(true);
  });

  it("deals 14 in 2- and 3-player uno, even if 17 is on", () => {
    const two = createHandState(2, () => 0.4, { uno: true });
    expect(two.hands.every((hand) => hand.length === 14)).toBe(true);
    expect(two.stock).toHaveLength(28);

    const three = createHandState(3, () => 0.4, {
      uno: true,
      threePlayerSeventeen: true,
    });
    expect(three.hands.every((hand) => hand.length === 14)).toBe(true);
    expect(three.stock).toHaveLength(14);
  });

  it("makes the next seat draw two and still take their turn", () => {
    const draw2: Card = {
      rank: "3",
      suit: "S",
      kind: "draw2",
      token: "D2",
    };
    const state = handStateFromHands(
      [
        [draw2, c("9", "H")],
        [c("4", "H")],
        [c("6", "H"), c("7", "H")],
      ],
      { uno: true },
      [c("8", "S"), c("8", "C"), c("8", "D")],
    );
    state.currentSeat = 0;
    state.leadCard = null;
    const next = applyPlay(state, 0, [c("9", "H"), draw2]);
    expect(next.hands[1]).toHaveLength(3);
    expect(next.currentSeat).toBe(1);
    expect(next.stock).toHaveLength(1);
    expect(next.pile?.uno).toBe("draw2");
    expect(next.discard.some((card) => card.token === "D2")).toBe(false);
  });

  it("recycles discarded cards when the stock is empty", () => {
    const draw4: Card = {
      rank: "3",
      suit: "S",
      kind: "draw4",
      token: "D4",
    };
    const state = handStateFromHands(
      [
        [draw4, c("9", "H")],
        [c("4", "H")],
        [c("6", "H"), c("7", "H")],
      ],
      { uno: true },
    );
    state.currentSeat = 0;
    state.leadCard = null;
    state.stock = [];
    const namedJoker: Card = {
      rank: "3",
      suit: "S",
      kind: "joker",
      token: "JK1",
      as: { rank: "9", suit: "H" },
    };
    state.discard = [c("5", "S"), c("5", "C"), c("5", "D"), namedJoker];
    const next = applyPlay(state, 0, [c("9", "H"), draw4]);
    expect(next.hands[1]).toHaveLength(5);
    expect(next.currentSeat).toBe(1);
    expect(next.pile?.uno).toBe("draw4");
    const drawn = next.hands[1].find((card) => card.token === "JK1");
    expect(drawn).toBeTruthy();
    expect(drawn?.as).toBeUndefined();
  });
});

describe("team siege", () => {
  it("ends when both partners are out", () => {
    const rules = {
      threePlayerSeventeen: true,
      noFinishOnTwo: false,
      chaos: false,
      blitz: false,
      siege: true,
      uno: false,
    };
    const state = handStateFromHands(
      [
        [c("3", "S")],
        [c("4", "H"), c("8", "H")],
        [c("5", "D")],
        [c("6", "C"), c("9", "C")],
      ],
      rules,
    );
    expect(isGameFinished(state)).toBe(false);
    state.finishOrder = [0, 2];
    expect(isGameFinished(state)).toBe(true);
  });
});
