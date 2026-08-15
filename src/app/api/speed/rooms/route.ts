import { NextResponse } from "next/server";
import { statusForError } from "@/lib/rooms/errors";
import { createSpeedRoom } from "@/lib/speed/rooms/service";
import { toSpeedRoomView } from "@/lib/speed/rooms/view";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = String(body.playerId ?? "").trim();
    const playerName = String(body.playerName ?? "Host");
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    const room = await createSpeedRoom(playerId, playerName);
    return NextResponse.json({ room: toSpeedRoomView(room, playerId) });
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
