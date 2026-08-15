import type { HoldemActionKind } from "../types";
import type { HoldemRoomView } from "./types";

export async function fetchHoldemRoom(
  roomId: string,
  playerId: string,
): Promise<HoldemRoomView> {
  const res = await fetch(
    `/api/holdem/rooms/${encodeURIComponent(roomId)}?playerId=${encodeURIComponent(playerId)}`,
    { cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Room not found");
  return data.room as HoldemRoomView;
}

export async function postHoldemRoom(
  roomId: string,
  body: Record<string, unknown>,
): Promise<HoldemRoomView | null> {
  const res = await fetch(`/api/holdem/rooms/${encodeURIComponent(roomId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return (data.room ?? null) as HoldemRoomView | null;
}

export async function createHoldemRoomRequest(input: {
  playerId: string;
  playerName: string;
}): Promise<HoldemRoomView> {
  const res = await fetch("/api/holdem/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create room");
  return data.room as HoldemRoomView;
}

export function holdemActBody(
  playerId: string,
  kind: HoldemActionKind,
  raiseTo?: number,
): Record<string, unknown> {
  return { action: "act", playerId, kind, raiseTo };
}
