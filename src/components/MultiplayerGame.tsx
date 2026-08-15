"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClientMounted } from "@/lib/client";
import { chatBody, fetchRoom, playBody, postRoom } from "@/lib/rooms/client";
import type { ChatMessage, RoomView } from "@/lib/rooms/types";
import type { Card } from "@/lib/tienlen/types";
import { useApp } from "./AppProviders";
import { ChatButton, ChatSheet } from "./ChatSheet";
import { GameTable } from "./GameTable";
import { LangToggle } from "./LangToggle";
import { Lobby } from "./Lobby";

function unreadChat(
  messages: ChatMessage[],
  seenId: string,
  playerId: string,
): number {
  if (messages.length === 0) return 0;
  const idx = seenId ? messages.findIndex((m) => m.id === seenId) : -1;
  const start = idx >= 0 ? idx + 1 : 0;
  return messages.slice(start).filter((m) => m.playerId !== playerId).length;
}

interface MultiplayerGameProps {
  roomId: string;
  playerId: string;
  playerName: string;
}

const POLL_MS = 800;

export function MultiplayerGame({
  roomId,
  playerId,
  playerName,
}: MultiplayerGameProps) {
  const router = useRouter();
  const { t, te } = useApp();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const mounted = useClientMounted();
  const inviteUrl = mounted
    ? `${window.location.origin}/tienlen/${roomId}`
    : `/tienlen/${roomId}`;
  const roomRef = useRef<RoomView | null>(null);
  const seenChatIdRef = useRef<string | null>(null);
  const chatPrimedRef = useRef(false);

  const applyRoom = useCallback((next: RoomView) => {
    const prev = roomRef.current;
    if (
      prev &&
      prev.revision === next.revision &&
      prev.turnVersion === next.turnVersion &&
      prev.status === next.status
    ) {
      return;
    }
    roomRef.current = next;
    setRoom(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        let next = await fetchRoom(roomId, playerId);
        if (!next.players.some((p) => p.id === playerId)) {
          const joined = await postRoom(roomId, {
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
  }, [roomId, playerId, playerName, applyRoom]);

  useEffect(() => {
    if (!room) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchRoom(roomId, playerId);
        if (!cancelled) applyRoom(next);
      } catch {
        /* keep last good snapshot */
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [room, roomId, playerId, applyRoom]);

  const run = useCallback(
    async (fn: () => Promise<RoomView | null>) => {
      setBusy(true);
      setError(null);
      try {
        const next = await fn();
        if (next) applyRoom(next);
        return next;
      } catch (e) {
        setError(e instanceof Error ? te(e.message) : t("err.requestFailed"));
        try {
          applyRoom(await fetchRoom(roomId, playerId));
        } catch {
          /* ignore */
        }
        return null;
      } finally {
        setBusy(false);
      }
    },
    [applyRoom, roomId, playerId],
  );

  const sendChat = useCallback(
    async (text: string) => {
      setChatBusy(true);
      try {
        const next = await postRoom(roomId, chatBody(playerId, text));
        if (next) applyRoom(next);
      } finally {
        setChatBusy(false);
      }
    },
    [applyRoom, roomId, playerId],
  );

  const onTimeout = useCallback(() => {
    void run(() => postRoom(roomId, { action: "timeout", playerId }));
  }, [run, roomId, playerId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--mute)]">
        {t("game.loading")}
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-lg text-[#f0b4bd]">{error ?? t("game.notFound")}</p>
        <Link href="/tienlen" className="text-sm text-[var(--gold)]">
          {t("nav.home")}
        </Link>
      </div>
    );
  }

  const messages = room.messages ?? [];
  if (!chatPrimedRef.current) {
    chatPrimedRef.current = true;
    seenChatIdRef.current = messages.at(-1)?.id ?? "";
  }
  if (chatOpen) {
    seenChatIdRef.current = messages.at(-1)?.id ?? "";
  }
  const unread = chatOpen
    ? 0
    : unreadChat(messages, seenChatIdRef.current ?? "", playerId);

  const chat = (
    <ChatSheet
      open={chatOpen}
      onClose={() => setChatOpen(false)}
      messages={messages}
      playerId={playerId}
      onSend={sendChat}
      busy={chatBusy}
    />
  );

  if (room.status === "waiting") {
    return (
      <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4">
        <div className="mb-3 w-full max-w-md">
          <LangToggle />
        </div>
        <Lobby
          room={room}
          playerId={playerId}
          inviteUrl={inviteUrl}
          busy={busy}
          error={error}
          unread={unread}
          onOpenChat={() => setChatOpen(true)}
          onReady={(ready) => {
            void run(() =>
              postRoom(roomId, { action: "ready", playerId, ready }),
            );
          }}
          onStart={() => {
            void run(() => postRoom(roomId, { action: "start", playerId }));
          }}
          onChangeRules={(next) => {
            void run(() =>
              postRoom(roomId, { action: "rules", playerId, rules: next }),
            );
          }}
          onLeave={() => {
            void run(async () => {
              await postRoom(roomId, { action: "leave", playerId });
              router.push("/tienlen");
              return null;
            });
          }}
        />
        {chat}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-2 pt-[max(0.4rem,env(safe-area-inset-top))]">
      <header className="mb-1 flex shrink-0 items-center justify-between px-1 py-1">
        <Link href="/tienlen" className="min-h-9 text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
        <span className="font-mono text-xs tracking-[0.16em] text-[var(--gold)]">
          {room.id}
        </span>
        <ChatButton
          unread={unread}
          onClick={() => setChatOpen(true)}
          className="min-h-9 text-xs text-[var(--gold)]"
        />
      </header>
      <GameTable
        room={room}
        playerId={playerId}
        busy={busy}
        error={error}
        onPlay={(cards: Card[]) =>
          run(() =>
            postRoom(roomId, playBody(playerId, cards, room.turnVersion)),
          ).then(() => undefined)
        }
        onPass={() =>
          run(() =>
            postRoom(roomId, {
              action: "pass",
              playerId,
              turnVersion: room.turnVersion,
            }),
          ).then(() => undefined)
        }
        onRematch={() =>
          run(() => postRoom(roomId, { action: "rematch", playerId })).then(
            () => undefined,
          )
        }
        onTimeout={onTimeout}
      />
      {chat}
    </div>
  );
}
