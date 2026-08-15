import { NextResponse } from "next/server";
import { statusForError } from "@/lib/rooms/errors";
import { createBjRoom } from "@/lib/blackjack/rooms/service";
import { toBjRoomView } from "@/lib/blackjack/rooms/view";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = String(body.playerId ?? "").trim();
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    const room = await createBjRoom(playerId, String(body.playerName ?? "Host"));
    return NextResponse.json({ room: toBjRoomView(room, playerId) });
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
