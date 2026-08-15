import { describe, expect, it } from "vitest";
import {
  BJ_DEAL_MS,
  createBjTable,
  dealRound,
  handValue,
  isBlackjack,
  maybeDeal,
  readyDeal,
  resultForHand,
  seatResult,
  setBet,
} from "./engine";
import type { Card, Rank, Suit } from "@/lib/tienlen/types";

function c(rank: Rank, suit: Suit = "S"): Card {
  return { rank, suit };
}

describe("blackjack", () => {
  it("counts a soft 17 and a hard 17", () => {
    expect(handValue([c("A"), c("6")])).toEqual({ total: 17, soft: true });
    expect(handValue([c("A"), c("6"), c("10")])).toEqual({
      total: 17,
      soft: false,
    });
    expect(handValue([c("K"), c("A")]).total).toBe(21);
    expect(isBlackjack([c("A"), c("K")])).toBe(true);
  });

  it("deals after bets and settles a round", () => {
    const table = createBjTable(["You", "Bot"], { botsFrom: 1 });
    expect(setBet(table, 0, 10).ok).toBe(true);
    expect(setBet(table, 1, 10).ok).toBe(true);
    const dealt = dealRound(table);
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) return;
    expect(dealt.state.dealer.length).toBeGreaterThanOrEqual(2);
    expect(dealt.state.seats[0].hands[0].cards.length).toBe(2);
  });

  it("waits for every human to ready, then deals", () => {
    const table = createBjTable(["You", "Lan"], { botsFrom: 99 });
    expect(setBet(table, 0, 10).ok).toBe(true);
    expect(setBet(table, 1, 10).ok).toBe(true);
    const first = readyDeal(table, 0, 1_000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.phase).toBe("betting");
    expect(first.state.dealAt).toBe(1_000 + BJ_DEAL_MS);
    const second = readyDeal(first.state, 1, 2_000);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.phase).not.toBe("betting");
    expect(second.state.seats[0].hands[0].cards.length).toBe(2);
  });

  it("deals when the 15s timer expires after one ready", () => {
    const table = createBjTable(["You", "Lan"], { botsFrom: 99 });
    expect(setBet(table, 0, 25).ok).toBe(true);
    const first = readyDeal(table, 0, 1_000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.phase).toBe("betting");
    const early = maybeDeal(first.state, 10_000);
    expect(early.ok).toBe(true);
    if (!early.ok) return;
    expect(early.state.phase).toBe("betting");
    const late = maybeDeal(early.state, 1_000 + BJ_DEAL_MS);
    expect(late.ok).toBe(true);
    if (!late.ok) return;
    expect(late.state.phase).not.toBe("betting");
    expect(late.state.seats[0].hands[0].cards.length).toBe(2);
    expect(late.state.seats[1].hands.length).toBe(0);
  });

  it("scores a win, blackjack, push, and lose", () => {
    const dealer = [c("10"), c("8")];
    expect(resultForHand([c("K"), c("9")], dealer, true)).toBe("win");
    expect(resultForHand([c("A"), c("K")], dealer, true)).toBe("blackjack");
    expect(resultForHand([c("10"), c("8")], dealer, true)).toBe("push");
    expect(resultForHand([c("5"), c("6")], dealer, true)).toBe("lose");
    const seat = {
      id: "you",
      name: "You",
      seat: 0,
      stack: 500,
      isBot: false,
      hands: [{ cards: [c("A"), c("K")], bet: 10, stood: true, doubled: false }],
      current: 0,
      insured: false,
      ready: false,
    };
    expect(seatResult(seat, dealer)).toEqual({ kind: "blackjack", n: 15 });
  });
});
