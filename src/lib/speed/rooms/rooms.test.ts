import { describe, expect, it } from "vitest";
import { RoomError } from "@/lib/rooms/errors";
import {
  createSpeedRoom,
  drawSpeed,
  joinSpeedRoom,
  playSpeed,
  readySpeed,
} from "./service";
import { toSpeedRoomView } from "./view";
import { cardId } from "@/lib/tienlen/types";
import { cardsAdjacent } from "../ranks";

describe("speed rooms", () => {
  it("creates a two-seat table and hides the opponent hand", async () => {
    const room = await createSpeedRoom("host-s", "Host");
    expect(room.id).toMatch(/^[A-Z2-9]{6}$/);
    await joinSpeedRoom(room.id, "guest-s", "Guest");
    await readySpeed(room.id, "host-s", true);
    const started = await readySpeed(room.id, "guest-s", true);
    expect(started.state.status).toBe("playing");

    const hostView = toSpeedRoomView(started, "host-s");
    const guestView = toSpeedRoomView(started, "guest-s");
    expect(hostView.view?.hand).toHaveLength(4);
    expect(guestView.view?.hand).toHaveLength(4);
    expect(hostView.view?.hand).not.toEqual(guestView.view?.hand);
    expect(hostView.view?.opponent.showCount).toBe(false);
    expect(hostView.view?.opponent.remaining).toBe(20);
    expect(hostView.view?.pile).toEqual(started.state.players[0].pile);
    expect(guestView.view?.pile).toEqual(started.state.players[1].pile);
    expect(hostView.view?.pile).not.toEqual(guestView.view?.pile);
  });

  it("accepts a legal play and rejects a full-hand draw", async () => {
    const room = await createSpeedRoom("host-p", "Host");
    await joinSpeedRoom(room.id, "guest-p", "Guest");
    await readySpeed(room.id, "host-p", true);
    const started = await readySpeed(room.id, "guest-p", true);
    await expect(drawSpeed(room.id, "host-p")).rejects.toBeInstanceOf(RoomError);
    await expect(playSpeed(room.id, "host-p", "ZZ", 0)).rejects.toBeInstanceOf(
      RoomError,
    );
    const live = started.state.piles[0].live!;
    const playable = started.state.players[0].hand.find((card) =>
      cardsAdjacent(card, live),
    );
    if (playable) {
      const after = await playSpeed(room.id, "host-p", cardId(playable), 0);
      expect(after.state.piles[0].live).toEqual(playable);
    }
  });
});
