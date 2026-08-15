"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import type { RoomEvent } from "@/lib/rooms/types";
import { getSettings } from "@/lib/settings";
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
}

function deal(
  botCount: 1 | 2 | 3,
  rules: HandState["rules"],
): SoloSnapshot {
  return {
    hand: createHandState(botCount + 1, Math.random, rules),
    lastEvent: { kind: "start" },
    turnStartedAt: Date.now(),
  };
}

interface SoloGameProps {
  botCount: number;
  playerName: string;
}

export function SoloGame({ botCount, playerName }: SoloGameProps) {
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
          return {
            hand: applyPass(current, seat),
            lastEvent: { kind: "pass", playerId },
            turnStartedAt: Date.now(),
          };
        }

        const check = validatePlay(current, seat, action.cards);
        if (!check.ok) {
          if (!current.pile) return prev;
          return {
            hand: applyPass(current, seat),
            lastEvent: { kind: "pass", playerId },
            turnStartedAt: Date.now(),
          };
        }

        const next = applyPlay(current, seat, action.cards);
        return {
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
        };
      });
    }, BOT_PAUSE_MS);

    return () => window.clearTimeout(id);
  }, [solo]);

  const room = handToRoomView(solo.hand, names, solo.lastEvent, {
    turnStartedAt: solo.turnStartedAt,
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
    setSolo({
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
    });
  };

  const onPass = async () => {
    const check = validatePass(solo.hand, 0);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    setSolo({
      hand: applyPass(solo.hand, 0),
      lastEvent: { kind: "pass", playerId: HUMAN_ID },
      turnStartedAt: Date.now(),
    });
  };

  const onTimeout = useCallback(() => {
    const state = solo.hand;
    if (isGameFinished(state) || state.currentSeat !== 0) return;
    if (Date.now() - solo.turnStartedAt < BLITZ_MS - 200) return;
    const action = chooseBotAction(state, 0);
    if (action.type === "pass") {
      const check = validatePass(state, 0);
      if (!check.ok) return;
      setSolo({
        hand: applyPass(state, 0),
        lastEvent: { kind: "pass", playerId: HUMAN_ID },
        turnStartedAt: Date.now(),
      });
      return;
    }
    const check = validatePlay(state, 0, action.cards);
    if (!check.ok) return;
    const next = applyPlay(state, 0, action.cards);
    setSolo({
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
    });
  }, [solo, names]);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-2 pt-[max(0.4rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex shrink-0 items-center justify-between px-1 py-1">
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
      <div className="mb-1 flex items-center justify-between px-1">
        <LangToggle />
        <button
          type="button"
          className="min-h-9 text-xs text-[var(--mute)]"
          onClick={() => {
            setError(null);
            setSolo(deal(bots, rules));
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
          setSolo(deal(bots, rules));
        }}
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
