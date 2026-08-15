import { NextResponse } from "next/server";
import { statusForError } from "@/lib/rooms/errors";
import { createHoldemRoom } from "@/lib/holdem/rooms/service";
import { toHoldemRoomView } from "@/lib/holdem/rooms/view";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = String(body.playerId ?? "").trim();
    const playerName = String(body.playerName ?? "Host");
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    const room = await createHoldemRoom(playerId, playerName);
    return NextResponse.json({ room: toHoldemRoomView(room, playerId) });
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
