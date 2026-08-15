export interface GameRules {
  /** 3-player deals use 17 cards when on; 13 when off. 2 and 4 stay at 13. */
  threePlayerSeventeen: boolean;
  /** Cannot empty your hand with a combo that includes a 2. */
  noFinishOnTwo: boolean;
  /** Two jokers replace random cards. Wild, but not in bombs or quads. */
  chaos: boolean;
  /** 8-second turn clock. Time out plays or passes. */
  blitz: boolean;
  /** 2v2. First team with both players out wins. Needs 4 seats. */
  siege: boolean;
  /** Uno: one skip, one reverse, one draw 2, one draw 4. */
  uno: boolean;
  /** If on, a pass does not sit you out — you can play when it comes back. */
  playAfterPass: boolean;
}

export const DEFAULT_RULES: GameRules = {
  threePlayerSeventeen: true,
  noFinishOnTwo: false,
  chaos: false,
  blitz: false,
  siege: false,
  uno: false,
  playAfterPass: false,
};

export const BLITZ_MS = 8000;

export function parseRules(input: unknown): GameRules {
  const raw =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return {
    threePlayerSeventeen: raw.threePlayerSeventeen !== false,
    noFinishOnTwo: raw.noFinishOnTwo === true,
    chaos: raw.chaos === true,
    blitz: raw.blitz === true,
    siege: raw.siege === true,
    uno: raw.uno === true || raw.powerup === true,
    playAfterPass: raw.playAfterPass === true,
  };
}

export function cardsPerHand(
  playerCount: number,
  rules: GameRules = DEFAULT_RULES,
): number {
  if (rules.uno) return 14;
  if (playerCount === 3 && rules.threePlayerSeventeen) return 17;
  return 13;
}

export function teamOf(seat: number): 0 | 1 {
  return seat % 2 === 0 ? 0 : 1;
}
