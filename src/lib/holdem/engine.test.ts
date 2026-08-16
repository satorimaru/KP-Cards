import { describe, expect, it } from "vitest";
import { applyAction, createTable, dealHand, legalActions, showCards } from "./engine";

describe("holdem engine", () => {
  it("posts blinds and deals two cards each", () => {
    const table = createTable(["You", "Lan", "Minh"], { botsFrom: 1 });
    const dealt = dealHand(table, () => 0.4);
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) return;
    expect(dealt.state.status).toBe("playing");
    expect(dealt.state.players.every((p) => p.hole.length === 2)).toBe(true);
    const stacks = dealt.state.players.map((p) => p.stack);
    expect(stacks.reduce((a, b) => a + b, 0) + dealt.state.players.reduce((a, p) => a + p.bet, 0)).toBe(1500);
  });

  it("awards the pot when everyone else folds", () => {
    const table = createTable(["You", "Bot"], { startStack: 100, sb: 5, bb: 10, botsFrom: 1 });
    const dealt = dealHand(table, () => 0.3);
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) return;
    const actor = dealt.state.toAct!;
    const folded = applyAction(dealt.state, actor, "fold");
    expect(folded.ok).toBe(true);
    if (!folded.ok) return;
    expect(folded.state.status).toBe("handOver");
    expect(folded.state.winners[0].seats).toHaveLength(1);
    expect(folded.state.players.reduce((n, p) => n + p.stack, 0)).toBe(200);
    expect(folded.state.uncontested).toBe(true);
    const winner = folded.state.players.find((p) => !p.folded)!;
    const foldedSeat = folded.state.players.find((p) => p.folded)!;
    expect(winner.shown).toBe(false);
    expect(foldedSeat.shown).toBe(false);
    const shown = showCards(folded.state, winner.seat);
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    expect(shown.state.players[winner.seat].shown).toBe(true);
    expect(showCards(shown.state, foldedSeat.seat).ok).toBe(false);
  });

  it("lets the big blind check when limped to", () => {
    const table = createTable(["You", "Bot"], { botsFrom: 1 });
    const dealt = dealHand(table, () => 0.2);
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) return;
    const first = dealt.state.toAct!;
    const called = applyAction(dealt.state, first, "call");
    expect(called.ok).toBe(true);
    if (!called.ok) return;
    const bb = called.state.toAct!;
    const legal = legalActions(called.state, bb);
    expect(legal.check).toBe(true);
    const checked = applyAction(called.state, bb, "check");
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.state.street).toBe("flop");
    expect(checked.state.board).toHaveLength(3);
  });

  it("records blinds, calls, and folds in the hand log", () => {
    const table = createTable(["You", "Lan"], { botsFrom: 1 });
    const dealt = dealHand(table, () => 0.2);
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) return;
    expect(dealt.state.log.map((e) => e.kind)).toEqual(["sb", "bb"]);
    const actor = dealt.state.toAct!;
    const called = applyAction(dealt.state, actor, "call");
    expect(called.ok).toBe(true);
    if (!called.ok) return;
    expect(called.state.log.at(-1)?.kind).toBe("call");
    expect(called.state.log.at(-1)?.n).toBeGreaterThan(0);
    const next = called.state.toAct!;
    const folded = applyAction(called.state, next, "check");
    expect(folded.ok).toBe(true);
    if (!folded.ok) return;
    expect(folded.state.log.some((e) => e.kind === "check")).toBe(true);
    expect(folded.state.log.some((e) => e.kind === "flop")).toBe(true);
  });
});
