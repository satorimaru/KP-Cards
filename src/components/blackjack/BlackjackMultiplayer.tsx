"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchBjRoom, postBjRoom } from "@/lib/blackjack/rooms/client";
import type { BjRoomView } from "@/lib/blackjack/rooms/types";
import { useApp } from "../AppProviders";
import { BlackjackTable } from "./BlackjackTable";

export function BlackjackMultiplayer({
  roomId,
  playerId,
  playerName,
}: {
  roomId: string;
  playerId: string;
  playerName: string;
}) {
  const router = useRouter();
  const { t, te } = useApp();
  const [room, setRoom] = useState<BjRoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const roomRef = useRef<BjRoomView | null>(null);

  const apply = useCallback((next: BjRoomView) => {
    if (roomRef.current?.revision === next.revision) return;
    roomRef.current = next;
    setRoom(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let next = await fetchBjRoom(roomId, playerId);
        if (!next.players.some((p) => p.id === playerId)) {
          const joined = await postBjRoom(roomId, {
            action: "join",
            playerId,
            playerName,
          });
          if (joined) next = joined;
        }
        if (!cancelled) apply(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? te(e.message) : t("game.notFound"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, playerId, playerName, apply, t, te]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const loop = async () => {
      try {
        const next = await fetchBjRoom(roomId, playerId);
        if (!cancelled) apply(next);
      } catch {
        /* keep */
      }
      if (!cancelled) timer = window.setTimeout(loop, 450);
    };
    timer = window.setTimeout(loop, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roomId, playerId, apply]);

  const run = (body: Record<string, unknown>) => {
    void postBjRoom(roomId, { ...body, playerId })
      .then((next) => {
        if (next) apply(next);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t("err.requestFailed"));
      });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
        {t("game.loading")}
      </div>
    );
  }
  if (!room) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-[#f0b4bd]">{error ?? t("game.notFound")}</p>
        <Link href="/blackjack" className="text-xs text-[var(--gold)]">
          {t("nav.home")}
        </Link>
      </div>
    );
  }

  const youSeat = room.players.find((p) => p.id === playerId)?.seat ?? 0;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-1 pt-[max(0.35rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <Link href="/blackjack" className="text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="font-mono text-xs text-[var(--gold)]">{room.id}</span>
        <button
          type="button"
          className="text-xs text-[var(--mute)]"
          onClick={() => {
            void postBjRoom(roomId, { action: "leave", playerId }).then(() =>
              router.push("/blackjack"),
            );
          }}
        >
          {t("lobby.leave")}
        </button>
      </header>
      <BlackjackTable
        state={room.state}
        youSeat={youSeat}
        onBet={(n) => run({ action: "bet", amount: n })}
        onHit={() => run({ action: "hit" })}
        onStand={() => run({ action: "stand" })}
        onDouble={() => run({ action: "double" })}
        onSplit={() => run({ action: "split" })}
        onInsure={(take) => run({ action: "insure", take })}
        onDeal={() => run({ action: "deal" })}
        onNext={() => run({ action: "next" })}
        onRebuy={() => run({ action: "rebuy" })}
        onMenu={() => router.push("/blackjack")}
      />
      {error && (
        <p className="px-2 text-center text-sm text-[#f0b4bd]">{error}</p>
      )}
    </div>
  );
}
