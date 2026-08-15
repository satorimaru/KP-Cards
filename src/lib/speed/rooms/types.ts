import type { SpeedState, SpeedStatus } from "../types";
import type { SpeedView } from "../view";

export interface SpeedRoomPlayer {
  id: string;
  name: string;
  seat: 0 | 1;
  lastSeenAt: number;
}

export interface SpeedRoom {
  id: string;
  revision: number;
  hostId: string;
  players: SpeedRoomPlayer[];
  state: SpeedState;
  createdAt: number;
}

export interface SpeedRoomView {
  id: string;
  revision: number;
  hostId: string;
  status: SpeedStatus;
  players: SpeedRoomPlayer[];
  you: string | null;
  names: [string, string];
  view: SpeedView | null;
  usingRedis: boolean;
}
