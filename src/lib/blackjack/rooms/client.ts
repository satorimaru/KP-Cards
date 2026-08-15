import type { BjRoomView } from "./types";

export async function fetchBjRoom(roomId: string, playerId: string): Promise<BjRoomView> {
  const res = await fetch(
    `/api/blackjack/rooms/${encodeURIComponent(roomId)}?playerId=${encodeURIComponent(playerId)}`,
    { cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Room not found");
  return data.room as BjRoomView;
}

export async function postBjRoom(
  roomId: string,
  body: Record<string, unknown>,
): Promise<BjRoomView | null> {
  const res = await fetch(`/api/blackjack/rooms/${encodeURIComponent(roomId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return (data.room ?? null) as BjRoomView | null;
}

export async function createBjRoomRequest(input: {
  playerId: string;
  playerName: string;
}): Promise<BjRoomView> {
  const res = await fetch("/api/blackjack/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create room");
  return data.room as BjRoomView;
}
