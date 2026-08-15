"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClientMounted } from "@/lib/client";
import {
  fetchSpeedRoom,
  postSpeedRoom,
  speedPlayBody,
} from "@/lib/speed/rooms/client";
import type { SpeedRoomView } from "@/lib/speed/rooms/types";
import {
  applyPendingOps,
  type SpeedPendingOp,
} from "@/lib/speed/view";
import type { Card } from "@/lib/tienlen/types";
import { useApp } from "../AppProviders";
import { SpeedLobby } from "./SpeedLobby";
import { SpeedTable } from "./SpeedTable";

const PLAY_POLL_MS = 70;
const LOBBY_POLL_MS = 800;

interface SpeedMultiplayerProps {
  roomId: string;
  playerId: string;
  playerName: string;
}

export function SpeedMultiplayer({
  roomId,
  playerId,
  playerName,
}: SpeedMultiplayerProps) {
  const router = useRouter();
  const { t, te } = useApp();
  const [room, setRoom] = useState<SpeedRoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mounted = useClientMounted();
  const inviteUrl = mounted
    ? `${window.location.origin}/speed/${roomId}`
    : `/speed/${roomId}`;
  const roomRef = useRef<SpeedRoomView | null>(null);
  const serverRoom = useRef<SpeedRoomView | null>(null);
  const serverRev = useRef(0);
  const pendingOps = useRef<SpeedPendingOp[]>([]);

  const show = (server: SpeedRoomView) => {
    const view =
      server.view && pendingOps.current.length > 0
        ? applyPendingOps(server.view, pendingOps.current)
        : server.view;
    const shown = view && view !== server.view ? { ...server, view } : server;
    roomRef.current = shown;
    setRoom(shown);
  };

  const applyRoom = useCallback((next: SpeedRoomView) => {
    if (next.revision < serverRev.current) return;
    if (
      next.revision === serverRev.current &&
      pendingOps.current.length === 0 &&
      roomRef.current?.status === next.status
    ) {
      return;
    }
    serverRev.current = next.revision;
    serverRoom.current = next;
    show(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        let next = await fetchSpeedRoom(roomId, playerId);
        if (!next.players.some((p) => p.id === playerId)) {
          const joined = await postSpeedRoom(roomId, {
            action: "join",
            playerId,
            playerName,
          });
          if (joined) next = joined;
        }
        if (!cancelled) {
          applyRoom(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? te(e.message) : t("game.notFound"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [roomId, playerId, playerName, applyRoom, t, te]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const loop = async () => {
      try {
        const next = await fetchSpeedRoom(roomId, playerId);
        if (!cancelled) applyRoom(next);
      } catch {
        /* keep last */
      }
      if (!cancelled) {
        const playing = roomRef.current?.status === "playing";
        timer = window.setTimeout(loop, playing ? PLAY_POLL_MS : LOBBY_POLL_MS);
      }
    };
    timer = window.setTimeout(loop, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roomId, playerId, applyRoom]);

  const run = async (
    fn: () => Promise<SpeedRoomView | null>,
    opts?: { lock?: boolean },
  ) => {
    if (opts?.lock) setBusy(true);
    try {
      const next = await fn();
      if (next) applyRoom(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("err.requestFailed"));
    } finally {
      if (opts?.lock) setBusy(false);
    }
  };

  const act = async (
    op: SpeedPendingOp,
    fn: () => Promise<SpeedRoomView | null>,
  ) => {
    pendingOps.current = [...pendingOps.current, op];
    if (serverRoom.current) show(serverRoom.current);
    try {
      const next = await fn();
      pendingOps.current = pendingOps.current.filter((item) => item !== op);
      if (next) applyRoom(next);
      else if (serverRoom.current) show(serverRoom.current);
      setError(null);
    } catch (e) {
      pendingOps.current = pendingOps.current.filter((item) => item !== op);
      if (serverRoom.current) show(serverRoom.current);
      setError(e instanceof Error ? e.message : t("err.requestFailed"));
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-[#f0b4bd]">{error ?? t("game.notFound")}</p>
        <Link href="/speed" className="text-xs text-[var(--gold)]">
          {t("nav.home")}
        </Link>
      </div>
    );
  }

  if (room.players.length < 2 || !room.view) {
    return (
      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col justify-center overflow-hidden px-3 pt-[max(0.4rem,env(safe-area-inset-top))]">
        <SpeedLobby
          room={room}
          playerId={playerId}
          inviteUrl={inviteUrl}
          busy={busy}
          error={error}
          onLeave={() => {
            void run(async () => {
              await postSpeedRoom(roomId, { action: "leave", playerId });
              router.push("/speed");
              return null;
            }, { lock: true });
          }}
        />
      </div>
    );
  }

  const youSeat = room.players.find((p) => p.id === playerId)?.seat ?? 0;
  const oppSeat = youSeat === 0 ? 1 : 0;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-2 pt-[max(0.4rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex h-9 shrink-0 items-center justify-between px-1">
        <Link href="/speed" className="min-h-9 text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="font-mono text-xs tracking-[0.16em] text-[var(--gold)]">
          {room.id}
        </span>
        <button
          type="button"
          disabled={room.status === "playing"}
          className="min-h-9 text-xs text-[var(--mute)] disabled:opacity-40"
          onClick={() => {
            void run(async () => {
              await postSpeedRoom(roomId, { action: "leave", playerId });
              router.push("/speed");
              return null;
            }, { lock: true });
          }}
        >
          {t("lobby.leave")}
        </button>
      </header>
      <SpeedTable
        view={room.view}
        youName={room.names[youSeat] || t("game.you")}
        oppName={room.names[oppSeat] || t("speed.opp")}
        busy={busy}
        error={error}
        onPlay={(card: Card, pile) => {
          void act({ kind: "play", card, pile }, () =>
            postSpeedRoom(roomId, speedPlayBody(playerId, card, pile)),
          );
        }}
        onDraw={() => {
          void act({ kind: "draw" }, () =>
            postSpeedRoom(roomId, { action: "draw", playerId }),
          );
        }}
        onSort={() => {
          void act({ kind: "sort" }, () =>
            postSpeedRoom(roomId, { action: "sort", playerId }),
          );
        }}
        onNext={() => {
          void act({ kind: "next" }, () =>
            postSpeedRoom(roomId, { action: "next", playerId }),
          );
        }}
        onReady={() => {
          void run(() =>
            postSpeedRoom(roomId, { action: "ready", playerId, ready: true }),
          );
        }}
        onRematch={() => {
          void run(
            () => postSpeedRoom(roomId, { action: "rematch", playerId }),
            { lock: true },
          );
        }}
        onMenu={() => {
          void run(async () => {
            await postSpeedRoom(roomId, { action: "leave", playerId });
            router.push("/speed");
            return null;
          }, { lock: true });
        }}
      />
    </div>
  );
}
