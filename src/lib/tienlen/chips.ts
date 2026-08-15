export const START_CHIP_CHOICES = [5, 10, 20, 50] as const;

export const DEFAULT_START_CHIPS = 10;

export function parseStartChips(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_START_CHIPS;
  return Math.min(99, Math.max(1, Math.round(n)));
}

/** Place indexes (0 = 1st) who pay whom, and how many chips. */
export function chipPayouts(
  playerCount: number,
): { fromPlace: number; toPlace: number; amount: number }[] {
  if (playerCount === 4) {
    return [
      { fromPlace: 3, toPlace: 0, amount: 2 },
      { fromPlace: 2, toPlace: 1, amount: 1 },
    ];
  }
  if (playerCount === 3) {
    return [{ fromPlace: 2, toPlace: 0, amount: 2 }];
  }
  if (playerCount === 2) {
    return [{ fromPlace: 1, toPlace: 0, amount: 2 }];
  }
  return [];
}

export interface SeatPay {
  fromSeat: number;
  toSeat: number;
  amount: number;
}

/** `finishOrder` is seats in place order (1st first). Pays what the loser has. */
export function settleChips(
  chips: number[],
  finishOrder: number[],
): { chips: number[]; pays: SeatPay[] } {
  const next = chips.map((n) => Math.max(0, n));
  const pays: SeatPay[] = [];
  const n = finishOrder.length;
  for (const spec of chipPayouts(n)) {
    const fromSeat = finishOrder[spec.fromPlace];
    const toSeat = finishOrder[spec.toPlace];
    if (fromSeat == null || toSeat == null || fromSeat === toSeat) continue;
    const amount = Math.min(next[fromSeat] ?? 0, spec.amount);
    if (amount <= 0) continue;
    next[fromSeat] -= amount;
    next[toSeat] = (next[toSeat] ?? 0) + amount;
    pays.push({ fromSeat, toSeat, amount });
  }
  return { chips: next, pays };
}
