import { describe, expect, it } from "vitest";
import { ranksAdjacent, sortSpeedHand } from "./ranks";
import {
  dealSpeed,
  drawCard,
  flipLives,
  hasLegalPlay,
  legalPlays,
  playCard,
  remainingOf,
  setReady,
  signalNext,
  sortHand,
} from "./engine";
import { SPEED_DEAL, SPEED_HAND, SPEED_SORT_MS, SPEED_STOCK } from "./types";
import {
  applyPendingOps,
  optimisticDraw,
  optimisticPlay,
  toSpeedView,
} from "./view";
import type { Card } from "@/lib/tienlen/types";
import type { SpeedState } from "./types";

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

function readyBoth(state: SpeedState): SpeedState {
  const a = setReady(state, 0, true);
  if (!a.ok) throw new Error(a.error);
  const b = setReady(a.state, 1, true);
  if (!b.ok) throw new Error(b.error);
  return b.state;
}

function playingAt(lives: [Card, Card], hands: [Card[], Card[]]): SpeedState {
  return {
    status: "playing",
    piles: [
      { stock: [c("9", "H")], live: lives[0], played: [] },
      { stock: [c("9", "D")], live: lives[1], played: [] },
    ],
    players: [
      {
        hand: hands[0],
        pile: [c("J", "C"), c("Q", "C")],
        next: false,
        sortUntil: 0,
        ready: false,
      },
      {
        hand: hands[1],
        pile: [c("J", "D"), c("Q", "D")],
        next: false,
        sortUntil: 0,
        ready: false,
      },
    ],
    winnerSeat: null,
  };
}

describe("speed ranks", () => {
  it("treats ace as next to king and two", () => {
    expect(ranksAdjacent("A", "K")).toBe(true);
    expect(ranksAdjacent("A", "2")).toBe(true);
    expect(ranksAdjacent("K", "Q")).toBe(true);
    expect(ranksAdjacent("7", "8")).toBe(true);
    expect(ranksAdjacent("7", "9")).toBe(false);
    expect(ranksAdjacent("7", "7")).toBe(false);
    expect(ranksAdjacent("K", "2")).toBe(false);
  });

  it("sorts a hand ace, two, … king then suit", () => {
    const sorted = sortSpeedHand([
      c("K", "H"),
      c("A", "D"),
      c("2", "S"),
      c("A", "S"),
    ]);
    expect(sorted.map((card) => `${card.rank}${card.suit}`)).toEqual([
      "AS",
      "AD",
      "2S",
      "KH",
    ]);
  });
});

describe("speed deal", () => {
  it("deals 20/20/6/6 and starts with 4 in each hand", () => {
    const state = dealSpeed(() => 0.4);
    expect(state.status).toBe("waiting");
    expect(state.players[0].hand).toHaveLength(SPEED_HAND);
    expect(state.players[1].hand).toHaveLength(SPEED_HAND);
    expect(state.players[0].pile).toHaveLength(SPEED_DEAL - SPEED_HAND);
    expect(state.players[1].pile).toHaveLength(SPEED_DEAL - SPEED_HAND);
    expect(state.piles[0].stock).toHaveLength(SPEED_STOCK);
    expect(state.piles[1].stock).toHaveLength(SPEED_STOCK);
    expect(state.piles[0].live).toBeNull();
    expect(state.piles[1].live).toBeNull();
    const ids = [
      ...state.players[0].hand,
      ...state.players[0].pile,
      ...state.players[1].hand,
      ...state.players[1].pile,
      ...state.piles[0].stock,
      ...state.piles[1].stock,
    ];
    expect(ids).toHaveLength(52);
  });

  it("flips two live cards when both players ready", () => {
    const started = readyBoth(dealSpeed(() => 0.3));
    expect(started.status).toBe("playing");
    expect(started.piles[0].live).toBeTruthy();
    expect(started.piles[1].live).toBeTruthy();
    expect(started.piles[0].stock).toHaveLength(SPEED_STOCK - 1);
    expect(started.piles[1].stock).toHaveLength(SPEED_STOCK - 1);
  });
});

describe("speed play", () => {
  it("covers a live card one rank away and parks the old live", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C"), c("4", "D"), c("A", "H"), c("2", "C")],
      [c("5", "S"), c("9", "C"), c("10", "D"), c("J", "H")],
    ]);
    const played = playCard(state, 0, c("8", "C"), 0);
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.piles[0].live).toEqual(c("8", "C"));
    expect(played.state.piles[0].played).toEqual([c("7", "H")]);
    expect(played.state.players[0].hand).toHaveLength(3);
    expect(played.state.players[0].next).toBe(false);
  });

  it("lets you choose either pile when both live cards share a rank", () => {
    const state = playingAt([c("7", "H"), c("7", "S")], [
      [c("8", "C"), c("4", "D"), c("A", "H"), c("2", "C")],
      [c("5", "S"), c("9", "C"), c("10", "D"), c("J", "H")],
    ]);
    expect(legalPlays(state, 0)).toEqual([
      { card: c("8", "C"), pile: 0 },
      { card: c("8", "C"), pile: 1 },
    ]);
    const left = playCard(state, 0, c("8", "C"), 0);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.state.piles[0].live).toEqual(c("8", "C"));
    expect(left.state.piles[1].live).toEqual(c("7", "S"));
    const right = playCard(state, 0, c("8", "C"), 1);
    expect(right.ok).toBe(true);
    if (!right.ok) return;
    expect(right.state.piles[0].live).toEqual(c("7", "H"));
    expect(right.state.piles[1].live).toEqual(c("8", "C"));
  });

  it("paints a play on the chosen pile without waiting for a server", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C"), c("4", "D"), c("A", "H"), c("2", "C")],
      [c("5", "S"), c("9", "C"), c("10", "D"), c("J", "H")],
    ]);
    const view = optimisticPlay(toSpeedView(state, 0), c("8", "C"), 0);
    expect(view.piles[0].live).toEqual(c("8", "C"));
    expect(view.piles[1].live).toEqual(c("K", "S"));
    expect(view.hand).toHaveLength(3);
    expect(view.next).toBe(false);
  });

  it("paints a draw from the personal pile immediately", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C"), c("4", "D")],
      [c("5", "S")],
    ]);
    const view = optimisticDraw(toSpeedView(state, 0));
    expect(view.hand).toHaveLength(3);
    expect(view.hand[2]).toEqual(c("J", "C"));
    expect(view.pileCount).toBe(1);
  });

  it("keeps a pending draw when a stale snapshot arrives", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C"), c("4", "D")],
      [c("5", "S")],
    ]);
    const stale = toSpeedView(state, 0);
    const shown = applyPendingOps(stale, [{ kind: "draw" }]);
    expect(shown.hand).toHaveLength(3);
    expect(shown.hand[2]).toEqual(c("J", "C"));
  });

  it("rejects a card that is not adjacent", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("10", "C"), c("4", "D"), c("A", "H"), c("2", "C")],
      [c("5", "S"), c("9", "C"), c("10", "D"), c("J", "H")],
    ]);
    expect(playCard(state, 0, c("10", "C"), 0)).toEqual({
      ok: false,
      error: "err.notAdjacent",
    });
  });

  it("wins when the last of the 20 is played", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C")],
      [c("5", "S")],
    ]);
    state.players[0].pile = [];
    const played = playCard(state, 0, c("8", "C"), 0);
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.status).toBe("finished");
    expect(played.state.winnerSeat).toBe(0);
    expect(remainingOf(played.state.players[0])).toBe(0);
  });
});

describe("speed draw", () => {
  it("fills an empty hand slot from the personal pile", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C"), c("4", "D")],
      [c("5", "S")],
    ]);
    const drawn = drawCard(state, 0);
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.state.players[0].hand).toHaveLength(3);
    expect(drawn.state.players[0].pile).toHaveLength(1);
  });

  it("refuses a fifth card", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C"), c("4", "D"), c("A", "H"), c("2", "C")],
      [c("5", "S")],
    ]);
    expect(drawCard(state, 0)).toEqual({ ok: false, error: "err.handFull" });
  });
});

describe("speed next and recycle", () => {
  it("rejects next when a play exists", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("8", "C"), c("4", "D"), c("A", "H"), c("2", "C")],
      [c("5", "S"), c("9", "C"), c("10", "D"), c("J", "H")],
    ]);
    expect(hasLegalPlay(state, 0)).toBe(true);
    expect(signalNext(state, 0)).toEqual({ ok: false, error: "err.havePlay" });
  });

  it("flips two new lives only when both players are next", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("4", "D"), c("10", "C")],
      [c("5", "H"), c("9", "C")],
    ]);
    expect(legalPlays(state, 0)).toEqual([]);
    const one = signalNext(state, 0);
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(one.state.piles[0].live).toEqual(c("7", "H"));
    expect(one.state.players[0].next).toBe(true);
    const both = signalNext(one.state, 1);
    expect(both.ok).toBe(true);
    if (!both.ok) return;
    expect(both.state.piles[0].live).toEqual(c("9", "H"));
    expect(both.state.piles[1].live).toEqual(c("9", "D"));
    expect(both.state.piles[0].played).toEqual([c("7", "H")]);
    expect(both.state.players[0].next).toBe(false);
    expect(both.state.players[1].next).toBe(false);
  });

  it("clears next after a play", () => {
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("4", "D"), c("10", "C")],
      [c("5", "H"), c("Q", "C")],
    ]);
    const stuck = signalNext(state, 0);
    expect(stuck.ok).toBe(true);
    if (!stuck.ok) return;
    const opened = playCard(stuck.state, 1, c("Q", "C"), 1);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.state.players[1].next).toBe(false);
    expect(opened.state.players[0].next).toBe(true);
  });

  it("recycles each pile in play order when both stocks are empty", () => {
    const state: SpeedState = {
      status: "playing",
      piles: [
        {
          stock: [],
          live: c("8", "H"),
          played: [c("3", "S"), c("7", "D")],
        },
        {
          stock: [],
          live: c("K", "C"),
          played: [c("A", "H"), c("2", "C")],
        },
      ],
      players: [
        {
          hand: [c("10", "S")],
          pile: [],
          next: true,
          sortUntil: 0,
          ready: false,
        },
        {
          hand: [c("5", "S")],
          pile: [],
          next: true,
          sortUntil: 0,
          ready: false,
        },
      ],
      winnerSeat: null,
    };
    const flipped = flipLives(state);
    expect(flipped.piles[0].live).toEqual(c("3", "S"));
    expect(flipped.piles[0].stock).toEqual([c("7", "D"), c("8", "H")]);
    expect(flipped.piles[0].played).toEqual([]);
    expect(flipped.piles[1].live).toEqual(c("A", "H"));
    expect(flipped.piles[1].stock).toEqual([c("2", "C"), c("K", "C")]);
  });
});

describe("speed sort", () => {
  it("orders the hand and blocks actions for one second", () => {
    const now = 10_000;
    const state = playingAt([c("7", "H"), c("K", "S")], [
      [c("K", "H"), c("A", "D"), c("2", "S"), c("8", "C")],
      [c("5", "S")],
    ]);
    const sorted = sortHand(state, 0, now);
    expect(sorted.ok).toBe(true);
    if (!sorted.ok) return;
    expect(sorted.state.players[0].hand.map((card) => card.rank)).toEqual([
      "A",
      "2",
      "8",
      "K",
    ]);
    expect(sorted.state.players[0].sortUntil).toBe(now + SPEED_SORT_MS);
    expect(playCard(sorted.state, 0, c("8", "C"), 0, now + 200)).toEqual({
      ok: false,
      error: "err.sorting",
    });
    expect(drawCard(sorted.state, 0, now + 200).ok).toBe(false);
    expect(signalNext(sorted.state, 0, now + 200).ok).toBe(false);
    const after = playCard(sorted.state, 0, c("8", "C"), 0, now + SPEED_SORT_MS);
    expect(after.ok).toBe(true);
  });
});
