import { cardId, type Card } from "@/lib/tienlen/types";
import type { SpeedRoomView } from "./types";

export async function fetchSpeedRoom(
  roomId: string,
  playerId: string,
): Promise<SpeedRoomView> {
  const res = await fetch(
    `/api/speed/rooms/${encodeURIComponent(roomId)}?playerId=${encodeURIComponent(playerId)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Room not found");
  return data.room as SpeedRoomView;
}

export async function postSpeedRoom(
  roomId: string,
  body: Record<string, unknown>,
): Promise<SpeedRoomView | null> {
  const res = await fetch(`/api/speed/rooms/${encodeURIComponent(roomId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return (data.room ?? null) as SpeedRoomView | null;
}

export async function createSpeedRoomRequest(input: {
  playerId: string;
  playerName: string;
}): Promise<SpeedRoomView> {
  const res = await fetch("/api/speed/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create room");
  return data.room as SpeedRoomView;
}

export function speedPlayBody(
  playerId: string,
  card: Card,
  pile: 0 | 1,
): Record<string, unknown> {
  return { action: "play", playerId, card: cardId(card), pile };
}
