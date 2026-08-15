"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SoloGame } from "@/components/SoloGame";
import { useClientMounted } from "@/lib/client";
import { getPlayerName } from "@/lib/player";
import { useApp } from "@/components/AppProviders";
import { clampBotCount } from "@/lib/solo";

function SoloTable() {
  const { t } = useApp();
  const params = useSearchParams();
  const mounted = useClientMounted();
  const bots = clampBotCount(Number(params.get("bots") ?? 2));
  const playerName = mounted ? getPlayerName() : "";

  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
        {t("game.dealing")}
      </div>
    );
  }

  return <SoloGame key={bots} botCount={bots} playerName={playerName} />;
}

export default function TienLenSoloPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
          …
        </div>
      }
    >
      <SoloTable />
    </Suspense>
  );
}
