"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchHoldemRoom,
  holdemActBody,
  postHoldemRoom,
} from "@/lib/holdem/rooms/client";
import type { HoldemRoomView } from "@/lib/holdem/rooms/types";
import type { HoldemActionKind } from "@/lib/holdem/types";
import { viewToState } from "@/lib/holdem/view";
import { useClientMounted } from "@/lib/client";
import { useApp } from "../AppProviders";
import { HoldemTable } from "./HoldemTable";

export function HoldemMultiplayer({
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
  const [room, setRoom] = useState<HoldemRoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mounted = useClientMounted();
  const roomRef = useRef<HoldemRoomView | null>(null);

  const apply = useCallback((next: HoldemRoomView) => {
    if (roomRef.current?.revision === next.revision) return;
    roomRef.current = next;
    setRoom(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let next = await fetchHoldemRoom(roomId, playerId);
        if (!next.players.some((p) => p.id === playerId)) {
          const joined = await postHoldemRoom(roomId, {
            action: "join",
            playerId,
            playerName,
          });
          if (joined) next = joined;
        }
        if (!cancelled) {
          apply(next);
          setError(null);
        }
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
        const next = await fetchHoldemRoom(roomId, playerId);
        if (!cancelled) apply(next);
      } catch {
        /* keep */
      }
      if (!cancelled) timer = window.setTimeout(loop, 400);
    };
    timer = window.setTimeout(loop, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roomId, playerId, apply]);

  const run = async (fn: () => Promise<HoldemRoomView | null>) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next) apply(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("err.requestFailed"));
    } finally {
      setBusy(false);
    }
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
        <Link href="/holdem" className="text-xs text-[var(--gold)]">
          {t("nav.home")}
        </Link>
      </div>
    );
  }

  const youSeat = room.players.find((p) => p.id === playerId)?.seat ?? 0;
  const waiting = room.players.length < 2 || !room.view;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-1 pt-[max(0.35rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <Link href="/holdem" className="text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="font-mono text-xs text-[var(--gold)]">{room.id}</span>
        <button
          type="button"
          className="text-xs text-[var(--mute)]"
          onClick={() => {
            void run(async () => {
              await postHoldemRoom(roomId, { action: "leave", playerId });
              router.push("/holdem");
              return null;
            });
          }}
        >
          {t("lobby.leave")}
        </button>
      </header>
      {waiting || !room.view ? (
        <div className="glass-panel mx-auto w-full max-w-md rounded-[1.75rem] p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
            {t("lobby.waiting")}
          </p>
          <h1 className="font-mono text-2xl tracking-[0.16em]">{room.id}</h1>
          <ul className="mt-4 space-y-2">
            {Array.from({ length: 6 }, (_, i) => {
              const p = room.players.find((x) => x.seat === i);
              return (
                <li key={i} className="rounded-2xl bg-black/25 px-3 py-2 text-sm">
                  {p ? p.name : t("lobby.openSeat")}
                </li>
              );
            })}
          </ul>
          {room.hostId === playerId && (
            <button
              type="button"
              disabled={busy || room.players.length < 2}
              className="btn-gold mt-4 w-full"
              onClick={() =>
                void run(() =>
                  postHoldemRoom(roomId, { action: "deal", playerId }),
                )
              }
            >
              {t("poker.deal")}
            </button>
          )}
          {error && <p className="mt-3 text-sm text-[#f0b4bd]">{error}</p>}
        </div>
      ) : (
        <HoldemTable
          state={viewToState(room.view)}
          youSeat={youSeat}
          busy={busy}
          onAct={(kind: HoldemActionKind, raiseTo?: number) => {
            void run(() =>
              postHoldemRoom(roomId, holdemActBody(playerId, kind, raiseTo)),
            );
          }}
          onDeal={() => {
            void run(() =>
              postHoldemRoom(roomId, { action: "deal", playerId }),
            );
          }}
          onRebuy={() => {
            void run(() =>
              postHoldemRoom(roomId, { action: "rebuy", playerId }),
            );
          }}
          onMenu={() => router.push("/holdem")}
        />
      )}
    </div>
  );
}
