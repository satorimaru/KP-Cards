import { NextResponse } from "next/server";
import { statusForError } from "@/lib/rooms/errors";
import {
  bjBet,
  bjDeal,
  bjDouble,
  bjHit,
  bjInsure,
  bjNext,
  bjRebuy,
  bjSplit,
  bjStand,
  getBjRoomForPlayer,
  joinBjRoom,
  leaveBjRoom,
} from "@/lib/blackjack/rooms/service";
import { toBjRoomView } from "@/lib/blackjack/rooms/view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ roomId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const playerId = new URL(request.url).searchParams.get("playerId") ?? undefined;
    const room = await getBjRoomForPlayer(roomId.toUpperCase());
    return NextResponse.json(
      { room: toBjRoomView(room, playerId) },
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
    const action = String(body.action ?? "");
    const run = {
      join: () => joinBjRoom(id, playerId, String(body.playerName ?? "")),
      leave: () => leaveBjRoom(id, playerId),
      bet: () => bjBet(id, playerId, Number(body.amount)),
      deal: () => bjDeal(id, playerId),
      hit: () => bjHit(id, playerId),
      stand: () => bjStand(id, playerId),
      double: () => bjDouble(id, playerId),
      split: () => bjSplit(id, playerId),
      insure: () => bjInsure(id, playerId, Boolean(body.take)),
      next: () => bjNext(id, playerId),
      rebuy: () => bjRebuy(id, playerId),
    }[action];
    if (!run) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    const room = await run();
    return NextResponse.json({
      room: room ? toBjRoomView(room, playerId) : null,
    });
  } catch (e) {
    const { message, status } = statusForError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
