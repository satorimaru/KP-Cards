"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BlackjackSolo } from "@/components/blackjack/BlackjackSolo";
import { useApp } from "@/components/AppProviders";
import { useClientMounted } from "@/lib/client";
import { getPlayerName } from "@/lib/player";

function Table() {
  const { t } = useApp();
  const params = useSearchParams();
  const mounted = useClientMounted();
  const bots = Math.min(5, Math.max(0, Number(params.get("bots") ?? 2)));
  const name = mounted ? getPlayerName() : "";
  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
        {t("game.dealing")}
      </div>
    );
  }
  return <BlackjackSolo key={bots} playerName={name} botCount={bots} />;
}

export default function BlackjackSoloPage() {
  return (
    <Suspense fallback={null}>
      <Table />
    </Suspense>
  );
}
