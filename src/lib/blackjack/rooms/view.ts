import { usingBjRedis } from "./store";
import type { BjRoom, BjRoomView } from "./types";

export function toBjRoomView(room: BjRoom, playerId?: string): BjRoomView {
  const seated = room.players.find((p) => p.id === playerId) ?? null;
  const state = structuredClone(room.state);
  if (state.phase !== "settle" && state.dealer[1]) {
    state.dealer[1] = { rank: "3", suit: "S" };
  }
  return {
    id: room.id,
    revision: room.revision,
    hostId: room.hostId,
    phase: room.state.phase,
    players: room.players,
    you: seated?.id ?? null,
    state,
    usingRedis: usingBjRedis(),
  };
}
