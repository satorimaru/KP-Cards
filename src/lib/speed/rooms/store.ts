import { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
import { RoomError } from "@/lib/rooms/errors";
import type { SpeedRoom } from "./types";

const ROOM_TTL_SECONDS = 60 * 60 * 24;
const KEY_PREFIX = "sp:room:";
const LOCK_PREFIX = "sp:lock:";
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
  __speedRooms?: Map<string, SpeedRoom>;
  __speedLocks?: Map<string, Promise<unknown>>;
};

function memMap(): Map<string, SpeedRoom> {
  if (!memory.__speedRooms) memory.__speedRooms = new Map();
  return memory.__speedRooms;
}

function memLocks(): Map<string, Promise<unknown>> {
  if (!memory.__speedLocks) memory.__speedLocks = new Map();
  return memory.__speedLocks;
}

export function usingSpeedRedis(): boolean {
  return hasRedis();
}

export async function getSpeedRoom(id: string): Promise<SpeedRoom | null> {
  if (hasRedis()) {
    const data = await getRedis().get<SpeedRoom>(KEY_PREFIX + id);
    return data ?? null;
  }
  return memMap().get(id) ?? null;
}

export async function saveSpeedRoom(room: SpeedRoom): Promise<void> {
  if (hasRedis()) {
    await getRedis().set(KEY_PREFIX + room.id, room, { ex: ROOM_TTL_SECONDS });
    return;
  }
  memMap().set(room.id, room);
}

export async function deleteSpeedRoom(id: string): Promise<void> {
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

export async function withSpeedLock<T>(
  id: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (hasRedis()) return withRedisLock(id, fn);
  return withMemoryLock(id, fn);
}

export async function updateSpeedRoom(
  id: string,
  updater: (room: SpeedRoom) => SpeedRoom | void,
): Promise<SpeedRoom> {
  return withSpeedLock(id, async () => {
    const room = await getSpeedRoom(id);
    if (!room) throw new RoomError("Room not found", 404);
    const draft = structuredClone(room);
    const next = updater(draft) ?? draft;
    next.revision = room.revision + 1;
    await saveSpeedRoom(next);
    return next;
  });
}
