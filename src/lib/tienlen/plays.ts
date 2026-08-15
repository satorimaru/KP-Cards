import { detectCombo } from "./combos";
import { validatePlay, type HandState } from "./engine";
import {
  type Card,
  type Combo,
  type Rank,
  type Suit,
  rankIndex,
  sortCards,
  SUITS,
  WILD_RANKS,
} from "./types";

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];
  const out: T[][] = [];
  const acc: T[] = [];
  const rec = (start: number) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i <= items.length - (k - acc.length); i++) {
      acc.push(items[i]);
      rec(i + 1);
      acc.pop();
    }
  };
  rec(0);
  return out;
}

function byRank(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const card of sortCards(cards)) {
    if (card.kind && card.kind !== "std") continue;
    const ri = rankIndex(card.rank);
    const list = map.get(ri) ?? [];
    list.push(card);
    map.set(ri, list);
  }
  return map;
}

function pushCombo(out: Combo[], cards: Card[]): void {
  const combo = detectCombo(cards);
  if (combo) out.push(combo);
}

/**
 * Legal shapes from a hand. Suit choices on lower ranks of a run use the
 * weakest cards — only the top rank is varied, since that sets highCard.
 */
export function enumerateCombos(hand: Card[]): Combo[] {
  const out: Combo[] = [];
  const sorted = sortCards(hand);
  const ranks = byRank(sorted);

  const jokers = sorted.filter((c) => c.kind === "joker");
  const naturals = sorted.filter((c) => !c.kind || c.kind === "std");

  function face(joker: Card, rank: Rank, suit: Suit): Card {
    return { ...joker, as: { rank, suit } };
  }

  const unos = sorted.filter((c) => c.kind === "skip" || c.kind === "reverse" || c.kind === "draw2" || c.kind === "draw4");

  for (const card of sorted) {
    if (card.kind === "skip" || card.kind === "reverse" || card.kind === "draw2" || card.kind === "draw4") {
      continue;
    }
    if (card.kind === "joker") {
      for (const rank of WILD_RANKS) {
        for (const suit of SUITS) {
          pushCombo(out, [face(card, rank, suit)]);
        }
      }
      continue;
    }
    pushCombo(out, [card]);
  }

  for (const joker of jokers) {
    for (const card of naturals) {
      if (card.rank === "2") continue;
      for (const suit of SUITS) {
        if (suit === card.suit) continue;
        pushCombo(out, [face(joker, card.rank, suit), card]);
      }
    }
  }
  if (jokers.length >= 2) {
    const [a, b] = jokers;
    for (const rank of WILD_RANKS) {
      pushCombo(out, [face(a, rank, "S"), face(b, rank, "C")]);
    }
  }

  for (const group of ranks.values()) {
    if (group.length >= 2) {
      for (const pair of combinations(group, 2)) pushCombo(out, pair);
    }
    if (group.length >= 3) {
      for (const trip of combinations(group, 3)) pushCombo(out, trip);
    }
    if (group.length === 4) pushCombo(out, group);
  }

  // 3..A are indices 0..11. 2s cannot appear in runs.
  for (let start = 0; start <= 9; start++) {
    for (let len = 3; start + len - 1 <= 11; len++) {
      const needed: number[] = [];
      let ok = true;
      for (let i = 0; i < len; i++) {
        const r = start + i;
        if (!ranks.has(r)) {
          ok = false;
          break;
        }
        needed.push(r);
      }
      if (!ok) continue;

      const top = needed[needed.length - 1];
      const body: Card[] = [];
      for (const r of needed.slice(0, -1)) {
        body.push(ranks.get(r)![0]);
      }
      for (const topCard of ranks.get(top)!) {
        pushCombo(out, [...body, topCard]);
      }
    }
  }

  for (let start = 0; start <= 9; start++) {
    for (let pairs = 3; start + pairs - 1 <= 11; pairs++) {
      const needed: number[] = [];
      let ok = true;
      for (let i = 0; i < pairs; i++) {
        const r = start + i;
        const group = ranks.get(r);
        if (!group || group.length < 2) {
          ok = false;
          break;
        }
        needed.push(r);
      }
      if (!ok) continue;

      const top = needed[needed.length - 1];
      const body: Card[] = [];
      for (const r of needed.slice(0, -1)) {
        body.push(ranks.get(r)![0], ranks.get(r)![1]);
      }
      for (const topPair of combinations(ranks.get(top)!, 2)) {
        pushCombo(out, [...body, ...topPair]);
      }
    }
  }

  if (unos.length === 0) return out;

  const attached: Combo[] = [];
  for (const base of out) {
    if (base.uno) continue;
    for (const uno of unos) {
      const kind = uno.kind;
      if (
        kind !== "skip" &&
        kind !== "reverse" &&
        kind !== "draw2" &&
        kind !== "draw4"
      ) {
        continue;
      }
      attached.push({
        ...base,
        cards: sortCards([...base.cards, uno]),
        uno: kind,
      });
    }
  }
  return [...out, ...attached];
}

export function legalPlays(state: HandState, seat: number): Combo[] {
  return enumerateCombos(state.hands[seat] ?? []).filter(
    (combo) => validatePlay(state, seat, combo.cards).ok,
  );
}
