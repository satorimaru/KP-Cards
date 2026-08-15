"use client";

import type { RoomEvent, RoomView } from "@/lib/rooms/types";
import { playEventSignature, useEphemeralFx } from "./fxEvent";

const FX_MS = 2200;

export type BombPlayEvent = Extract<RoomEvent, { kind: "play" }>;

export function isBombFxEvent(event: RoomEvent | null): event is BombPlayEvent {
  return event?.kind === "play" && event.bombed === true;
}

export function useBombFx(room: RoomView) {
  const event = isBombFxEvent(room.lastEvent) ? room.lastEvent : null;
  const { fx, burstKey } = useEphemeralFx(
    event,
    event ? playEventSignature(event) : "",
    FX_MS,
  );
  return { bombFx: fx, bombKey: burstKey };
}

export function MushroomCloud({
  size = "table",
  burstKey,
}: {
  size?: "table" | "seat";
  burstKey: number;
}) {
  const table = size !== "seat";
  return (
    <div
      key={burstKey}
      className={["nuke", table ? "nuke-table" : "nuke-seat"].join(" ")}
      aria-hidden
    >
      {table && <span className="nuke-blast" />}
      <span className="nuke-flash" />
      <span className="nuke-stem" />
      <span className="nuke-cap" />
      {table && <span className="nuke-lobe nuke-lobe-left" />}
      {table && <span className="nuke-lobe nuke-lobe-right" />}
      <span className="nuke-ring" />
      <span className="nuke-ring nuke-ring-late" />
      {table && <span className="nuke-ring nuke-ring-far" />}
    </div>
  );
}
