import { NextResponse } from "next/server";
import { statusForError } from "@/lib/rooms/errors";
import {
  actHoldem,
  dealHoldemRoom,
  getHoldemRoomForPlayer,
  joinHoldemRoom,
  leaveHoldemRoom,
  rebuyHoldem,
  showHoldem,
} from "@/lib/holdem/rooms/service";
import { toHoldemRoomView } from "@/lib/holdem/rooms/view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ roomId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const playerId = new URL(request.url).searchParams.get("playerId") ?? undefined;
    const room = await getHoldemRoomForPlayer(roomId.toUpperCase(), playerId);
    return NextResponse.json(
      { room: toHoldemRoomView(room, playerId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const id = roomId.toUpperCase();
    const body = await request.json();
    const playerId = String(body.playerId ?? "").trim();
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    switch (String(body.action ?? "")) {
      case "join": {
        const room = await joinHoldemRoom(id, playerId, String(body.playerName ?? ""));
        return NextResponse.json({ room: toHoldemRoomView(room, playerId) });
      }
      case "leave": {
        const room = await leaveHoldemRoom(id, playerId);
        return NextResponse.json({
          room: room ? toHoldemRoomView(room, playerId) : null,
        });
      }
      case "start":
      case "deal": {
        const room = await dealHoldemRoom(id, playerId);
        return NextResponse.json({ room: toHoldemRoomView(room, playerId) });
      }
      case "act": {
        const room = await actHoldem(id, playerId, body.kind, body.raiseTo);
        return NextResponse.json({ room: toHoldemRoomView(room, playerId) });
      }
      case "show": {
        const room = await showHoldem(id, playerId);
        return NextResponse.json({ room: toHoldemRoomView(room, playerId) });
      }
      case "rebuy": {
        const room = await rebuyHoldem(id, playerId);
        return NextResponse.json({ room: toHoldemRoomView(room, playerId) });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
