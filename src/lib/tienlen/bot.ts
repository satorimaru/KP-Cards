import { isBomb } from "./combos";
import type { HandState } from "./engine";
import { legalPlays } from "./plays";
import { type Combo, cardValue } from "./types";

export type BotAction =
  | { type: "play"; cards: Combo["cards"] }
  | { type: "pass" };

function isTwos(combo: Combo): boolean {
  return combo.cards
    .filter((c) => !c.kind || c.kind === "std" || c.kind === "joker")
    .every((c) => c.rank === "2");
}

function strength(combo: Combo): number {
  let score = cardValue(combo.highCard);
  if (isTwos(combo)) score += 400;
  if (isBomb(combo)) score += 800;
  return score;
}

function weakest(plays: Combo[]): Combo {
  return plays.reduce((best, play) =>
    strength(play) < strength(best) ? play : best,
  );
}

function pickLead(plays: Combo[]): Combo {
  const dump = plays.filter(
    (p) =>
      !isBomb(p) &&
      !isTwos(p) &&
      !p.uno,
  );
  const pool = dump.length > 0 ? dump : plays;
  return pool.reduce((best, play) => {
    if (play.cards.length !== best.cards.length) {
      return play.cards.length > best.cards.length ? play : best;
    }
    return strength(play) < strength(best) ? play : best;
  });
}

export function chooseBotAction(state: HandState, seat: number): BotAction {
  const plays = legalPlays(state, seat);
  if (plays.length === 0) return { type: "pass" };

  const handSize = state.hands[seat]?.length ?? 0;
  const finishing = plays.filter((p) => p.cards.length === handSize);
  if (finishing.length > 0) {
    return { type: "play", cards: weakest(finishing).cards };
  }

  if (!state.pile) {
    return { type: "play", cards: pickLead(plays).cards };
  }

  const cheap = plays.filter(
    (p) =>
      !isBomb(p) &&
      !isTwos(p) &&
      !p.uno,
  );
  if (cheap.length > 0) {
    return { type: "play", cards: weakest(cheap).cards };
  }
  return { type: "play", cards: weakest(plays).cards };
}
