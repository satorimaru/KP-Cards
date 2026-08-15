import { DEFAULT_RULES } from "@/lib/rules";
import type { RoomEvent, RoomView } from "@/lib/rooms/types";
import { isGameFinished, type HandState } from "@/lib/tienlen/engine";
import { heldCard } from "@/lib/tienlen/types";

export const HUMAN_ID = "you";
export const BOT_NAMES = ["Lan", "Minh", "Hoa"] as const;

export function playerIdForSeat(seat: number): string {
  return seat === 0 ? HUMAN_ID : `bot-${seat}`;
}

export function soloNames(playerName: string, botCount: number): string[] {
  const you = playerName.trim().slice(0, 24) || "You";
  return [you, ...BOT_NAMES.slice(0, botCount)];
}

export function handToRoomView(
  state: HandState,
  names: string[],
  lastEvent: RoomEvent | null,
  extras?: { turnStartedAt?: number | null },
): RoomView {
  const players = names.map((name, seat) => {
    const place = state.finishOrder.indexOf(seat);
    return {
      id: playerIdForSeat(seat),
      name,
      seat,
      ready: true,
      cardCount: state.hands[seat]?.length ?? 0,
      finishOrder: place >= 0 ? place + 1 : null,
      lastSeenAt: 0,
      satOut: (state.satOut ?? []).includes(seat),
    };
  });

  const finished = isGameFinished(state);

  return {
    id: "SOLO",
    revision: 1,
    status: finished ? "finished" : "playing",
    hostId: HUMAN_ID,
    maxPlayers: state.playerCount as 2 | 3 | 4,
    players,
    hand: (state.hands[0] ?? []).map(heldCard),
    pile: state.pile?.cards ?? [],
    pileType: state.pile?.type ?? null,
    trick: (state.trick ?? []).map((combo) => combo.cards),
    currentPlayerId: finished
      ? null
      : playerIdForSeat(state.currentSeat),
    lastPlayPlayerId:
      state.lastPlaySeat != null ? playerIdForSeat(state.lastPlaySeat) : null,
    passesInRow: state.passesInRow,
    turnVersion: 0,
    leadCard: state.leadCard,
    winners: state.finishOrder.map(playerIdForSeat),
    lastEvent,
    messages: [],
    rules: state.rules ?? DEFAULT_RULES,
    direction: state.direction ?? 1,
    turnStartedAt: extras?.turnStartedAt ?? null,
    startedAt: null,
    createdAt: 0,
    you: HUMAN_ID,
    usingRedis: false,
  };
}

export function clampBotCount(value: number): 1 | 2 | 3 {
  if (value <= 1) return 1;
  if (value >= 3) return 3;
  return 2;
}
