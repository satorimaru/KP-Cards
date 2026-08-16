import type { GameRules } from "@/lib/rules";
import type { Card, ComboType } from "@/lib/tienlen/types";

export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomPlayer {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  cardCount: number;
  /** Finish place 1..n when out; null if still playing. */
  finishOrder: number | null;
  lastSeenAt: number;
  /** Passed this trick; sat out until the next lead (unless playAfterPass). */
  satOut: boolean;
  /** Chip stack when Chips mode is on. */
  chips?: number;
  /** Times this player bought back in after going broke. */
  buyIns?: number;
  /** Running leftover-card score in 50 mode. */
  fiftyScore?: number;
  /** Points from the hand that just finished. */
  lastFiftyPoints?: number;
}

export interface ChipPay {
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
}

export type RoomEvent =
  | { kind: "join"; playerId: string }
  | { kind: "leave"; playerId: string }
  | { kind: "ready"; playerId: string; ready: boolean }
  | { kind: "start" }
  | {
      kind: "play";
      playerId: string;
      comboType: ComboType;
      cards: Card[];
      /** Who skip / draw 2 / draw 4 / a bomb hit. */
      targetPlayerId?: string;
      /** Cards added to the target on draw 2 / draw 4. */
      drawn?: number;
      /** Quad or chop that beat the pile. */
      bombed?: boolean;
      /** Uno card attached to this play. */
      uno?: "skip" | "reverse" | "draw2" | "draw4";
    }
  | { kind: "pass"; playerId: string }
  | { kind: "rematch" }
  | { kind: "buyin"; playerId: string; amount: number };

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  createdAt: number;
}

export const MAX_CHAT_TEXT = 160;

export interface Room {
  id: string;
  revision: number;
  status: RoomStatus;
  hostId: string;
  maxPlayers: 2 | 3 | 4;
  players: RoomPlayer[];
  /** Full hands keyed by player id — never send all hands to every client. */
  hands: Record<string, Card[]>;
  pile: Card[];
  pileType: ComboType | null;
  /** Earlier combos this lead, under the current pile. */
  trick: Card[][];
  currentPlayerId: string | null;
  lastPlayPlayerId: string | null;
  passesInRow: number;
  turnVersion: number;
  /** Opening lead must include this card; null after the first play. */
  leadCard: Card | null;
  winners: string[];
  lastEvent: RoomEvent | null;
  /** Newest last. Capped in sendMessage. */
  messages: ChatMessage[];
  rules: GameRules;
  direction: 1 | -1;
  turnStartedAt: number | null;
  startedAt: number | null;
  createdAt: number;
  /** Leftover undealt cards for Uno draw 2 / draw 4. */
  stock: Card[];
  /** Played cards no longer on the pile. Recycled when stock is empty. */
  discard: Card[];
  /** Seats that passed this trick. */
  satOut: number[];
  /** Chip pays from the hand that just finished. */
  lastChipPays?: ChipPay[];
}

export interface RoomView {
  id: string;
  revision: number;
  status: RoomStatus;
  hostId: string;
  maxPlayers: 2 | 3 | 4;
  players: RoomPlayer[];
  hand: Card[];
  pile: Card[];
  pileType: ComboType | null;
  trick: Card[][];
  currentPlayerId: string | null;
  lastPlayPlayerId: string | null;
  passesInRow: number;
  turnVersion: number;
  leadCard: Card | null;
  winners: string[];
  lastEvent: RoomEvent | null;
  messages: ChatMessage[];
  rules: GameRules;
  direction: 1 | -1;
  turnStartedAt: number | null;
  startedAt: number | null;
  createdAt: number;
  lastChipPays?: ChipPay[];
  you: string | null;
  usingRedis: boolean;
}
