import { detectCombo, isBomb } from "@/lib/tienlen/combos";
import { unoTargetSeat, type HandState } from "@/lib/tienlen/engine";
import { drawCountFor, type Card, type ComboType } from "@/lib/tienlen/types";
import type { RoomEvent } from "./types";

export function makePlayEvent(
  playerId: string,
  comboType: ComboType,
  cards: Card[],
  before: HandState,
  after: HandState,
  actorSeat: number,
  players: { id: string; seat: number }[],
): RoomEvent {
  const combo = detectCombo(cards);
  const effect = combo?.uno;
  const bombed = Boolean(combo && isBomb(combo));
  let targetSeat = unoTargetSeat(after, actorSeat, effect ?? comboType);
  if (bombed && before.pile && before.lastPlaySeat != null) {
    targetSeat = before.lastPlaySeat;
  }
  const target =
    targetSeat != null
      ? players.find((p) => p.seat === targetSeat)
      : undefined;
  const drawn = effect ? drawCountFor(effect) : 0;
  return {
    kind: "play",
    playerId,
    comboType,
    cards: combo?.cards ?? cards,
    targetPlayerId: target?.id,
    drawn: drawn > 0 ? drawn : undefined,
    bombed: bombed || undefined,
    uno: effect,
  };
}
