import { toHoldemView } from "../view";
import { usingHoldemRedis } from "./store";
import type { HoldemRoom, HoldemRoomView } from "./types";

export function toHoldemRoomView(
  room: HoldemRoom,
  playerId?: string,
): HoldemRoomView {
  const seated = room.players.find((p) => p.id === playerId) ?? null;
  return {
    id: room.id,
    revision: room.revision,
    hostId: room.hostId,
    status: room.state.status,
    players: room.players,
    you: seated?.id ?? null,
    view: seated ? toHoldemView(room.state, seated.seat) : null,
    usingRedis: usingHoldemRedis(),
  };
}
