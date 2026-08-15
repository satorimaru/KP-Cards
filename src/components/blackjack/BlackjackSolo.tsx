"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { botBet, botInsure, botPlay } from "@/lib/blackjack/bot";
import {
  createBjTable,
  doubleDown,
  hit,
  insure,
  nextRound,
  readyDeal,
  rebuyBj,
  setBet,
  split,
  stand,
  type BjState,
} from "@/lib/blackjack/engine";
import { BOT_NAMES } from "@/lib/solo";
import { useApp } from "../AppProviders";
import { LangToggle } from "../LangToggle";
import { BlackjackTable } from "./BlackjackTable";

const BOT_MS = 520;

export function BlackjackSolo({
  playerName,
  botCount,
}: {
  playerName: string;
  botCount: number;
}) {
  const router = useRouter();
  const { t } = useApp();
  const names = [
    playerName.trim().slice(0, 24) || t("game.you"),
    ...[...BOT_NAMES, "An", "Tuan"].slice(0, Math.min(5, Math.max(0, botCount))),
  ];
  const [state, setState] = useState<BjState>(() =>
    createBjTable(names, { botsFrom: 1 }),
  );

  useEffect(() => {
    const actor = state.toAct != null ? state.seats[state.toAct] : null;
    const bettingBots =
      state.phase === "betting" &&
      state.seats.some((s) => s.isBot && !s.hands[0]?.bet && s.stack >= 10);
    if (!actor?.isBot && !bettingBots) return;
    const id = window.setTimeout(() => {
      setState((prev) => {
        const draft = structuredClone(prev);
        if (draft.phase === "betting") {
          let next = draft;
          for (const s of next.seats) {
            if (s.isBot && !s.hands[0]?.bet && s.stack >= 10) {
              next = botBet(next, s.seat);
            }
          }
          return next;
        }
        const p = draft.toAct != null ? draft.seats[draft.toAct] : null;
        if (!p?.isBot) return prev;
        if (draft.phase === "insure") return botInsure(draft, p.seat);
        if (draft.phase === "play") return botPlay(draft, p.seat);
        return prev;
      });
    }, BOT_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const apply = (fn: (s: BjState) => { ok: boolean; state?: BjState; error?: string }) => {
    setState((prev) => {
      const next = fn(structuredClone(prev));
      return next.ok && next.state ? next.state : prev;
    });
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-1 pt-[max(0.35rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <Link href="/blackjack" className="text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="text-xs tracking-[0.12em] text-[var(--gold)]">
          {t("blackjack.title")}
        </span>
        <LangToggle />
      </header>
      <BlackjackTable
        state={state}
        youSeat={0}
        onBet={(n) => apply((s) => setBet(s, 0, n))}
        onHit={() => apply((s) => hit(s, 0))}
        onStand={() => apply((s) => stand(s, 0))}
        onDouble={() => apply((s) => doubleDown(s, 0))}
        onSplit={() => apply((s) => split(s, 0))}
        onInsure={(take) => apply((s) => insure(s, 0, take))}
        onDeal={() => apply((s) => readyDeal(s, 0))}
        onNext={() => apply((s) => nextRound(s))}
        onRebuy={() => apply((s) => rebuyBj(s, 0))}
        onMenu={() => router.push("/blackjack")}
      />
    </div>
  );
}
