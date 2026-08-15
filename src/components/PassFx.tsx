"use client";

import type { RoomView } from "@/lib/rooms/types";
import { eventSignature, useEphemeralFx } from "./fxEvent";

const FX_MS = 1100;

export function usePassFx(room: RoomView) {
  const event = room.lastEvent?.kind === "pass" ? room.lastEvent : null;
  const { fx, burstKey } = useEphemeralFx(
    event,
    event ? eventSignature(event) : "",
    FX_MS,
  );
  return { passId: fx?.playerId ?? null, passKey: burstKey };
}

export function PassWave({ burstKey }: { burstKey: number }) {
  return (
    <div key={burstKey} className="pass-wave" aria-hidden>
      <svg viewBox="0 0 32 32" className="pass-wave-hand">
        <path
          d="M11 18 V9.5 a1.6 1.6 0 0 1 3.2 0 V16"
          fill="none"
          stroke="#f4ead8"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M14.2 16 V8.2 a1.55 1.55 0 0 1 3.1 0 V16"
          fill="none"
          stroke="#f4ead8"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M17.3 16 V9 a1.5 1.5 0 0 1 3 0 V16.2"
          fill="none"
          stroke="#f4ead8"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M20.3 16.4 V11.2 a1.45 1.45 0 0 1 2.7.6 L22.4 18"
          fill="none"
          stroke="#f4ead8"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M11 18.2 c0 4.2 2.6 7.4 7.1 7.4 3.8 0 6.2-2.2 6.2-5.4"
          fill="none"
          stroke="#f4ead8"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
