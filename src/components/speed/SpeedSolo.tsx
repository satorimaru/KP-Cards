"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chooseSpeedBotAction } from "@/lib/speed/bot";
import {
  dealSpeed,
  drawCard,
  playCard,
  setReady,
  signalNext,
  sortHand,
  type SpeedResult,
} from "@/lib/speed/engine";
import type { SpeedState } from "@/lib/speed/types";
import { toSpeedView } from "@/lib/speed/view";
import type { Card } from "@/lib/tienlen/types";
import { useApp } from "../AppProviders";
import { LangToggle } from "../LangToggle";
import { SpeedTable } from "./SpeedTable";

const BOT_MS = 280;
const BOT_SEAT = 1 as const;
const YOU = 0 as const;

export function SpeedSolo({ playerName }: { playerName: string }) {
  const router = useRouter();
  const { t } = useApp();
  const [state, setState] = useState<SpeedState>(() => dealSpeed());
  const [error, setError] = useState<string | null>(null);

  const apply = (fn: (current: SpeedState) => SpeedResult) => {
    setState((prev) => {
      const result = fn(prev);
      if (!result.ok) {
        setError(result.error);
        return prev;
      }
      setError(null);
      return result.state;
    });
  };

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setTimeout(() => {
      setState((prev) => {
        if (prev.status !== "playing") return prev;
        const action = chooseSpeedBotAction(prev, BOT_SEAT);
        if (action.type === "play") {
          const next = playCard(prev, BOT_SEAT, action.card, action.pile);
          return next.ok ? next.state : prev;
        }
        if (action.type === "draw") {
          const next = drawCard(prev, BOT_SEAT);
          return next.ok ? next.state : prev;
        }
        if (action.type === "next") {
          const next = signalNext(prev, BOT_SEAT);
          return next.ok ? next.state : prev;
        }
        return prev;
      });
    }, BOT_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const view = useMemo(() => toSpeedView(state, YOU), [state]);
  const you = playerName.trim().slice(0, 24) || t("game.you");
  const opp = t("speed.opp");

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-2 pt-[max(0.4rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <Link href="/speed" className="min-h-9 text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="text-xs tracking-[0.12em] text-[var(--gold)]">
          {t("speed.title")}
        </span>
        <LangToggle />
      </header>
      <SpeedTable
        view={view}
        youName={you}
        oppName={opp}
        error={error}
        onPlay={(card: Card, pile) => apply((s) => playCard(s, YOU, card, pile))}
        onDraw={() => apply((s) => drawCard(s, YOU))}
        onSort={() => apply((s) => sortHand(s, YOU))}
        onNext={() => apply((s) => signalNext(s, YOU))}
        onReady={() =>
          apply((s) => {
            const mine = setReady(s, YOU, true);
            if (!mine.ok) return mine;
            return setReady(mine.state, BOT_SEAT, true);
          })
        }
        onRematch={() => {
          setError(null);
          setState(dealSpeed());
        }}
        onMenu={() => router.push("/speed")}
      />
    </div>
  );
}
