import { NextResponse } from "next/server";
import { parseRules } from "@/lib/rules";
import { statusForError } from "@/lib/rooms/errors";
import { createRoom } from "@/lib/rooms/service";
import { toRoomView } from "@/lib/rooms/view";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = String(body.playerId ?? "").trim();
    const playerName = String(body.playerName ?? "Host");
    const maxPlayers = Number(body.maxPlayers ?? 4) as 2 | 3 | 4;

    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    if (![2, 3, 4].includes(maxPlayers)) {
      return NextResponse.json(
        { error: "maxPlayers must be 2, 3, or 4" },
        { status: 400 },
      );
    }

    const room = await createRoom(
      playerId,
      playerName,
      maxPlayers,
      parseRules(body.rules),
    );
    return NextResponse.json({ room: toRoomView(room, playerId) });
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
