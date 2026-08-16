import { customAlphabet } from "nanoid";
import { detectCombo } from "@/lib/tienlen/combos";
import {
  applyPass,
  applyPlay,
  createHandState,
  isGameFinished,
  lowestCardInPlay,
  type HandState,
  validatePass,
  validatePlay,
} from "@/lib/tienlen/engine";
import { heldCard, parseCardId, parseFace, type Card } from "@/lib/tienlen/types";
import { RoomError } from "./errors";
import { deleteRoom, getRoom, saveRoom, updateRoom, withRoomLock } from "./store";
import { chooseBotAction } from "@/lib/tienlen/bot";
import { BLITZ_MS, parseRules, type GameRules } from "@/lib/rules";
import { settleChips } from "@/lib/tienlen/chips";
import { fiftyMatchOver, leftoverPoints } from "@/lib/tienlen/fifty";
import { makePlayEvent } from "./playEvent";
import { MAX_CHAT_TEXT, type Room, type RoomPlayer } from "./types";

const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const chatId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

const MAX_CHAT_MESSAGES = 80;
const CHAT_GAP_MS = 400;

function now(): number {
  return Date.now();
}

function makePlayer(id: string, name: string, seat: number): RoomPlayer {
  return {
    id,
    name: name.trim().slice(0, 24) || "Player",
    seat,
    ready: false,
    cardCount: 0,
    finishOrder: null,
    lastSeenAt: now(),
    satOut: false,
    chips: undefined,
    buyIns: 0,
    fiftyScore: undefined,
    lastFiftyPoints: undefined,
  };
}

function seedChips(room: Room, force = false): void {
  const rules = parseRules(room.rules);
  if (!rules.chips) return;
  for (const p of room.players) {
    if (force || p.chips == null) {
      p.chips = rules.startChips;
      if (p.buyIns == null) p.buyIns = 0;
    }
  }
}

function seedFifty(room: Room, force = false): void {
  const rules = parseRules(room.rules);
  if (!rules.fifty) return;
  for (const p of room.players) {
    if (force || p.fiftyScore == null) {
      p.fiftyScore = 0;
      p.lastFiftyPoints = 0;
    }
  }
}

function applyFiftySettlement(room: Room, state: HandState): void {
  const rules = parseRules(room.rules);
  if (!rules.fifty) return;
  const points = leftoverPoints(state.hands, state.finishOrder);
  for (const p of room.players) {
    const delta = points[p.seat] ?? 0;
    p.fiftyScore = (p.fiftyScore ?? 0) + delta;
    p.lastFiftyPoints = delta;
  }
}

function applyChipSettlement(room: Room, finishSeats: number[]): void {
  const rules = parseRules(room.rules);
  if (!rules.chips || finishSeats.length < 2) return;
  const bySeat = Array.from({ length: room.players.length }, () => 0);
  for (const p of room.players) {
    bySeat[p.seat] = p.chips ?? rules.startChips;
  }
  const settled = settleChips(bySeat, finishSeats);
  for (const p of room.players) {
    p.chips = settled.chips[p.seat] ?? 0;
  }
  room.lastChipPays = settled.pays.map((pay) => ({
    fromPlayerId: room.players.find((p) => p.seat === pay.fromSeat)?.id ?? "",
    toPlayerId: room.players.find((p) => p.seat === pay.toSeat)?.id ?? "",
    amount: pay.amount,
  }));
}

function playerById(room: Room, playerId: string): RoomPlayer | null {
  return room.players.find((p) => p.id === playerId) ?? null;
}

function requirePlayer(room: Room, playerId: string): RoomPlayer {
  const player = playerById(room, playerId);
  if (!player) throw new RoomError("Not a player in this room", 403);
  return player;
}

function touch(room: Room, playerId: string): void {
  const player = playerById(room, playerId);
  if (player) player.lastSeenAt = now();
}

function reseat(room: Room): void {
  room.players.forEach((p, i) => {
    p.seat = i;
  });
}

function handStateFromRoom(room: Room): HandState {
  const hands: Card[][] = Array.from({ length: room.players.length }, () => []);
  for (const p of room.players) {
    hands[p.seat] = (room.hands[p.id] ?? []).map(heldCard);
  }

  const pile =
    room.pile.length > 0 && room.pileType ? detectCombo(room.pile) : null;

  const finishOrder = room.players
    .filter((p) => p.finishOrder != null)
    .sort((a, b) => (a.finishOrder ?? 0) - (b.finishOrder ?? 0))
    .map((p) => p.seat);

  const current = room.players.find((p) => p.id === room.currentPlayerId);
  const last = room.players.find((p) => p.id === room.lastPlayPlayerId);

  return {
    hands,
    pile,
    currentSeat: current?.seat ?? 0,
    lastPlaySeat: last?.seat ?? null,
    passesInRow: room.passesInRow,
    finishOrder,
    leadCard: room.leadCard,
    playerCount: room.players.length,
    rules: parseRules(room.rules),
    direction: room.direction === -1 ? -1 : 1,
    stock: room.stock ?? [],
    discard: room.discard ?? [],
    satOut: room.satOut ?? [],
    trick: (room.trick ?? [])
      .map((cards) => detectCombo(cards))
      .filter((combo): combo is NonNullable<typeof combo> => combo != null),
  };
}

function applyHandStateToRoom(room: Room, state: HandState): void {
  for (const p of room.players) {
    room.hands[p.id] = (state.hands[p.seat] ?? []).map(heldCard);
    p.cardCount = room.hands[p.id].length;
    const place = state.finishOrder.indexOf(p.seat);
    p.finishOrder = place >= 0 ? place + 1 : null;
  }

  room.pile = state.pile?.cards ?? [];
  room.pileType = state.pile?.type ?? null;
  room.trick = (state.trick ?? []).map((combo) => combo.cards);
  room.passesInRow = state.passesInRow;
  room.leadCard = state.leadCard;
  room.turnVersion += 1;
  room.direction = state.direction;
  room.turnStartedAt = now();
  room.stock = state.stock ?? [];
  room.discard = state.discard ?? [];
  room.satOut = state.satOut ?? [];
  const sat = new Set(room.satOut);
  for (const p of room.players) {
    p.satOut = sat.has(p.seat);
  }

  const cur = room.players.find((p) => p.seat === state.currentSeat);
  room.currentPlayerId = cur?.id ?? null;

  if (state.lastPlaySeat != null) {
    const last = room.players.find((p) => p.seat === state.lastPlaySeat);
    room.lastPlayPlayerId = last?.id ?? null;
  } else {
    room.lastPlayPlayerId = null;
  }

  room.winners = state.finishOrder.map(
    (seat) => room.players.find((p) => p.seat === seat)!.id,
  );

  if (isGameFinished(state) && room.status !== "finished") {
    applyChipSettlement(room, state.finishOrder);
    applyFiftySettlement(room, state);
    room.status = "finished";
  } else if (isGameFinished(state)) {
    room.status = "finished";
  }
}

export function parseCards(input: unknown): Card[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new RoomError("cards required", 400);
  }

  const cards: Card[] = [];
  for (const item of input) {
    if (typeof item === "string") {
      const card = parseCardId(item);
      if (!card) throw new RoomError("Invalid card", 400);
      cards.push(card);
      continue;
    }
    if (item && typeof item === "object") {
      const raw = item as {
        rank?: unknown;
        suit?: unknown;
        kind?: unknown;
        token?: unknown;
        as?: unknown;
      };
      const face = parseFace(raw.as);
      if (raw.token) {
        const card = parseCardId(String(raw.token));
        if (!card) throw new RoomError("Invalid card", 400);
        if (face) card.as = face;
        cards.push(card);
        continue;
      }
      if (
        raw.kind === "joker" ||
        raw.kind === "skip" ||
        raw.kind === "reverse" ||
        raw.kind === "draw2" ||
        raw.kind === "draw4"
      ) {
        cards.push({
          rank: "3",
          suit: "S",
          kind: raw.kind,
          token: String(raw.token ?? raw.kind),
          as: face ?? undefined,
        });
        continue;
      }
      if (raw.rank && raw.suit) {
        const card = parseCardId(`${String(raw.rank)}${String(raw.suit)}`);
        if (!card) throw new RoomError("Invalid card", 400);
        cards.push(card);
        continue;
      }
    }
    throw new RoomError("Invalid card", 400);
  }
  return cards;
}

export async function createRoom(
  hostId: string,
  hostName: string,
  maxPlayers: 2 | 3 | 4 = 4,
  rules?: Partial<GameRules>,
): Promise<Room> {
  if (![2, 3, 4].includes(maxPlayers)) {
    throw new RoomError("maxPlayers must be 2, 3, or 4", 400);
  }
  if (!hostId.trim()) {
    throw new RoomError("playerId required", 400);
  }

  const nextRules = parseRules(rules);
  if (nextRules.siege) maxPlayers = 4;

  const room: Room = {
    id: roomCode(),
    revision: 1,
    status: "waiting",
    hostId,
    maxPlayers,
    players: [makePlayer(hostId, hostName || "Host", 0)],
    hands: {},
    pile: [],
    pileType: null,
    currentPlayerId: null,
    lastPlayPlayerId: null,
    passesInRow: 0,
    turnVersion: 0,
    leadCard: null,
    winners: [],
    lastEvent: { kind: "join", playerId: hostId },
    messages: [],
    rules: nextRules,
    direction: 1,
    turnStartedAt: null,
    startedAt: null,
    createdAt: now(),
    stock: [],
    discard: [],
    satOut: [],
    trick: [],
    lastChipPays: [],
  };
  seedChips(room);
  seedFifty(room);

  await saveRoom(room);
  return room;
}

const HEARTBEAT_MS = 4000;

export async function getRoomForPlayer(
  roomId: string,
  playerId?: string,
): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) throw new RoomError("Room not found", 404);
  if (!playerId) return room;

  const seated = playerById(room, playerId);
  if (!seated) return room;
  if (now() - seated.lastSeenAt < HEARTBEAT_MS) return room;

  return withRoomLock(roomId, async () => {
    const latest = await getRoom(roomId);
    if (!latest) throw new RoomError("Room not found", 404);
    const player = playerById(latest, playerId);
    if (player && now() - player.lastSeenAt >= HEARTBEAT_MS) {
      player.lastSeenAt = now();
      await saveRoom(latest);
    }
    return latest;
  });
}

export async function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    touch(room, playerId);
    if (playerById(room, playerId)) return;

    if (room.status !== "waiting") {
      throw new RoomError("Game already started", 409);
    }
    if (room.players.length >= room.maxPlayers) {
      throw new RoomError("Room is full", 409);
    }

    room.players.push(
      makePlayer(playerId, playerName || "Guest", room.players.length),
    );
    seedChips(room);
    seedFifty(room);
    room.lastEvent = { kind: "join", playerId };
  });
}

export async function leaveRoom(
  roomId: string,
  playerId: string,
): Promise<Room | null> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId);
    if (!room) throw new RoomError("Room not found", 404);

    const player = requirePlayer(room, playerId);
    if (room.status === "playing") {
      throw new RoomError("Cannot leave in the middle of a hand", 409);
    }

    room.players = room.players.filter((p) => p.id !== playerId);
    delete room.hands[player.id];
    room.lastEvent = { kind: "leave", playerId };
    room.revision += 1;

    if (room.players.length === 0) {
      await deleteRoom(roomId);
      return null;
    }

    reseat(room);
    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
    }
    if (room.status === "finished") {
      room.status = "waiting";
      room.hands = {};
      room.pile = [];
      room.pileType = null;
      room.trick = [];
      room.currentPlayerId = null;
      room.lastPlayPlayerId = null;
      room.passesInRow = 0;
      room.turnVersion = 0;
      room.leadCard = null;
      room.winners = [];
      room.startedAt = null;
      room.stock = [];
      room.discard = [];
      room.satOut = [];
      for (const p of room.players) {
        p.ready = false;
        p.cardCount = 0;
        p.finishOrder = null;
        p.satOut = false;
      }
    }

    await saveRoom(room);
    return room;
  });
}

export async function setReady(
  roomId: string,
  playerId: string,
  ready: boolean,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    if (room.status !== "waiting") {
      throw new RoomError("Game already started", 409);
    }
    const player = requirePlayer(room, playerId);
    player.ready = ready;
    touch(room, playerId);
    room.lastEvent = { kind: "ready", playerId, ready };
  });
}

export async function startGame(
  roomId: string,
  playerId: string,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    if (room.hostId !== playerId) {
      throw new RoomError("Only the host can start", 403);
    }
    if (room.status !== "waiting") {
      throw new RoomError("Game already started", 409);
    }
    if (parseRules(room.rules).siege && room.players.length !== 4) {
      throw new RoomError("Team Siege needs 4 players", 400);
    }
    if (room.players.length < 2) {
      throw new RoomError("Need at least 2 players", 400);
    }
    if (room.players.some((p) => !p.ready)) {
      throw new RoomError("All players must be ready", 400);
    }
    const rules = parseRules(room.rules);
    if (rules.chips) {
      seedChips(room);
      if (room.players.some((p) => (p.chips ?? 0) <= 0)) {
        throw new RoomError("err.needChips", 400);
      }
    }
    if (rules.fifty) seedFifty(room);

    reseat(room);
    const state = createHandState(
      room.players.length,
      Math.random,
      parseRules(room.rules),
    );
    room.status = "playing";
    room.startedAt = now();
    room.winners = [];
    room.lastChipPays = [];
    if (rules.fifty) {
      for (const p of room.players) p.lastFiftyPoints = 0;
    }
    room.turnVersion = 0;
    room.hands = {};
    room.lastEvent = { kind: "start" };

    for (const p of room.players) {
      p.finishOrder = null;
      p.ready = false;
      room.hands[p.id] = state.hands[p.seat] ?? [];
      p.cardCount = room.hands[p.id].length;
    }

    room.pile = [];
    room.pileType = null;
    room.trick = [];
    room.passesInRow = 0;
    room.lastPlayPlayerId = null;
    assignOpeningLead(room);
    room.direction = 1;
    room.turnStartedAt = now();
    room.stock = state.stock ?? [];
    room.discard = state.discard ?? [];
    room.satOut = [];
    for (const p of room.players) p.satOut = false;
    touch(room, playerId);
  });
}

function assignOpeningLead(room: Room): void {
  const bySeat: Card[][] = Array.from(
    { length: room.players.length },
    () => [],
  );
  for (const p of room.players) {
    bySeat[p.seat] = room.hands[p.id] ?? [];
  }
  const opening = lowestCardInPlay(bySeat);
  if (!opening) {
    room.currentPlayerId = room.players[0]?.id ?? null;
    room.leadCard = null;
    return;
  }
  const player = room.players.find((p) => p.seat === opening.seat);
  room.currentPlayerId = player?.id ?? null;
  room.leadCard = opening.card;
}

function assertFreshTurn(room: Room, expectedVersion?: number): void {
  if (expectedVersion != null && expectedVersion !== room.turnVersion) {
    throw new RoomError("Stale turn — refresh and try again", 409);
  }
}

export async function playCards(
  roomId: string,
  playerId: string,
  cards: Card[],
  expectedVersion?: number,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    if (room.status !== "playing") {
      throw new RoomError("Game not in progress", 409);
    }
    assertFreshTurn(room, expectedVersion);
    const player = requirePlayer(room, playerId);
    touch(room, playerId);

    const state = handStateFromRoom(room);
    const check = validatePlay(state, player.seat, cards);
    if (!check.ok) throw new RoomError(check.error, 400);

    const next = applyPlay(state, player.seat, cards);
    applyHandStateToRoom(room, next);
    room.lastEvent = makePlayEvent(
      playerId,
      check.combo.type,
      cards,
      state,
      next,
      player.seat,
      room.players,
    );
  });
}

export async function passTurn(
  roomId: string,
  playerId: string,
  expectedVersion?: number,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    if (room.status !== "playing") {
      throw new RoomError("Game not in progress", 409);
    }
    assertFreshTurn(room, expectedVersion);
    const player = requirePlayer(room, playerId);
    touch(room, playerId);

    const state = handStateFromRoom(room);
    const check = validatePass(state, player.seat);
    if (!check.ok) throw new RoomError(check.error, 400);

    const next = applyPass(state, player.seat);
    applyHandStateToRoom(room, next);
    room.lastEvent = { kind: "pass", playerId };
  });
}

export async function rematchRoom(
  roomId: string,
  playerId: string,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    requirePlayer(room, playerId);
    if (room.status === "playing") {
      throw new RoomError("Finish the hand before a rematch", 409);
    }

    room.status = "waiting";
    room.hands = {};
    room.pile = [];
    room.pileType = null;
    room.currentPlayerId = null;
    room.lastPlayPlayerId = null;
    room.passesInRow = 0;
    room.turnVersion = 0;
    room.leadCard = null;
    room.winners = [];
    room.startedAt = null;
    room.direction = 1;
    room.turnStartedAt = null;
    room.stock = [];
    room.discard = [];
    room.satOut = [];
    room.trick = [];
    room.lastEvent = { kind: "rematch" };
    touch(room, playerId);

    for (const p of room.players) {
      p.ready = false;
      p.cardCount = 0;
      p.finishOrder = null;
      p.satOut = false;
    }
    const rules = parseRules(room.rules);
    if (rules.fifty) {
      const scores = room.players.map((p) => p.fiftyScore ?? 0);
      if (fiftyMatchOver(scores)) {
        for (const p of room.players) {
          p.fiftyScore = 0;
          p.lastFiftyPoints = 0;
        }
      }
    }
  });
}

export async function timeoutTurn(
  roomId: string,
  playerId: string,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    requirePlayer(room, playerId);
    if (room.status !== "playing") {
      throw new RoomError("Game not in progress", 409);
    }
    if (!parseRules(room.rules).blitz) {
      throw new RoomError("Blitz is off", 400);
    }
    if (!room.currentPlayerId) {
      throw new RoomError("No active turn", 400);
    }
    const started = room.turnStartedAt ?? 0;
    if (now() - started < BLITZ_MS - 250) {
      throw new RoomError("Timer still running", 409);
    }

    const state = handStateFromRoom(room);
    const seat =
      room.players.find((p) => p.id === room.currentPlayerId)?.seat ?? 0;
    const action = chooseBotAction(state, seat);
    const actor = room.currentPlayerId;

    if (action.type === "pass") {
      const check = validatePass(state, seat);
      if (!check.ok) {
        throw new RoomError(check.error, 400);
      }
      applyHandStateToRoom(room, applyPass(state, seat));
      room.lastEvent = { kind: "pass", playerId: actor };
      return;
    }

    const check = validatePlay(state, seat, action.cards);
    if (!check.ok) {
      throw new RoomError(check.error, 400);
    }
    const next = applyPlay(state, seat, action.cards);
    applyHandStateToRoom(room, next);
    room.lastEvent = makePlayEvent(
      actor,
      check.combo.type,
      action.cards,
      state,
      next,
      seat,
      room.players,
    );
  });
}

export async function setRoomRules(
  roomId: string,
  playerId: string,
  raw: unknown,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    if (room.hostId !== playerId) {
      throw new RoomError("Only the host can change rules", 403);
    }
    if (room.status !== "waiting") {
      throw new RoomError("Rules are locked after the deal", 409);
    }
    requirePlayer(room, playerId);
    const next = parseRules(raw);
    const played = (room.lastChipPays ?? []).length > 0
      || room.players.some((p) => (p.buyIns ?? 0) > 0);
    room.rules = next;
    if (next.siege) room.maxPlayers = 4;
    if (next.chips) seedChips(room, !played);
    if (next.fifty) seedFifty(room, !room.players.some((p) => p.fiftyScore != null));
    if (!next.fifty) {
      for (const p of room.players) {
        p.fiftyScore = undefined;
        p.lastFiftyPoints = undefined;
      }
    }
  });
}

export async function buyIn(
  roomId: string,
  playerId: string,
): Promise<Room> {
  return updateRoom(roomId, (room) => {
    const player = requirePlayer(room, playerId);
    const rules = parseRules(room.rules);
    if (!rules.chips) throw new RoomError("err.chipsOff", 400);
    if (room.status === "playing") {
      throw new RoomError("Finish the hand before a buy-in", 409);
    }
    if ((player.chips ?? 0) > 0) throw new RoomError("err.notBroke", 400);
    player.chips = (player.chips ?? 0) + rules.startChips;
    player.buyIns = (player.buyIns ?? 0) + 1;
    room.lastEvent = {
      kind: "buyin",
      playerId,
      amount: rules.startChips,
    };
    touch(room, playerId);
  });
}

export async function sendMessage(
  roomId: string,
  playerId: string,
  rawText: unknown,
): Promise<Room> {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) throw new RoomError("Message required", 400);
  if (text.length > MAX_CHAT_TEXT) {
    throw new RoomError(`Keep it under ${MAX_CHAT_TEXT} characters`, 400);
  }

  return updateRoom(roomId, (room) => {
    const player = requirePlayer(room, playerId);
    touch(room, playerId);

    const messages = room.messages ?? [];
    const lastOwn = [...messages]
      .reverse()
      .find((m) => m.playerId === playerId);
    if (lastOwn && now() - lastOwn.createdAt < CHAT_GAP_MS) {
      throw new RoomError("Slow down", 429);
    }

    messages.push({
      id: chatId(),
      playerId,
      name: player.name,
      text,
      createdAt: now(),
    });
    room.messages =
      messages.length > MAX_CHAT_MESSAGES
        ? messages.slice(-MAX_CHAT_MESSAGES)
        : messages;
  });
}
