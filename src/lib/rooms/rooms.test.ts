import { describe, expect, it } from "vitest";
import { RoomError } from "./errors";
import {
  buyIn,
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
import { getRoom, saveRoom } from "./store";
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

  it("seeds chips, settles a 2-player hand, and requires a buy-in when broke", async () => {
    const room = await createRoom("chip-host", "Host", 2, {
      chips: true,
      startChips: 10,
    });
    expect(room.players[0].chips).toBe(10);
    expect(room.players[0].buyIns).toBe(0);

    await joinRoom(room.id, "chip-guest", "Guest");
    const seated = await getRoom(room.id);
    expect(seated?.players.map((p) => p.chips)).toEqual([10, 10]);

    await setReady(room.id, "chip-host", true);
    await setReady(room.id, "chip-guest", true);
    const started = await startGame(room.id, "chip-host");
    const host = started.players.find((p) => p.id === "chip-host")!;
    const guest = started.players.find((p) => p.id === "chip-guest")!;
    const lead = { rank: "3" as const, suit: "S" as const};

    started.hands[host.id] = [lead];
    started.hands[guest.id] = [{ rank: "4", suit: "H" }];
    started.leadCard = lead;
    started.currentPlayerId = host.id;
    started.pile = [];
    started.pileType = null;
    started.passesInRow = 0;
    guest.chips = 1;
    await saveRoom(started);

    const finished = await playCards(room.id, host.id, [lead]);
    expect(finished.status).toBe("finished");
    const hostAfter = finished.players.find((p) => p.id === "chip-host")!;
    const guestAfter = finished.players.find((p) => p.id === "chip-guest")!;
    expect(hostAfter.finishOrder).toBe(1);
    expect(guestAfter.finishOrder).toBe(2);
    expect(hostAfter.chips).toBe(11);
    expect(guestAfter.chips).toBe(0);
    expect(finished.lastChipPays).toEqual([
      { fromPlayerId: "chip-guest", toPlayerId: "chip-host", amount: 1 },
    ]);

    await rematchRoom(room.id, "chip-host");
    await setReady(room.id, "chip-host", true);
    await setReady(room.id, "chip-guest", true);
    await expect(startGame(room.id, "chip-host")).rejects.toThrow(/needChips/);

    await expect(buyIn(room.id, "chip-host")).rejects.toThrow(/notBroke/);
    const bought = await buyIn(room.id, "chip-guest");
    const guestBought = bought.players.find((p) => p.id === "chip-guest")!;
    expect(guestBought.chips).toBe(10);
    expect(guestBought.buyIns).toBe(1);
    expect(bought.lastEvent).toEqual({
      kind: "buyin",
      playerId: "chip-guest",
      amount: 10,
    });

    const rematchStacks = bought.players.map((p) => p.chips);
    const again = await startGame(room.id, "chip-host");
    expect(again.status).toBe("playing");
    expect(again.players.map((p) => p.chips)).toEqual(rematchStacks);
    expect(again.lastChipPays).toEqual([]);
  });

  it("settles a 3-player hand: 3rd pays 1st, 2nd sits", async () => {
    const room = await createRoom("chip3-host", "Host", 3, {
      chips: true,
      startChips: 10,
    });
    await joinRoom(room.id, "chip3-a", "A");
    await joinRoom(room.id, "chip3-b", "B");
    await setReady(room.id, "chip3-host", true);
    await setReady(room.id, "chip3-a", true);
    await setReady(room.id, "chip3-b", true);
    const started = await startGame(room.id, "chip3-host");
    const byId = Object.fromEntries(started.players.map((p) => [p.id, p]));
    const first = { rank: "3" as const, suit: "S" as const };
    const beat = { rank: "5" as const, suit: "H" as const };

    started.hands["chip3-host"] = [first];
    started.hands["chip3-a"] = [beat];
    started.hands["chip3-b"] = [
      { rank: "4", suit: "D" },
      { rank: "6", suit: "C" },
    ];
    started.leadCard = first;
    started.currentPlayerId = "chip3-host";
    started.pile = [];
    started.pileType = null;
    started.passesInRow = 0;
    byId["chip3-host"].cardCount = 1;
    byId["chip3-a"].cardCount = 1;
    byId["chip3-b"].cardCount = 2;
    await saveRoom(started);

    await playCards(room.id, "chip3-host", [first]);
    const finished = await playCards(room.id, "chip3-a", [beat]);
    expect(finished.status).toBe("finished");
    expect(
      finished.players.map((p) => [p.id, p.finishOrder, p.chips]),
    ).toEqual([
      ["chip3-host", 1, 12],
      ["chip3-a", 2, 10],
      ["chip3-b", 3, 8],
    ]);
    expect(finished.lastChipPays).toEqual([
      { fromPlayerId: "chip3-b", toPlayerId: "chip3-host", amount: 2 },
    ]);
  });
});
