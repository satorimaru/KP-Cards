import { legalPlays } from "./engine";
import { SPEED_HAND } from "./types";
import type { SpeedPlay, SpeedState } from "./types";

export type SpeedBotAction =
  | { type: "play"; card: SpeedPlay["card"]; pile: SpeedPlay["pile"] }
  | { type: "draw" }
  | { type: "next" }
  | { type: "wait" };

export function chooseSpeedBotAction(
  state: SpeedState,
  seat: 0 | 1 = 1,
): SpeedBotAction {
  if (state.status !== "playing") return { type: "wait" };
  const player = state.players[seat];
  if (player.sortUntil > Date.now()) return { type: "wait" };
  const plays = legalPlays(state, seat);
  if (plays[0]) return { type: "play", card: plays[0].card, pile: plays[0].pile };
  if (player.hand.length < SPEED_HAND && player.pile.length > 0) {
    return { type: "draw" };
  }
  if (!player.next) return { type: "next" };
  return { type: "wait" };
}
