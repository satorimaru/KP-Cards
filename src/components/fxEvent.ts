"use client";

import { useEffect, useState } from "react";
import type { RoomEvent } from "@/lib/rooms/types";
import { cardId } from "@/lib/tienlen/types";

/** Stable identity for a play so FX fire once, not on every poll / turn bump. */
export function playEventSignature(
  event: Extract<RoomEvent, { kind: "play" }>,
): string {
  return [
    event.playerId,
    event.comboType,
    event.uno ?? "",
    event.bombed ? "b" : "",
    event.targetPlayerId ?? "",
    String(event.drawn ?? 0),
    event.cards.map(cardId).join(","),
  ].join("|");
}

export function eventSignature(event: RoomEvent | null): string {
  if (!event) return "";
  if (event.kind === "play") return `play|${playEventSignature(event)}`;
  if (event.kind === "pass") return `pass|${event.playerId}`;
  return event.kind;
}

/** Show `active` until `ms` elapses. Re-runs only when `signature` changes. */
export function useEphemeralFx<T>(
  active: T | null,
  signature: string,
  ms: number,
): { fx: T | null; burstKey: number } {
  const [fx, setFx] = useState<T | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (!signature) {
      setFx(null);
      return;
    }
    setFx(active);
    setBurstKey((n) => n + 1);
    const id = window.setTimeout(() => setFx(null), ms);
    return () => window.clearTimeout(id);
    // `active` is the payload from the render that produced `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ms]);

  return { fx, burstKey };
}
