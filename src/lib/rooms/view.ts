import { heldCard } from "@/lib/tienlen/types";
import { usingRedis } from "./store";
import type { Room, RoomView } from "./types";

function publicPlayers(room: Room) {
  const sat = new Set(room.satOut ?? []);
  return room.players.map((p) => ({
    ...p,
    cardCount: room.hands[p.id]?.length ?? p.cardCount,
    satOut: sat.has(p.seat),
  }));
}

function baseView(room: Room): Omit<RoomView, "hand" | "you" | "messages"> {
  return {
    id: room.id,
    revision: room.revision,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    players: publicPlayers(room),
    pile: room.pile,
    pileType: room.pileType,
    trick: room.trick ?? [],
    currentPlayerId: room.currentPlayerId,
    lastPlayPlayerId: room.lastPlayPlayerId,
    passesInRow: room.passesInRow,
    turnVersion: room.turnVersion,
    leadCard: room.leadCard,
    winners: room.winners,
    lastEvent: room.lastEvent,
    rules: room.rules,
    direction: room.direction ?? 1,
    turnStartedAt: room.turnStartedAt ?? null,
    startedAt: room.startedAt,
    createdAt: room.createdAt,
    usingRedis: usingRedis(),
  };
}

/** Snapshot with no private hand — safe for invite pages and strangers. */
export function toPublicView(room: Room): RoomView {
  return {
    ...baseView(room),
    hand: [],
    you: null,
    messages: [],
  };
}

/** Snapshot for a seated player: only that player's hand is included. */
export function toRoomView(room: Room, playerId: string): RoomView {
  const seated = room.players.some((p) => p.id === playerId);
  return {
    ...baseView(room),
    hand: seated ? (room.hands[playerId] ?? []).map(heldCard) : [],
    you: seated ? playerId : null,
    messages: seated ? (room.messages ?? []) : [],
  };
}
