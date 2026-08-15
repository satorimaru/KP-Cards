import type { MessageKey } from "./i18n";

export type GameId = "tienlen" | "speed" | "holdem" | "blackjack";

export type GameStatus = "live" | "soon";

export interface GameInfo {
  id: GameId;
  href: string;
  status: GameStatus;
  title: MessageKey;
  tag: MessageKey;
  blurb: MessageKey;
}

export const GAMES: GameInfo[] = [
  {
    id: "tienlen",
    href: "/tienlen",
    status: "live",
    title: "catalog.tienlen",
    tag: "catalog.tienlenTag",
    blurb: "catalog.tienlenBlurb",
  },
  {
    id: "speed",
    href: "/speed",
    status: "live",
    title: "catalog.speed",
    tag: "catalog.speedTag",
    blurb: "catalog.speedBlurb",
  },
  {
    id: "holdem",
    href: "/holdem",
    status: "live",
    title: "catalog.holdem",
    tag: "catalog.holdemTag",
    blurb: "catalog.holdemBlurb",
  },
  {
    id: "blackjack",
    href: "/blackjack",
    status: "live",
    title: "catalog.blackjack",
    tag: "catalog.blackjackTag",
    blurb: "catalog.blackjackBlurb",
  },
];

export function gameById(id: GameId): GameInfo {
  const found = GAMES.find((game) => game.id === id);
  if (!found) throw new Error(`Unknown game: ${id}`);
  return found;
}
