import type { Card } from "@/lib/tienlen/types";
import type { RoomView } from "./types";

export async function fetchRoom(
  roomId: string,
  playerId: string,
): Promise<RoomView> {
  const res = await fetch(
    `/api/rooms/${encodeURIComponent(roomId)}?playerId=${encodeURIComponent(playerId)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Room not found");
  return data.room as RoomView;
}

export async function postRoom(
  roomId: string,
  body: Record<string, unknown>,
): Promise<RoomView | null> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return (data.room ?? null) as RoomView | null;
}

export async function createRoomRequest(input: {
  playerId: string;
  playerName: string;
  maxPlayers: 2 | 3 | 4;
  rules?: unknown;
}): Promise<RoomView> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create room");
  return data.room as RoomView;
}

export function playBody(
  playerId: string,
  cards: Card[],
  turnVersion: number,
): Record<string, unknown> {
  return { action: "play", playerId, cards, turnVersion };
}

export function chatBody(
  playerId: string,
  text: string,
): Record<string, unknown> {
  return { action: "chat", playerId, text };
}
