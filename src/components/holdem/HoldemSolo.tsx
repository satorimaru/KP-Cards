"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { applyBotAction } from "@/lib/holdem/bot";
import { applyAction, createTable, dealHand, rebuy } from "@/lib/holdem/engine";
import type { HoldemActionKind, HoldemState } from "@/lib/holdem/types";
import { BOT_NAMES } from "@/lib/solo";
import { useApp } from "../AppProviders";
import { LangToggle } from "../LangToggle";
import { HoldemTable } from "./HoldemTable";

const BOT_MS = 700;

export function HoldemSolo({
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
    ...[...BOT_NAMES, "An", "Tuan"].slice(0, Math.min(5, Math.max(1, botCount))),
  ];
  const [state, setState] = useState<HoldemState>(() =>
    createTable(names, { botsFrom: 1 }),
  );

  useEffect(() => {
    if (state.status !== "playing" || state.toAct == null) return;
    const actor = state.players[state.toAct];
    if (!actor?.isBot) return;
    const id = window.setTimeout(() => {
      setState((prev) => {
        if (prev.status !== "playing" || prev.toAct == null) return prev;
        const p = prev.players[prev.toAct];
        if (!p?.isBot) return prev;
        const next = applyBotAction(structuredClone(prev), p.seat);
        return next.ok ? next.state : prev;
      });
    }, BOT_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const act = (kind: HoldemActionKind, raiseTo?: number) => {
    setState((prev) => {
      if (prev.toAct !== 0) return prev;
      const next = applyAction(structuredClone(prev), 0, kind, raiseTo);
      return next.ok ? next.state : prev;
    });
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-1 pt-[max(0.35rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <Link href="/holdem" className="min-h-9 text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="text-xs tracking-[0.12em] text-[var(--gold)]">
          {t("holdem.title")}
        </span>
        <LangToggle />
      </header>
      <HoldemTable
        state={state}
        youSeat={0}
        onAct={act}
        onDeal={() => {
          setState((prev) => {
            const next = dealHand(structuredClone(prev));
            return next.ok ? next.state : prev;
          });
        }}
        onRebuy={() => {
          setState((prev) => {
            const next = rebuy(structuredClone(prev), 0);
            return next.ok ? next.state : prev;
          });
        }}
        onMenu={() => router.push("/holdem")}
      />
    </div>
  );
}
