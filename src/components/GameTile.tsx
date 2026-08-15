"use client";

import Link from "next/link";
import type { GameInfo } from "@/lib/games";
import { useApp } from "./AppProviders";

function TileMark({ id }: { id: GameInfo["id"] }) {
  if (id === "speed") {
    return (
      <span className="relative mr-1 inline-block h-11 w-10 shrink-0" aria-hidden>
        <span className="card-back absolute top-1 left-0 h-9 w-6 rotate-[-14deg] rounded-sm border border-[#3a0d16]" />
        <span className="card-back absolute top-0 left-3 h-9 w-6 rotate-[10deg] rounded-sm border border-[#3a0d16]" />
      </span>
    );
  }
  return (
    <span
      className="mr-2 flex h-11 w-8 shrink-0 flex-col items-center justify-center rounded-md bg-[#f8f4ea] text-[#c41e3a] shadow-md"
      aria-hidden
    >
      <span className="text-[11px] font-bold leading-none">2</span>
      <span className="text-sm leading-none">♥</span>
    </span>
  );
}

export function GameTile({ game }: { game: GameInfo }) {
  const { t } = useApp();
  const soon = game.status === "soon";
  return (
    <Link
      href={game.href}
      className="glass-panel flex items-start gap-3 rounded-[1.35rem] p-4 text-left"
    >
      <TileMark id={game.id} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--gold)]">
          {t(game.tag)}
        </span>
        <span className="mt-1 block font-[family-name:var(--font-display)] text-[1.65rem] leading-none">
          {t(game.title)}
        </span>
        <span className="mt-2 block text-sm leading-relaxed text-[var(--mute)]">
          {t(game.blurb)}
        </span>
      </span>
      <span
        className={[
          "mt-1 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
          soon
            ? "bg-black/30 text-[var(--mute)]"
            : "bg-[var(--gold)] text-[#1a1408]",
        ].join(" ")}
      >
        {soon ? t("app.soon") : t("app.play")}
      </span>
    </Link>
  );
}
