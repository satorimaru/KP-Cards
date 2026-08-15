import { NextResponse } from "next/server";
import { statusForError } from "@/lib/rooms/errors";
import {
  getRoomForPlayer,
  joinRoom,
  leaveRoom,
  parseCards,
  passTurn,
  playCards,
  rematchRoom,
  sendMessage,
  setReady,
  setRoomRules,
  startGame,
  timeoutTurn,
} from "@/lib/rooms/service";
import { toPublicView, toRoomView } from "@/lib/rooms/view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ roomId: string }> };

const NO_STORE = { "Cache-Control": "no-store" };

function viewFor(room: NonNullable<Awaited<ReturnType<typeof leaveRoom>>>, playerId: string) {
  return room.players.some((p) => p.id === playerId)
    ? toRoomView(room, playerId)
    : toPublicView(room);
}

export async function GET(request: Request, { params }: Params) {
  const { roomId } = await params;
  const playerId =
    new URL(request.url).searchParams.get("playerId")?.trim() ?? "";

  try {
    const room = await getRoomForPlayer(roomId, playerId || undefined);
    if (!playerId) {
      return NextResponse.json({ room: toPublicView(room) }, { headers: NO_STORE });
    }
    return NextResponse.json({ room: viewFor(room, playerId) }, { headers: NO_STORE });
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: Params) {
  const { roomId } = await params;
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const playerId = String(body.playerId ?? "").trim();

    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }

    switch (action) {
      case "join": {
        const room = await joinRoom(
          roomId,
          playerId,
          String(body.playerName ?? "Guest"),
        );
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "leave": {
        const room = await leaveRoom(roomId, playerId);
        if (!room) {
          return NextResponse.json({ room: null, left: true });
        }
        return NextResponse.json({
          room: toPublicView(room),
          left: true,
        });
      }
      case "ready": {
        const room = await setReady(roomId, playerId, Boolean(body.ready));
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "start": {
        const room = await startGame(roomId, playerId);
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "play": {
        const cards = parseCards(body.cards);
        const room = await playCards(
          roomId,
          playerId,
          cards,
          body.turnVersion != null ? Number(body.turnVersion) : undefined,
        );
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "pass": {
        const room = await passTurn(
          roomId,
          playerId,
          body.turnVersion != null ? Number(body.turnVersion) : undefined,
        );
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "rematch": {
        const room = await rematchRoom(roomId, playerId);
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "chat": {
        const room = await sendMessage(roomId, playerId, body.text);
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "rules": {
        const room = await setRoomRules(roomId, playerId, body.rules);
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      case "timeout": {
        const room = await timeoutTurn(roomId, playerId);
        return NextResponse.json({ room: toRoomView(room, playerId) });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
