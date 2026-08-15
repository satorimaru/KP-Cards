import { NextResponse } from "next/server";
import { statusForError } from "@/lib/rooms/errors";
import {
  drawSpeed,
  getSpeedRoomForPlayer,
  joinSpeedRoom,
  leaveSpeedRoom,
  nextSpeed,
  playSpeed,
  readySpeed,
  rematchSpeed,
  sortSpeed,
} from "@/lib/speed/rooms/service";
import { toSpeedRoomView } from "@/lib/speed/rooms/view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ roomId: string }> };

function viewFor(
  room: NonNullable<Awaited<ReturnType<typeof leaveSpeedRoom>>>,
  playerId: string,
) {
  return toSpeedRoomView(room, playerId);
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const url = new URL(request.url);
    const playerId = url.searchParams.get("playerId") ?? undefined;
    const room = await getSpeedRoomForPlayer(roomId.toUpperCase(), playerId);
    return NextResponse.json(
      { room: toSpeedRoomView(room, playerId) },
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
        const room = await joinSpeedRoom(id, playerId, String(body.playerName ?? ""));
        return NextResponse.json({ room: viewFor(room, playerId) });
      }
      case "leave": {
        const room = await leaveSpeedRoom(id, playerId);
        return NextResponse.json({ room: room ? viewFor(room, playerId) : null });
      }
      case "ready": {
        const room = await readySpeed(id, playerId, body.ready !== false);
        return NextResponse.json({ room: viewFor(room, playerId) });
      }
      case "play": {
        const room = await playSpeed(id, playerId, body.card, body.pile);
        return NextResponse.json({ room: viewFor(room, playerId) });
      }
      case "draw": {
        const room = await drawSpeed(id, playerId);
        return NextResponse.json({ room: viewFor(room, playerId) });
      }
      case "next": {
        const room = await nextSpeed(id, playerId);
        return NextResponse.json({ room: viewFor(room, playerId) });
      }
      case "sort": {
        const room = await sortSpeed(id, playerId);
        return NextResponse.json({ room: viewFor(room, playerId) });
      }
      case "rematch": {
        const room = await rematchSpeed(id, playerId);
        return NextResponse.json({ room: viewFor(room, playerId) });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
