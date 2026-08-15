import { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
import { RoomError } from "@/lib/rooms/errors";
import type { BjRoom } from "./types";

const ROOM_TTL_SECONDS = 60 * 60 * 24;
const KEY_PREFIX = "bj:room:";
const LOCK_PREFIX = "bj:lock:";
const lockToken = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

function hasRedis() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}
function getRedis() {
  return Redis.fromEnv();
}

const memory = globalThis as typeof globalThis & {
  __bjRooms?: Map<string, BjRoom>;
  __bjLocks?: Map<string, Promise<unknown>>;
};

function memMap() {
  if (!memory.__bjRooms) memory.__bjRooms = new Map();
  return memory.__bjRooms;
}
function memLocks() {
  if (!memory.__bjLocks) memory.__bjLocks = new Map();
  return memory.__bjLocks;
}

export function usingBjRedis() {
  return hasRedis();
}

export async function getBjRoom(id: string): Promise<BjRoom | null> {
  if (hasRedis()) return (await getRedis().get<BjRoom>(KEY_PREFIX + id)) ?? null;
  return memMap().get(id) ?? null;
}

export async function saveBjRoom(room: BjRoom): Promise<void> {
  if (hasRedis()) {
    await getRedis().set(KEY_PREFIX + room.id, room, { ex: ROOM_TTL_SECONDS });
    return;
  }
  memMap().set(room.id, room);
}

export async function deleteBjRoom(id: string): Promise<void> {
  if (hasRedis()) {
    await getRedis().del(KEY_PREFIX + id);
    return;
  }
  memMap().delete(id);
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

export async function updateBjRoom(
  id: string,
  updater: (room: BjRoom) => BjRoom | void,
): Promise<BjRoom> {
  const run = async () => {
    const room = await getBjRoom(id);
    if (!room) throw new RoomError("Room not found", 404);
    const draft = structuredClone(room);
    const next = updater(draft) ?? draft;
    next.revision = room.revision + 1;
    await saveBjRoom(next);
    return next;
  };
  if (hasRedis()) {
    const redis = getRedis();
    const token = lockToken();
    const lockKey = LOCK_PREFIX + id;
    for (let attempt = 0; attempt < 24; attempt++) {
      const acquired = await redis.set(lockKey, token, { nx: true, ex: 5 });
      if (acquired) {
        try {
          return await run();
        } finally {
          await redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            [lockKey],
            [token],
          );
        }
      }
      await new Promise((r) => setTimeout(r, 40 + attempt * 20));
    }
    throw new RoomError("Room is busy — try again", 409);
  }
  return withMemoryLock(id, run);
}
