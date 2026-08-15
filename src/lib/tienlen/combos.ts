import {
  type Card,
  type Combo,
  type ComboType,
  cardKind,
  cardValue,
  isJoker,
  isSpecial,
  isUnoCard,
  isUnoComboType,
  isUnoKind,
  rankIndex,
  sortCards,
} from "./types";

function highestCard(cards: Card[]): Card {
  return cards.reduce((best, c) =>
    cardValue(c) > cardValue(best) ? c : best,
  );
}

function isConsecutiveRanks(ranks: number[]): boolean {
  if (ranks.length < 2) return true;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

function detectNatural(cards: Card[]): Combo | null {
  if (cards.length === 0 || cards.some(isSpecial)) return null;
  const sorted = sortCards(cards);
  const n = sorted.length;

  if (n === 1) {
    return {
      type: "single",
      cards: sorted,
      highCard: sorted[0],
      length: 1,
    };
  }

  if (n >= 2 && n <= 4) {
    const rank = sorted[0].rank;
    if (sorted.every((c) => c.rank === rank)) {
      const type: ComboType =
        n === 2 ? "pair" : n === 3 ? "triple" : "quad";
      return {
        type,
        cards: sorted,
        highCard: highestCard(sorted),
        length: n,
      };
    }
  }

  if (n >= 3) {
    const ranks = sorted.map((c) => rankIndex(c.rank));
    if (
      sorted.every((c) => c.rank !== "2") &&
      new Set(ranks).size === n &&
      isConsecutiveRanks(ranks)
    ) {
      return {
        type: "sequence",
        cards: sorted,
        highCard: highestCard(sorted),
        length: n,
      };
    }
  }

  if (n >= 6 && n % 2 === 0) {
    const byRank = new Map<number, Card[]>();
    for (const c of sorted) {
      if (c.rank === "2") return null;
      const ri = rankIndex(c.rank);
      const list = byRank.get(ri) ?? [];
      list.push(c);
      byRank.set(ri, list);
    }
    const rankKeys = [...byRank.keys()].sort((a, b) => a - b);
    const pairCount = n / 2;
    if (
      rankKeys.length === pairCount &&
      rankKeys.every((k) => (byRank.get(k)?.length ?? 0) === 2) &&
      isConsecutiveRanks(rankKeys)
    ) {
      return {
        type: "double_sequence",
        cards: sorted,
        highCard: highestCard(sorted),
        length: pairCount,
      };
    }
  }

  return null;
}

function resolveJokerFace(card: Card): Card | null {
  if (!isJoker(card)) return { ...card, kind: "std", token: undefined, as: undefined };
  if (!card.as) return null;
  if (card.as.rank === "2") return null;
  return { rank: card.as.rank, suit: card.as.suit };
}

function detectWithJokers(cards: Card[]): Combo | null {
  const rest = cards.filter((c) => !isJoker(c));
  if (rest.some(isSpecial)) return null;

  const faces: Card[] = [];
  for (const card of cards.filter(isJoker)) {
    const face = resolveJokerFace(card);
    if (!face) return null;
    faces.push(face);
  }

  const found = detectNatural([...rest, ...faces]);
  if (!found) return null;
  if (found.type === "quad" || found.type === "double_sequence") return null;
  return {
    ...found,
    cards: sortCards(cards),
  };
}

/**
 * Detect a single legal combo from the exact set of selected cards.
 * Jokers fill any rank/suit except bombs and four-of-a-kind.
 */
export function detectCombo(cards: Card[]): Combo | null {
  if (cards.length === 0) return null;

  const unos = cards.filter(isUnoCard);
  if (unos.length > 1) return null;
  const rest = cards.filter((c) => !isUnoCard(c));
  if (unos.length === 1 && rest.length === 0) return null;

  const found = rest.some(isJoker)
    ? detectWithJokers(rest)
    : detectNatural(rest);
  if (!found) return null;

  if (unos.length === 1) {
    const kind = cardKind(unos[0]);
    if (!isUnoKind(kind)) return null;
    return {
      ...found,
      cards: sortCards(cards),
      uno: kind,
    };
  }
  return found;
}

function isTwos(combo: Combo): boolean {
  const naturals = combo.cards.filter((c) => !isUnoCard(c));
  return (
    (combo.type === "single" ||
      combo.type === "pair" ||
      combo.type === "triple") &&
    naturals.length > 0 &&
    naturals.every((c) => c.rank === "2" && !isSpecial(c))
  );
}

/**
 * Southern bomb ladder vs 2s:
 * - single 2  ← quad or 3+ consecutive pairs
 * - pair of 2s ← 4+ consecutive pairs
 * - triple 2s ← 5+ consecutive pairs
 */
function bombBeatsTwos(play: Combo, pile: Combo): boolean {
  if (!isTwos(pile)) return false;
  if (pile.type === "single") {
    if (play.type === "quad") return true;
    return play.type === "double_sequence" && play.length >= 3;
  }
  if (pile.type === "pair") {
    return play.type === "double_sequence" && play.length >= 4;
  }
  if (pile.type === "triple") {
    return play.type === "double_sequence" && play.length >= 5;
  }
  return false;
}

/**
 * Can `play` beat `pile`?
 * Empty pile: any legal combo.
 * Uno action cards do not climb against regular sets.
 */
export function beats(play: Combo, pile: Combo | null): boolean {
  if (!pile) return true;
  if (isUnoComboType(play.type) || isUnoComboType(pile.type)) return false;

  if (bombBeatsTwos(play, pile)) return true;

  if (play.type === "quad" && pile.type === "quad") {
    return cardValue(play.highCard) > cardValue(pile.highCard);
  }
  if (play.type === "double_sequence" && pile.type === "double_sequence") {
    if (play.length !== pile.length) return false;
    return cardValue(play.highCard) > cardValue(pile.highCard);
  }

  if (play.type !== pile.type) return false;
  if (play.length !== pile.length) return false;
  return cardValue(play.highCard) > cardValue(pile.highCard);
}

export function isBomb(combo: Combo): boolean {
  return (
    combo.type === "quad" ||
    (combo.type === "double_sequence" && combo.length >= 3)
  );
}

export function comboLabel(type: ComboType): string {
  switch (type) {
    case "single":
      return "single";
    case "pair":
      return "pair";
    case "triple":
      return "triple";
    case "quad":
      return "four of a kind";
    case "sequence":
      return "sequence";
    case "double_sequence":
      return "double sequence";
    case "skip":
      return "skip";
    case "reverse":
      return "reverse";
    case "draw2":
      return "draw 2";
    case "draw4":
      return "draw 4";
  }
}
