import { describe, expect, it } from "vitest";
import { RoomError } from "./errors";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  playCards,
  rematchRoom,
  sendMessage,
  setReady,
  setRoomRules,
  startGame,
} from "./service";
import { MAX_CHAT_TEXT } from "./types";
import { sameCard } from "@/lib/tienlen/types";
import { getRoom } from "./store";
import { toPublicView, toRoomView } from "./view";

describe("rooms", () => {
  it("creates a short room code and seats the host", async () => {
    const room = await createRoom("host-1", "Kian", 2);
    expect(room.id).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.players).toHaveLength(1);
    expect(room.hostId).toBe("host-1");
    expect(room.status).toBe("waiting");
  });

  it("never includes another player's hand in a view", async () => {
    const room = await createRoom("host-2", "Host", 2);
    await joinRoom(room.id, "guest-2", "Guest");
    await setReady(room.id, "host-2", true);
    await setReady(room.id, "guest-2", true);
    const started = await startGame(room.id, "host-2");

    const hostView = toRoomView(started, "host-2");
    const guestView = toRoomView(started, "guest-2");
    const publicView = toPublicView(started);

    expect(hostView.hand.length).toBeGreaterThan(0);
    expect(guestView.hand.length).toBeGreaterThan(0);
    expect(hostView.hand).not.toEqual(guestView.hand);
    expect(publicView.hand).toEqual([]);
    expect(publicView.you).toBeNull();
    expect(hostView.players.every((p) => !("hands" in p))).toBe(true);
  });

  it("starts only when the host and every seat is ready", async () => {
    const room = await createRoom("host-3", "Host", 2);
    await joinRoom(room.id, "guest-3", "Guest");
    await expect(startGame(room.id, "guest-3")).rejects.toBeInstanceOf(RoomError);
    await expect(startGame(room.id, "host-3")).rejects.toThrow(/ready/);
    await setReady(room.id, "host-3", true);
    await setReady(room.id, "guest-3", true);
    const started = await startGame(room.id, "host-3");
    expect(started.status).toBe("playing");
    expect(started.currentPlayerId).toBeTruthy();
    expect(started.leadCard).toBeTruthy();
    const leader = started.players.find((p) => p.id === started.currentPlayerId);
    const leaderHand = started.hands[leader!.id];
    expect(leaderHand.some((card) => sameCard(card, started.leadCard!))).toBe(
      true,
    );
  });

  it("transfers the host and deletes an empty room on leave", async () => {
    const room = await createRoom("host-4", "Host", 3);
    await joinRoom(room.id, "guest-4", "Guest");
    const afterHostLeft = await leaveRoom(room.id, "host-4");
    expect(afterHostLeft?.hostId).toBe("guest-4");
    expect(afterHostLeft?.players).toHaveLength(1);

    const empty = await leaveRoom(room.id, "guest-4");
    expect(empty).toBeNull();
    expect(await getRoom(room.id)).toBeNull();
  });

  it("rejects a play that is not that player's turn", async () => {
    const room = await createRoom("host-5", "Host", 2);
    await joinRoom(room.id, "guest-5", "Guest");
    await setReady(room.id, "host-5", true);
    await setReady(room.id, "guest-5", true);
    const started = await startGame(room.id, "host-5");
    const waiter = started.players.find((p) => p.id !== started.currentPlayerId)!;
    const waiterHand = started.hands[waiter.id];
    await expect(
      playCards(started.id, waiter.id, [waiterHand[0]]),
    ).rejects.toThrow(/notYourTurn/);
  });

  it("stores table chat without touching the turn", async () => {
    const room = await createRoom("host-6", "Host", 2);
    await joinRoom(room.id, "guest-6", "Guest");
    const turnBefore = room.turnVersion;

    const after = await sendMessage(room.id, "host-6", "  hello table  ");
    expect(after.turnVersion).toBe(turnBefore);
    expect(after.messages).toHaveLength(1);
    expect(after.messages[0].text).toBe("hello table");
    expect(after.messages[0].name).toBe("Host");
    expect(after.revision).toBeGreaterThan(room.revision);

    await expect(sendMessage(room.id, "stranger", "hi")).rejects.toThrow(
      /Not a player/,
    );
    await expect(sendMessage(room.id, "host-6", "   ")).rejects.toThrow(
      /Message required/,
    );
    await expect(
      sendMessage(room.id, "guest-6", "x".repeat(MAX_CHAT_TEXT + 1)),
    ).rejects.toThrow(/under/);

    const hostView = toRoomView(after, "host-6");
    const publicView = toPublicView(after);
    expect(hostView.messages).toHaveLength(1);
    expect(publicView.messages).toEqual([]);

    const rematched = await rematchRoom(room.id, "host-6");
    expect(rematched.messages).toHaveLength(1);
    expect(rematched.messages[0].text).toBe("hello table");

    await setReady(room.id, "host-6", true);
    await setReady(room.id, "guest-6", true);
    const started = await startGame(room.id, "host-6");
    expect(started.messages).toHaveLength(1);
    const chatting = await sendMessage(room.id, "guest-6", "good luck");
    expect(chatting.messages.map((m) => m.text)).toEqual([
      "hello table",
      "good luck",
    ]);
    expect(chatting.turnVersion).toBe(started.turnVersion);
  });

  it("stores house rules and deals 13 in a 3-player room when 17 is off", async () => {
    const room = await createRoom("host-7", "Host", 3, {
      threePlayerSeventeen: false,
      noFinishOnTwo: true,
    });
    expect(room.rules.threePlayerSeventeen).toBe(false);
    expect(room.rules.noFinishOnTwo).toBe(true);

    await joinRoom(room.id, "g1", "A");
    await joinRoom(room.id, "g2", "B");
    const updated = await setRoomRules(room.id, "host-7", {
      threePlayerSeventeen: false,
      noFinishOnTwo: false,
    });
    expect(updated.rules.noFinishOnTwo).toBe(false);

    await setReady(room.id, "host-7", true);
    await setReady(room.id, "g1", true);
    await setReady(room.id, "g2", true);
    const started = await startGame(room.id, "host-7");
    expect(
      Object.values(started.hands).every((h) => h.length === 13),
    ).toBe(true);
  });
});
