import { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
import { parseRules } from "@/lib/rules";
import { RoomError } from "./errors";
import type { Room } from "./types";

const ROOM_TTL_SECONDS = 60 * 60 * 24;
const KEY_PREFIX = "tl:room:";
const LOCK_PREFIX = "tl:lock:";
const lockToken = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

function hasRedis(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function getRedis(): Redis {
  return Redis.fromEnv();
}

const memory = globalThis as typeof globalThis & {
  __tienlenRooms?: Map<string, Room>;
  __tienlenLocks?: Map<string, Promise<unknown>>;
};

function memMap(): Map<string, Room> {
  if (!memory.__tienlenRooms) {
    memory.__tienlenRooms = new Map();
  }
  return memory.__tienlenRooms;
}

function memLocks(): Map<string, Promise<unknown>> {
  if (!memory.__tienlenLocks) {
    memory.__tienlenLocks = new Map();
  }
  return memory.__tienlenLocks;
}

export function usingRedis(): boolean {
  return hasRedis();
}

function hydrateRoom(room: Room | null): Room | null {
  if (!room) return null;
  if (!Array.isArray(room.messages)) room.messages = [];
  room.rules = parseRules(room.rules);
  if (room.direction !== 1 && room.direction !== -1) room.direction = 1;
  if (room.turnStartedAt == null) room.turnStartedAt = null;
  if (!Array.isArray(room.stock)) room.stock = [];
  if (!Array.isArray(room.discard)) room.discard = [];
  if (!Array.isArray(room.satOut)) room.satOut = [];
  if (!Array.isArray(room.trick)) room.trick = [];
  const sat = new Set(room.satOut);
  for (const p of room.players) {
    p.satOut = sat.has(p.seat);
  }
  return room;
}

export async function getRoom(id: string): Promise<Room | null> {
  if (hasRedis()) {
    const data = await getRedis().get<Room>(KEY_PREFIX + id);
    return hydrateRoom(data ?? null);
  }
  return hydrateRoom(memMap().get(id) ?? null);
}

export async function saveRoom(room: Room): Promise<void> {
  if (hasRedis()) {
    await getRedis().set(KEY_PREFIX + room.id, room, {
      ex: ROOM_TTL_SECONDS,
    });
    return;
  }
  memMap().set(room.id, room);
}

export async function deleteRoom(id: string): Promise<void> {
  if (hasRedis()) {
    await getRedis().del(KEY_PREFIX + id);
    return;
  }
  memMap().delete(id);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withMemoryLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const locks = memLocks();
  const previous = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  locks.set(id, chained);
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(id) === chained) locks.delete(id);
  }
}

async function withRedisLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  const lockKey = LOCK_PREFIX + id;
  const token = lockToken();

  for (let attempt = 0; attempt < 24; attempt++) {
    const acquired = await redis.set(lockKey, token, { nx: true, ex: 5 });
    if (acquired) {
      try {
        return await fn();
      } finally {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          [lockKey],
          [token],
        );
      }
    }
    await sleep(40 + attempt * 20);
  }

  throw new RoomError("Room is busy — try again", 409);
}

export async function withRoomLock<T>(
  id: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (hasRedis()) return withRedisLock(id, fn);
  return withMemoryLock(id, fn);
}

export async function updateRoom(
  id: string,
  updater: (room: Room) => Room | void,
): Promise<Room> {
  return withRoomLock(id, async () => {
    const room = await getRoom(id);
    if (!room) throw new RoomError("Room not found", 404);
    const draft = structuredClone(room);
    const next = updater(draft) ?? draft;
    next.revision = room.revision + 1;
    await saveRoom(next);
    return next;
  });
}
