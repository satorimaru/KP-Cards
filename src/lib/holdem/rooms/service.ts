import { customAlphabet } from "nanoid";
import { RoomError } from "@/lib/rooms/errors";
import {
  applyAction,
  createTable,
  dealHand,
  rebuy,
  showCards,
} from "../engine";
import type { HoldemActionKind } from "../types";
import {
  deleteHoldemRoom,
  getHoldemRoom,
  saveHoldemRoom,
  updateHoldemRoom,
  withHoldemLock,
} from "./store";
import type { HoldemRoom, HoldemRoomPlayer } from "./types";

const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

function now(): number {
  return Date.now();
}

export async function createHoldemRoom(
  hostId: string,
  hostName: string,
): Promise<HoldemRoom> {
  if (!hostId.trim()) throw new RoomError("playerId required", 400);
  const name = hostName.trim().slice(0, 24) || "Host";
  const state = createTable([name], { botsFrom: 99 });
  state.players[0].id = hostId;
  state.players[0].isBot = false;
  const room: HoldemRoom = {
    id: roomCode(),
    revision: 1,
    hostId,
    players: [{ id: hostId, name, seat: 0, lastSeenAt: now() }],
    state,
    createdAt: now(),
  };
  await saveHoldemRoom(room);
  return room;
}

export async function getHoldemRoomForPlayer(
  roomId: string,
  playerId?: string,
): Promise<HoldemRoom> {
  const room = await getHoldemRoom(roomId);
  if (!room) throw new RoomError("Room not found", 404);
  if (!playerId) return room;
  const seated = room.players.find((p) => p.id === playerId);
  if (!seated || now() - seated.lastSeenAt < 4000) return room;
  return withHoldemLock(roomId, async () => {
    const latest = await getHoldemRoom(roomId);
    if (!latest) throw new RoomError("Room not found", 404);
    const player = latest.players.find((p) => p.id === playerId);
    if (player) player.lastSeenAt = now();
    await saveHoldemRoom(latest);
    return latest;
  });
}

export async function joinHoldemRoom(
  roomId: string,
  playerId: string,
  playerName: string,
): Promise<HoldemRoom> {
  return updateHoldemRoom(roomId, (room) => {
    if (room.players.some((p) => p.id === playerId)) return;
    if (room.state.status === "playing") throw new RoomError("Game already started", 409);
    if (room.players.length >= 6) throw new RoomError("Room is full", 409);
    const seat = room.players.length;
    const name = playerName.trim().slice(0, 24) || "Guest";
    room.players.push({ id: playerId, name, seat, lastSeenAt: now() });
    room.state.players.push({
      id: playerId,
      name,
      seat,
      stack: room.state.startStack,
      hole: [],
      bet: 0,
      contributed: 0,
      folded: false,
      allIn: false,
      sittingOut: false,
      isBot: false,
      shown: false,
    });
  });
}

export async function leaveHoldemRoom(
  roomId: string,
  playerId: string,
): Promise<HoldemRoom | null> {
  return withHoldemLock(roomId, async () => {
    const room = await getHoldemRoom(roomId);
    if (!room) throw new RoomError("Room not found", 404);
    if (room.state.status === "playing") {
      throw new RoomError("Cannot leave in the middle of a hand", 409);
    }
    room.players = room.players.filter((p) => p.id !== playerId);
    room.state.players = room.state.players.filter((p) => p.id !== playerId);
    room.state.players.forEach((p, i) => {
      p.seat = i;
    });
    room.players.forEach((p, i) => {
      p.seat = i;
    });
    room.revision += 1;
    if (room.players.length === 0) {
      await deleteHoldemRoom(roomId);
      return null;
    }
    room.hostId = room.players[0].id;
    await saveHoldemRoom(room);
    return room;
  });
}

export async function startHoldem(
  roomId: string,
  playerId: string,
): Promise<HoldemRoom> {
  return updateHoldemRoom(roomId, (room) => {
    if (room.hostId !== playerId) throw new RoomError("Only the host can start", 403);
    const result = dealHand(room.state);
    if (!result.ok) throw new RoomError(result.error, 400);
    room.state = result.state;
  });
}

export async function actHoldem(
  roomId: string,
  playerId: string,
  kind: unknown,
  raiseTo?: unknown,
): Promise<HoldemRoom> {
  return updateHoldemRoom(roomId, (room) => {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new RoomError("Not a player in this room", 403);
    const action = String(kind) as HoldemActionKind;
    const result = applyAction(
      room.state,
      player.seat,
      action,
      raiseTo != null ? Number(raiseTo) : undefined,
    );
    if (!result.ok) throw new RoomError(result.error, 400);
    room.state = result.state;
  });
}

export async function dealHoldemRoom(
  roomId: string,
  playerId: string,
): Promise<HoldemRoom> {
  return updateHoldemRoom(roomId, (room) => {
    if (room.hostId !== playerId) throw new RoomError("Only the host can start", 403);
    const result = dealHand(room.state);
    if (!result.ok) throw new RoomError(result.error, 400);
    room.state = result.state;
  });
}

export async function showHoldem(
  roomId: string,
  playerId: string,
): Promise<HoldemRoom> {
  return updateHoldemRoom(roomId, (room) => {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new RoomError("Not a player in this room", 403);
    const result = showCards(room.state, player.seat);
    if (!result.ok) throw new RoomError(result.error, 400);
    room.state = result.state;
  });
}

export async function rebuyHoldem(
  roomId: string,
  playerId: string,
): Promise<HoldemRoom> {
  return updateHoldemRoom(roomId, (room) => {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new RoomError("Not a player in this room", 403);
    const result = rebuy(room.state, player.seat);
    if (!result.ok) throw new RoomError(result.error, 400);
    room.state = result.state;
  });
}

export type { HoldemRoomPlayer };
