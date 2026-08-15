import type { HoldemState } from "../types";
import type { HoldemView } from "../view";

export interface HoldemRoomPlayer {
  id: string;
  name: string;
  seat: number;
  lastSeenAt: number;
}

export interface HoldemRoom {
  id: string;
  revision: number;
  hostId: string;
  players: HoldemRoomPlayer[];
  state: HoldemState;
  createdAt: number;
}

export interface HoldemRoomView {
  id: string;
  revision: number;
  hostId: string;
  status: HoldemState["status"];
  players: HoldemRoomPlayer[];
  you: string | null;
  view: HoldemView | null;
  usingRedis: boolean;
}
