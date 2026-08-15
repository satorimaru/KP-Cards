import { customAlphabet } from "nanoid";
import { RoomError } from "@/lib/rooms/errors";
import {
  createBjTable,
  doubleDown,
  hit,
  insure,
  maybeDeal,
  nextRound,
  readyDeal,
  rebuyBj,
  setBet,
  split,
  stand,
  type BjResult,
} from "../engine";
import { deleteBjRoom, getBjRoom, saveBjRoom, updateBjRoom } from "./store";
import type { BjRoom } from "./types";

const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

function apply(result: BjResult) {
  if (!result.ok) throw new RoomError(result.error, 400);
  return result.state;
}

export async function createBjRoom(hostId: string, hostName: string): Promise<BjRoom> {
  const name = hostName.trim().slice(0, 24) || "Host";
  const state = createBjTable([name], { botsFrom: 99 });
  state.seats[0].id = hostId;
  state.seats[0].isBot = false;
  const room: BjRoom = {
    id: roomCode(),
    revision: 1,
    hostId,
    players: [{ id: hostId, name, seat: 0, lastSeenAt: Date.now() }],
    state,
    createdAt: Date.now(),
  };
  await saveBjRoom(room);
  return room;
}

export async function getBjRoomForPlayer(roomId: string): Promise<BjRoom> {
  const room = await getBjRoom(roomId);
  if (!room) throw new RoomError("Room not found", 404);
  if (
    room.state.phase === "betting" &&
    room.state.dealAt != null &&
    Date.now() >= room.state.dealAt
  ) {
    return updateBjRoom(roomId, (r) => {
      const next = maybeDeal(r.state);
      if (next.ok) r.state = next.state;
    });
  }
  return room;
}

export async function joinBjRoom(
  roomId: string,
  playerId: string,
  playerName: string,
): Promise<BjRoom> {
  return updateBjRoom(roomId, (room) => {
    if (room.players.some((p) => p.id === playerId)) return;
    if (room.players.length >= 6) throw new RoomError("Room is full", 409);
    if (room.state.phase !== "betting") throw new RoomError("Wait for the next round", 409);
    const seat = room.players.length;
    const name = playerName.trim().slice(0, 24) || "Guest";
    room.players.push({ id: playerId, name, seat, lastSeenAt: Date.now() });
    room.state.seats.push({
      id: playerId,
      name,
      seat,
      stack: room.state.startStack,
      isBot: false,
      hands: [],
      current: 0,
      insured: false,
      ready: false,
    });
  });
}

export async function leaveBjRoom(
  roomId: string,
  playerId: string,
): Promise<BjRoom | null> {
  const room = await getBjRoom(roomId);
  if (!room) throw new RoomError("Room not found", 404);
  if (room.state.phase === "play") throw new RoomError("Finish the hand first", 409);
  room.players = room.players.filter((p) => p.id !== playerId);
  room.state.seats = room.state.seats.filter((s) => s.id !== playerId);
  room.players.forEach((p, i) => {
    p.seat = i;
  });
  room.state.seats.forEach((s, i) => {
    s.seat = i;
  });
  room.revision += 1;
  if (room.players.length === 0) {
    await deleteBjRoom(roomId);
    return null;
  }
  room.hostId = room.players[0].id;
  const dealt = maybeDeal(room.state);
  if (dealt.ok) room.state = dealt.state;
  await saveBjRoom(room);
  return room;
}

function seatOf(room: BjRoom, playerId: string): number {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) throw new RoomError("Not a player in this room", 403);
  return p.seat;
}

export async function bjBet(roomId: string, playerId: string, amount: number) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(setBet(room.state, seatOf(room, playerId), amount));
  });
}

export async function bjDeal(roomId: string, playerId: string) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(readyDeal(room.state, seatOf(room, playerId)));
  });
}

export async function bjHit(roomId: string, playerId: string) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(hit(room.state, seatOf(room, playerId)));
  });
}

export async function bjStand(roomId: string, playerId: string) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(stand(room.state, seatOf(room, playerId)));
  });
}

export async function bjDouble(roomId: string, playerId: string) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(doubleDown(room.state, seatOf(room, playerId)));
  });
}

export async function bjSplit(roomId: string, playerId: string) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(split(room.state, seatOf(room, playerId)));
  });
}

export async function bjInsure(roomId: string, playerId: string, take: boolean) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(insure(room.state, seatOf(room, playerId), take));
  });
}

export async function bjNext(roomId: string, playerId: string) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(nextRound(room.state));
  });
}

export async function bjRebuy(roomId: string, playerId: string) {
  return updateBjRoom(roomId, (room) => {
    room.state = apply(rebuyBj(room.state, seatOf(room, playerId)));
  });
}
