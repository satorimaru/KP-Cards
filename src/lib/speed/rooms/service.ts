import { customAlphabet } from "nanoid";
import { RoomError } from "@/lib/rooms/errors";
import { parseCardId, type Card } from "@/lib/tienlen/types";
import {
  dealSpeed,
  drawCard,
  playCard,
  setReady,
  signalNext,
  sortHand,
  type SpeedResult,
} from "../engine";
import type { SpeedState } from "../types";
import {
  deleteSpeedRoom,
  getSpeedRoom,
  saveSpeedRoom,
  updateSpeedRoom,
  withSpeedLock,
} from "./store";
import type { SpeedRoom, SpeedRoomPlayer } from "./types";

const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

function now(): number {
  return Date.now();
}

function apply(result: SpeedResult): SpeedState {
  if (!result.ok) throw new RoomError(result.error, 400);
  return result.state;
}

function requirePlayer(room: SpeedRoom, playerId: string): SpeedRoomPlayer {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new RoomError("Not a player in this room", 403);
  return player;
}

export async function createSpeedRoom(
  hostId: string,
  hostName: string,
): Promise<SpeedRoom> {
  if (!hostId.trim()) throw new RoomError("playerId required", 400);
  const room: SpeedRoom = {
    id: roomCode(),
    revision: 1,
    hostId,
    players: [
      {
        id: hostId,
        name: hostName.trim().slice(0, 24) || "Host",
        seat: 0,
        lastSeenAt: now(),
      },
    ],
    state: dealSpeed(),
    createdAt: now(),
  };
  await saveSpeedRoom(room);
  return room;
}

export async function getSpeedRoomForPlayer(
  roomId: string,
  playerId?: string,
): Promise<SpeedRoom> {
  const room = await getSpeedRoom(roomId);
  if (!room) throw new RoomError("Room not found", 404);
  if (!playerId) return room;
  const seated = room.players.find((p) => p.id === playerId);
  if (!seated) return room;
  if (now() - seated.lastSeenAt < 4000) return room;
  return updateSpeedRoom(roomId, (latest) => {
    const player = latest.players.find((p) => p.id === playerId);
    if (player) player.lastSeenAt = now();
  });
}

export async function joinSpeedRoom(
  roomId: string,
  playerId: string,
  playerName: string,
): Promise<SpeedRoom> {
  return updateSpeedRoom(roomId, (room) => {
    if (room.players.some((p) => p.id === playerId)) return;
    if (room.state.status !== "waiting") {
      throw new RoomError("Game already started", 409);
    }
    if (room.players.length >= 2) throw new RoomError("Room is full", 409);
    room.players.push({
      id: playerId,
      name: playerName.trim().slice(0, 24) || "Guest",
      seat: 1,
      lastSeenAt: now(),
    });
  });
}

export async function leaveSpeedRoom(
  roomId: string,
  playerId: string,
): Promise<SpeedRoom | null> {
  return withSpeedLock(roomId, async () => {
    const room = await getSpeedRoom(roomId);
    if (!room) throw new RoomError("Room not found", 404);
    requirePlayer(room, playerId);
    if (room.state.status === "playing") {
      throw new RoomError("Cannot leave in the middle of a hand", 409);
    }
    room.players = room.players.filter((p) => p.id !== playerId);
    room.revision += 1;
    if (room.players.length === 0) {
      await deleteSpeedRoom(roomId);
      return null;
    }
    room.players[0].seat = 0;
    room.hostId = room.players[0].id;
    room.state = dealSpeed();
    await saveSpeedRoom(room);
    return room;
  });
}

export async function readySpeed(
  roomId: string,
  playerId: string,
  ready: boolean,
): Promise<SpeedRoom> {
  return updateSpeedRoom(roomId, (room) => {
    const player = requirePlayer(room, playerId);
    if (room.players.length < 2) {
      throw new RoomError("Need two players", 400);
    }
    player.lastSeenAt = now();
    room.state = apply(setReady(room.state, player.seat, ready));
  });
}

export async function playSpeed(
  roomId: string,
  playerId: string,
  rawCard: unknown,
  pile: unknown,
): Promise<SpeedRoom> {
  return updateSpeedRoom(roomId, (room) => {
    const player = requirePlayer(room, playerId);
    const card: Card | null =
      typeof rawCard === "string"
        ? parseCardId(rawCard)
        : rawCard && typeof rawCard === "object"
          ? parseCardId(
              `${(rawCard as Card).rank}${(rawCard as Card).suit}`,
            )
          : null;
    if (!card) throw new RoomError("Invalid card", 400);
    const pileIndex = Number(pile);
    if (pileIndex !== 0 && pileIndex !== 1) {
      throw new RoomError("Invalid pile", 400);
    }
    player.lastSeenAt = now();
    room.state = apply(playCard(room.state, player.seat, card, pileIndex));
  });
}

export async function drawSpeed(
  roomId: string,
  playerId: string,
): Promise<SpeedRoom> {
  return updateSpeedRoom(roomId, (room) => {
    const player = requirePlayer(room, playerId);
    player.lastSeenAt = now();
    room.state = apply(drawCard(room.state, player.seat));
  });
}

export async function nextSpeed(
  roomId: string,
  playerId: string,
): Promise<SpeedRoom> {
  return updateSpeedRoom(roomId, (room) => {
    const player = requirePlayer(room, playerId);
    player.lastSeenAt = now();
    room.state = apply(signalNext(room.state, player.seat));
  });
}

export async function sortSpeed(
  roomId: string,
  playerId: string,
): Promise<SpeedRoom> {
  return updateSpeedRoom(roomId, (room) => {
    const player = requirePlayer(room, playerId);
    player.lastSeenAt = now();
    room.state = apply(sortHand(room.state, player.seat));
  });
}

export async function rematchSpeed(
  roomId: string,
  playerId: string,
): Promise<SpeedRoom> {
  return updateSpeedRoom(roomId, (room) => {
    requirePlayer(room, playerId);
    if (room.state.status === "playing") {
      throw new RoomError("Finish the hand before a rematch", 409);
    }
    room.state = dealSpeed();
  });
}
