export type Rank =
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A"
  | "2";

export type Suit = "S" | "C" | "D" | "H"; // spades < clubs < diamonds < hearts

export type CardKind = "std" | "joker" | "skip" | "reverse" | "draw2" | "draw4";

export interface Card {
  rank: Rank;
  suit: Suit;
  kind?: CardKind;
  /** Stable id for jokers / Uno cards (JK1, SK1, D2, …). */
  token?: string;
  /** Face a joker stands for when played. Required on play; never a 2. */
  as?: { rank: Rank; suit: Suit };
}

export type ComboType =
  | "single"
  | "pair"
  | "triple"
  | "quad"
  | "sequence"
  | "double_sequence"
  | "skip"
  | "reverse"
  | "draw2"
  | "draw4";

export type UnoEffect = "skip" | "reverse" | "draw2" | "draw4";

export interface Combo {
  type: ComboType;
  cards: Card[];
  /** Highest card in the combo (for ranking). */
  highCard: Card;
  /** Sequence length in ranks (pair-count for double_sequence). */
  length: number;
  /** Uno card played on top of this combo. */
  uno?: UnoEffect;
}

export const RANKS: Rank[] = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "2",
];

export const SUITS: Suit[] = ["S", "C", "D", "H"];

/** Ranks a joker may name. Heos are banned. */
export const WILD_RANKS: Rank[] = RANKS.filter((rank) => rank !== "2");

export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

export function cardKind(card: Card): CardKind {
  return card.kind ?? "std";
}

export function isJoker(card: Card): boolean {
  return cardKind(card) === "joker";
}

export function isUnoKind(
  kind: CardKind,
): kind is "skip" | "reverse" | "draw2" | "draw4" {
  return kind === "skip" || kind === "reverse" || kind === "draw2" || kind === "draw4";
}

export function isUnoCard(card: Card): boolean {
  return isUnoKind(cardKind(card));
}

export function isUnoComboType(type: ComboType): boolean {
  return (
    type === "skip" ||
    type === "reverse" ||
    type === "draw2" ||
    type === "draw4"
  );
}

export function drawCountFor(type: ComboType): number {
  if (type === "draw2") return 2;
  if (type === "draw4") return 4;
  return 0;
}



export function isSpecial(card: Card): boolean {
  return cardKind(card) !== "std";
}

/** Rank/suit a card counts as. Named jokers use their face. */
export function faceOf(card: Card): { rank: Rank; suit: Suit } {
  if (isJoker(card) && card.as) return card.as;
  return { rank: card.rank, suit: card.suit };
}

/** Drop a play-time joker face. Hands, stock, and discard are always unnamed. */
export function heldCard(card: Card): Card {
  if (!card.as) return card;
  const { as: _named, ...rest } = card;
  return rest;
}

/** Total order: named face first, then suit. Unnamed jokers / Uno sit after 2s. */
export function cardValue(card: Card): number {
  if (isJoker(card) && !card.as) return 200;
  if (cardKind(card) === "skip") return 201;
  if (cardKind(card) === "reverse") return 202;
  if (cardKind(card) === "draw2") return 203;
  if (cardKind(card) === "draw4") return 204;
  const face = faceOf(card);
  return rankIndex(face.rank) * 4 + suitIndex(face.suit);
}

const TOKEN_KIND: Record<string, CardKind> = {
  JK: "joker",
  SK: "skip",
  RV: "reverse",
  D2: "draw2",
  D4: "draw4",
};

export function cardId(card: Card): string {
  if (card.token) return card.token;
  if (isJoker(card)) return "JK";
  if (cardKind(card) === "skip") return "SK";
  if (cardKind(card) === "reverse") return "RV";
  if (cardKind(card) === "draw2") return "D2";
  if (cardKind(card) === "draw4") return "D4";
  return `${card.rank}${card.suit}`;
}

export function parseCardId(id: string): Card | null {
  const raw = String(id).toUpperCase();
  const special = raw.match(/^(JK|SK|RV|D2|D4)(\d+)?$/);
  if (special) {
    const kind = TOKEN_KIND[special[1]];
    return {
      rank: "3",
      suit: "S",
      kind,
      token: raw,
    };
  }
  const m = raw.match(/^(10|[3-9JQKA2])([SCDH])$/);
  if (!m) return null;
  return { rank: m[1] as Rank, suit: m[2] as Suit };
}

export function sameCard(a: Card, b: Card): boolean {
  if (isSpecial(a) || isSpecial(b)) return cardId(a) === cardId(b);
  return a.rank === b.rank && a.suit === b.suit;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardValue(a) - cardValue(b));
}

export function isThreeSpades(card: Card): boolean {
  return card.rank === "3" && card.suit === "S";
}

const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  C: "♣",
  D: "♦",
  H: "♥",
};

export function formatCard(card: Card): string {
  if (isJoker(card)) {
    if (card.as) {
      return `★=${card.as.rank}${SUIT_SYMBOL[card.as.suit]}`;
    }
    return "★";
  }
  if (cardKind(card) === "skip") return "⏭";
  if (cardKind(card) === "reverse") return "↻";
  if (cardKind(card) === "draw2") return "+2";
  if (cardKind(card) === "draw4") return "+4";
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

export function parseFace(input: unknown): { rank: Rank; suit: Suit } | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { rank?: unknown; suit?: unknown };
  const rank = String(raw.rank ?? "").toUpperCase();
  const suit = String(raw.suit ?? "").toUpperCase();
  if (!WILD_RANKS.includes(rank as Rank)) return null;
  if (!SUITS.includes(suit as Suit)) return null;
  return { rank: rank as Rank, suit: suit as Suit };
}
