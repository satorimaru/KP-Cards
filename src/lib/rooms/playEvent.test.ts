import { describe, expect, it } from "vitest";
import { handStateFromHands } from "@/lib/tienlen/engine";
import type { Card } from "@/lib/tienlen/types";
import { playEventSignature } from "@/components/fxEvent";
import { makePlayEvent } from "./playEvent";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

const draw4: Card = {
  rank: "3",
  suit: "S",
  kind: "draw4",
  token: "D4",
};

const players = [
  { id: "a", seat: 0 },
  { id: "b", seat: 1 },
];

describe("makePlayEvent", () => {
  it("does not treat a +4 attach as a bomb", () => {
    const before = handStateFromHands(
      [
        [c("9", "H"), draw4],
        [c("4", "H")],
      ],
      { uno: true },
    );
    before.currentSeat = 0;
    before.leadCard = null;
    const after = {
      ...before,
      currentSeat: 1,
      lastPlaySeat: 0,
    };
    const event = makePlayEvent(
      "a",
      "single",
      [c("9", "H"), draw4],
      before,
      after,
      0,
      players,
    );
    expect(event.kind).toBe("play");
    if (event.kind !== "play") return;
    expect(event.uno).toBe("draw4");
    expect(event.bombed).toBeUndefined();
    expect(event.targetPlayerId).toBe("b");
    expect(event.drawn).toBe(4);
  });

  it("marks a real quad as a bomb", () => {
    const quad = [c("5", "S"), c("5", "C"), c("5", "D"), c("5", "H")];
    const before = handStateFromHands([[...quad], [c("3", "H")]]);
    before.currentSeat = 0;
    before.leadCard = null;
    before.pile = {
      type: "single",
      cards: [c("2", "H")],
      highCard: c("2", "H"),
      length: 1,
    };
    before.lastPlaySeat = 1;
    const event = makePlayEvent("a", "quad", quad, before, before, 0, players);
    expect(event.kind).toBe("play");
    if (event.kind !== "play") return;
    expect(event.bombed).toBe(true);
    expect(event.targetPlayerId).toBe("b");
  });
});

describe("playEventSignature", () => {
  it("is stable for cloned plays and distinct across plays", () => {
    const play = {
      kind: "play" as const,
      playerId: "a",
      comboType: "single" as const,
      cards: [c("9", "H"), draw4],
      targetPlayerId: "b",
      drawn: 4,
      uno: "draw4" as const,
    };
    const clone = structuredClone(play);
    expect(playEventSignature(play)).toBe(playEventSignature(clone));
    expect(playEventSignature({ ...play, playerId: "c" })).not.toBe(
      playEventSignature(play),
    );
  });
});
