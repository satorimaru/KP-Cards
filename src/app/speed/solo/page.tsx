"use client";

import { SpeedSolo } from "@/components/speed/SpeedSolo";
import { useApp } from "@/components/AppProviders";
import { useClientMounted } from "@/lib/client";
import { getPlayerName } from "@/lib/player";

export default function SpeedSoloPage() {
  const { t } = useApp();
  const mounted = useClientMounted();
  const playerName = mounted ? getPlayerName() : "";

  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
        {t("game.dealing")}
      </div>
    );
  }

  return <SpeedSolo playerName={playerName} />;
}
