"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BLITZ_MS } from "@/lib/rules";
import { chooseBotAction } from "@/lib/tienlen/bot";
import {
  applyPass,
  applyPlay,
  createHandState,
  isGameFinished,
  validatePass,
  validatePlay,
  type HandState,
} from "@/lib/tienlen/engine";
import type { Card } from "@/lib/tienlen/types";
import { makePlayEvent } from "@/lib/rooms/playEvent";
import type { ChipPay, RoomEvent } from "@/lib/rooms/types";
import { getSettings } from "@/lib/settings";
import { parseRules } from "@/lib/rules";
import { settleChips } from "@/lib/tienlen/chips";
import { fiftyMatchOver, leftoverPoints } from "@/lib/tienlen/fifty";
import {
  HUMAN_ID,
  clampBotCount,
  handToRoomView,
  playerIdForSeat,
  soloNames,
} from "@/lib/solo";
import { useApp } from "./AppProviders";
import { GameTable } from "./GameTable";
import { LangToggle } from "./LangToggle";
import { SettingsSheet } from "./SettingsSheet";

const BOT_PAUSE_MS = 520;

interface SoloSnapshot {
  hand: HandState;
  lastEvent: RoomEvent | null;
  turnStartedAt: number;
  chips: number[];
  buyIns: number[];
  lastChipPays: ChipPay[];
  chipsSettled: boolean;
  fifty: number[];
  lastFiftyPoints: number[];
  fiftySettled: boolean;
}

function deal(
  botCount: 1 | 2 | 3,
  rules: HandState["rules"],
  prev?: SoloSnapshot,
): SoloSnapshot {
  const n = botCount + 1;
  const parsed = parseRules(rules);
  const start = parsed.startChips;
  const keepStacks = Boolean(
    parsed.chips &&
      prev &&
      parseRules(prev.hand.rules).chips &&
      prev.chips.length === n,
  );
  let chips =
    keepStacks && prev
      ? [...prev.chips]
      : Array.from({ length: n }, () => start);
  let buyIns =
    keepStacks && prev
      ? [...prev.buyIns]
      : Array.from({ length: n }, () => 0);
  if (parsed.chips) {
    for (let s = 1; s < n; s++) {
      if (chips[s] <= 0) {
        chips[s] += start;
        buyIns[s] += 1;
      }
    }
  }
  const keepFifty = Boolean(
    parsed.fifty &&
      prev &&
      parseRules(prev.hand.rules).fifty &&
      prev.fifty.length === n &&
      !fiftyMatchOver(prev.fifty),
  );
  const fifty =
    keepFifty && prev
      ? [...prev.fifty]
      : Array.from({ length: n }, () => 0);
  return {
    hand: createHandState(n, Math.random, rules),
    lastEvent: { kind: "start" },
    turnStartedAt: Date.now(),
    chips,
    buyIns,
    lastChipPays: [],
    chipsSettled: false,
    fifty,
    lastFiftyPoints: Array.from({ length: n }, () => 0),
    fiftySettled: false,
  };
}

function finishHand(snap: SoloSnapshot): SoloSnapshot {
  const parsed = parseRules(snap.hand.rules);
  if (!isGameFinished(snap.hand)) return snap;
  let next = snap;
  if (parsed.chips && !next.chipsSettled) {
    const settled = settleChips(next.chips, next.hand.finishOrder);
    next = {
      ...next,
      chips: settled.chips,
      chipsSettled: true,
      lastChipPays: settled.pays.map((pay) => ({
        fromPlayerId: playerIdForSeat(pay.fromSeat),
        toPlayerId: playerIdForSeat(pay.toSeat),
        amount: pay.amount,
      })),
    };
  }
  if (parsed.fifty && !next.fiftySettled) {
    const points = leftoverPoints(next.hand.hands, next.hand.finishOrder);
    next = {
      ...next,
      fifty: next.fifty.map((n, i) => n + (points[i] ?? 0)),
      lastFiftyPoints: points,
      fiftySettled: true,
    };
  }
  return next;
}

interface SoloGameProps {
  botCount: number;
  playerName: string;
}

export function SoloGame({ botCount, playerName }: SoloGameProps) {
  const router = useRouter();
  const { t, rules, setRules } = useApp();
  const bots = clampBotCount(botCount);
  const names = useMemo(
    () => soloNames(playerName, bots),
    [playerName, bots],
  );
  const [solo, setSolo] = useState<SoloSnapshot>(() =>
    deal(bots, getSettings().rules),
  );
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const state = solo.hand;
    if (isGameFinished(state) || state.currentSeat === 0) return;

    const id = window.setTimeout(() => {
      setSolo((prev) => {
        const current = prev.hand;
        if (isGameFinished(current) || current.currentSeat === 0) return prev;

        const seat = current.currentSeat;
        const action = chooseBotAction(current, seat);
        const playerId = playerIdForSeat(seat);

        if (action.type === "pass") {
          return finishHand({
            ...prev,
            hand: applyPass(current, seat),
            lastEvent: { kind: "pass", playerId },
            turnStartedAt: Date.now(),
          });
        }

        const check = validatePlay(current, seat, action.cards);
        if (!check.ok) {
          if (!current.pile) return prev;
          return finishHand({
            ...prev,
            hand: applyPass(current, seat),
            lastEvent: { kind: "pass", playerId },
            turnStartedAt: Date.now(),
          });
        }

        const next = applyPlay(current, seat, action.cards);
        return finishHand({
          ...prev,
          hand: next,
          lastEvent: makePlayEvent(
            playerId,
            check.combo.type,
            action.cards,
            current,
            next,
            seat,
            names.map((name, s) => ({ id: playerIdForSeat(s), seat: s, name })),
          ),
          turnStartedAt: Date.now(),
        });
      });
    }, BOT_PAUSE_MS);

    return () => window.clearTimeout(id);
  }, [solo]);

  const room = handToRoomView(solo.hand, names, solo.lastEvent, {
    turnStartedAt: solo.turnStartedAt,
    chips: solo.chips,
    buyIns: solo.buyIns,
    lastChipPays: solo.lastChipPays,
    fifty: solo.fifty,
    lastFiftyPoints: solo.lastFiftyPoints,
  });
  const botTurn = !isGameFinished(solo.hand) && solo.hand.currentSeat !== 0;

  const onPlay = async (cards: Card[]) => {
    const check = validatePlay(solo.hand, 0, cards);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    const next = applyPlay(solo.hand, 0, cards);
    setSolo((prev) =>
      finishHand({
        ...prev,
        hand: next,
        lastEvent: makePlayEvent(
          HUMAN_ID,
          check.combo.type,
          cards,
          solo.hand,
          next,
          0,
          names.map((_, s) => ({ id: playerIdForSeat(s), seat: s })),
        ),
        turnStartedAt: Date.now(),
      }),
    );
  };

  const onPass = async () => {
    const check = validatePass(solo.hand, 0);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    setSolo((prev) =>
      finishHand({
        ...prev,
        hand: applyPass(solo.hand, 0),
        lastEvent: { kind: "pass", playerId: HUMAN_ID },
        turnStartedAt: Date.now(),
      }),
    );
  };

  const onTimeout = useCallback(() => {
    const state = solo.hand;
    if (isGameFinished(state) || state.currentSeat !== 0) return;
    if (Date.now() - solo.turnStartedAt < BLITZ_MS - 200) return;
    const action = chooseBotAction(state, 0);
    if (action.type === "pass") {
      const check = validatePass(state, 0);
      if (!check.ok) return;
      setSolo((prev) =>
        finishHand({
          ...prev,
          hand: applyPass(state, 0),
          lastEvent: { kind: "pass", playerId: HUMAN_ID },
          turnStartedAt: Date.now(),
        }),
      );
      return;
    }
    const check = validatePlay(state, 0, action.cards);
    if (!check.ok) return;
    const next = applyPlay(state, 0, action.cards);
    setSolo((prev) =>
      finishHand({
        ...prev,
        hand: next,
        lastEvent: makePlayEvent(
          HUMAN_ID,
          check.combo.type,
          action.cards,
          state,
          next,
          0,
          names.map((_, s) => ({ id: playerIdForSeat(s), seat: s })),
        ),
        turnStartedAt: Date.now(),
      }),
    );
  }, [solo, names]);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-2 pt-[max(0.4rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <Link href="/tienlen" className="min-h-9 text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="text-xs tracking-[0.12em] text-[var(--gold)]">
          {t("game.solo", {
            n: bots,
            bots: bots === 1 ? t("home.bot") : t("home.botsWord"),
          })}
        </span>
        <button
          type="button"
          className="min-h-9 text-xs text-[var(--gold)]"
          onClick={() => setSettingsOpen(true)}
        >
          {t("nav.settings")}
        </button>
      </header>
      <div className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <LangToggle />
        <button
          type="button"
          className="min-h-9 text-xs text-[var(--mute)]"
          onClick={() => {
            setError(null);
            if (parseRules(rules).chips && (solo.chips[0] ?? 0) <= 0) {
              setError("err.needChips");
              return;
            }
            setSolo(deal(bots, rules, solo));
          }}
        >
          {t("game.redeal")}
        </button>
      </div>
      <GameTable
        room={room}
        playerId={HUMAN_ID}
        busy={botTurn}
        error={error}
        rematchLabel={t("result.again")}
        rematchHint={t("result.againHint")}
        onPlay={onPlay}
        onPass={onPass}
        onTimeout={onTimeout}
        onRematch={async () => {
          setError(null);
          if (parseRules(rules).chips && (solo.chips[0] ?? 0) <= 0) {
            setError("err.needChips");
            return;
          }
          setError(null);
          setSolo(deal(bots, rules, solo));
        }}
        onBuyIn={() => {
          if ((solo.chips[0] ?? 0) > 0) return;
          const add = parseRules(rules).startChips;
          setSolo((prev) => {
            const chips = [...prev.chips];
            const buyIns = [...prev.buyIns];
            chips[0] += add;
            buyIns[0] += 1;
            return { ...prev, chips, buyIns };
          });
        }}
        onMenu={() => router.push("/tienlen")}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rules={rules}
        onChangeRules={setRules}
      />
    </div>
  );
}
