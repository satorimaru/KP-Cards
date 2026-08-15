"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HoldemSolo } from "@/components/holdem/HoldemSolo";
import { useApp } from "@/components/AppProviders";
import { useClientMounted } from "@/lib/client";
import { getPlayerName } from "@/lib/player";

function Table() {
  const { t } = useApp();
  const params = useSearchParams();
  const mounted = useClientMounted();
  const bots = Math.min(5, Math.max(1, Number(params.get("bots") ?? 2)));
  const name = mounted ? getPlayerName() : "";
  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
        {t("game.dealing")}
      </div>
    );
  }
  return <HoldemSolo key={bots} playerName={name} botCount={bots} />;
}

export default function HoldemSoloPage() {
  return (
    <Suspense fallback={null}>
      <Table />
    </Suspense>
  );
}
