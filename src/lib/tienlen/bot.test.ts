import { describe, expect, it } from "vitest";
import { chooseBotAction } from "./bot";
import {
  applyPass,
  applyPlay,
  createHandState,
  handStateFromHands,
  isGameFinished,
} from "./engine";
import type { Card } from "./types";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function mulberry(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("chooseBotAction", () => {
  it("includes the opening lead card", () => {
    const state = handStateFromHands([
      [c("3", "S"), c("9", "H"), c("K", "D")],
      [c("4", "H"), c("5", "H"), c("6", "H")],
    ]);
    const action = chooseBotAction(state, 0);
    expect(action.type).toBe("play");
    if (action.type === "play") {
      expect(
        action.cards.some((card) => card.rank === "3" && card.suit === "S"),
      ).toBe(true);
    }
  });

  it("beats a single when it can, and passes when it cannot", () => {
    let state = handStateFromHands([
      [c("3", "S"), c("4", "C")],
      [c("5", "H"), c("K", "D")],
    ]);
    state = applyPlay(state, 0, [c("3", "S")]);
    const beat = chooseBotAction(state, 1);
    expect(beat.type).toBe("play");
    if (beat.type === "play") {
      expect(beat.cards).toEqual([c("5", "H")]);
    }

    state = applyPlay(state, 1, [c("K", "D")]);
    const stuck = chooseBotAction(state, 0);
    expect(stuck).toEqual({ type: "pass" });
  });

  it("never passes on a free lead", () => {
    const state = handStateFromHands([
      [c("3", "S"), c("9", "H")],
      [c("4", "H"), c("5", "H")],
    ]);
    expect(chooseBotAction(state, 0).type).toBe("play");
  });

  it("can finish 2–4 player hands with only bot seats", () => {
    for (const players of [2, 3, 4] as const) {
      for (const seed of [1, 7, 42, 99]) {
        let state = createHandState(players, mulberry(seed));
        let guard = 0;
        while (!isGameFinished(state) && guard++ < 800) {
          const seat = state.currentSeat;
          const action = chooseBotAction(state, seat);
          state =
            action.type === "pass"
              ? applyPass(state, seat)
              : applyPlay(state, seat, action.cards);
        }
        expect(isGameFinished(state), `players=${players} seed=${seed}`).toBe(
          true,
        );
        expect(state.finishOrder).toHaveLength(players);
      }
    }
  });
});
