import { toSpeedView } from "../view";
import { usingSpeedRedis } from "./store";
import type { SpeedRoom, SpeedRoomView } from "./types";

export function toSpeedRoomView(
  room: SpeedRoom,
  playerId?: string,
): SpeedRoomView {
  const seated = room.players.find((p) => p.id === playerId) ?? null;
  const names: [string, string] = [
    room.players.find((p) => p.seat === 0)?.name ?? "",
    room.players.find((p) => p.seat === 1)?.name ?? "",
  ];
  return {
    id: room.id,
    revision: room.revision,
    hostId: room.hostId,
    status: room.state.status,
    players: room.players,
    you: seated?.id ?? null,
    names,
    view: seated ? toSpeedView(room.state, seated.seat) : null,
    usingRedis: usingSpeedRedis(),
  };
}
