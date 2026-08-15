import type { BjState } from "../engine";

export interface BjRoomPlayer {
  id: string;
  name: string;
  seat: number;
  lastSeenAt: number;
}

export interface BjRoom {
  id: string;
  revision: number;
  hostId: string;
  players: BjRoomPlayer[];
  state: BjState;
  createdAt: number;
}

export interface BjRoomView {
  id: string;
  revision: number;
  hostId: string;
  phase: BjState["phase"];
  players: BjRoomPlayer[];
  you: string | null;
  state: BjState;
  usingRedis: boolean;
}
