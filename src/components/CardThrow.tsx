"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { RoomEvent, RoomView } from "@/lib/rooms/types";
import { isUnoComboType, type Card } from "@/lib/tienlen/types";
import { CardView } from "./CardView";
import { playEventSignature } from "./fxEvent";

const THROW_MS = 460;
const STAGGER_MS = 38;
const DEAL_MS = 440;
const DEAL_STAGGER_MS = 95;

export interface Toss {
  key: string;
  cards: Card[];
  fromId: string;
  land: boolean;
}

export interface Deal {
  key: string;
  count: number;
  toId: string;
}

export function useCardThrow(room: RoomView) {
  const tableRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const seatsRef = useRef(new Map<string, HTMLElement>());
  const [toss, setToss] = useState<Toss | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const primed = useRef(false);
  const play =
    room.lastEvent?.kind === "play" ? room.lastEvent : null;
  const playKey = play ? playEventSignature(play) : "";

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      return;
    }
    const event: RoomEvent | null = room.lastEvent;
    if (event?.kind !== "play" || !playKey) {
      setToss(null);
      setDeal(null);
      return;
    }

    const timers: number[] = [];
    if (event.cards.length > 0) {
      setToss({
        key: playKey,
        cards: event.cards,
        fromId: event.playerId,
        land: !isUnoComboType(event.comboType),
      });
      timers.push(
        window.setTimeout(
          () => setToss(null),
          THROW_MS + event.cards.length * STAGGER_MS + 40,
        ),
      );
    }

    const draw =
      event.uno === "draw2" ||
      event.uno === "draw4" ||
      event.comboType === "draw2" ||
      event.comboType === "draw4";
    if (draw && event.targetPlayerId) {
      const count =
        event.drawn ??
        (event.uno === "draw4" || event.comboType === "draw4" ? 4 : 2);
      setDeal({
        key: `deal-${playKey}`,
        count,
        toId: event.targetPlayerId,
      });
      timers.push(
        window.setTimeout(
          () => setDeal(null),
          DEAL_MS + count * DEAL_STAGGER_MS + 80,
        ),
      );
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // Fire once per play identity — not on chat/poll revision bumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  const bindSeat = (id: string) => (el: HTMLElement | null) => {
    if (el) seatsRef.current.set(id, el);
    else seatsRef.current.delete(id);
  };

  return { tableRef, pileRef, seatsRef, bindSeat, toss, deal };
}

function centerIn(table: DOMRect, el: DOMRect) {
  return {
    x: el.left - table.left + el.width / 2,
    y: el.top - table.top + el.height / 2,
  };
}

export function CardThrow({
  toss,
  tableRef,
  pileRef,
  seatsRef,
}: {
  toss: Toss;
  tableRef: RefObject<HTMLDivElement | null>;
  pileRef: RefObject<HTMLDivElement | null>;
  seatsRef: RefObject<Map<string, HTMLElement>>;
}) {
  const [ready, setReady] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [dest, setDest] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const table = tableRef.current?.getBoundingClientRect();
    if (!table) return;
    const fromEl = seatsRef.current.get(toss.fromId);
    const toEl = pileRef.current;
    const from = fromEl
      ? centerIn(table, fromEl.getBoundingClientRect())
      : { x: table.width / 2, y: table.height - 40 };
    const to = toEl
      ? centerIn(table, toEl.getBoundingClientRect())
      : { x: table.width / 2, y: table.height * 0.42 };
    setOrigin(from);
    setDest(to);
    setMeasured(true);
    setReady(false);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [toss.key, tableRef, pileRef, seatsRef]);

  if (!measured) return null;

  const mid = (toss.cards.length - 1) / 2;
  const cardW = 48;
  const cardH = 70;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {toss.cards.map((card, i) => {
        const spread = (i - mid) * 16;
        const startRot = (i - mid) * 8 + (toss.fromId.length % 5) - 2;
        const endRot = (i - mid) * 5;
        const x0 = origin.x - cardW / 2;
        const y0 = origin.y - cardH / 2;
        const x1 = dest.x - cardW / 2 + spread;
        const y1 = dest.y - cardH / 2;
        const xm = (x0 + x1) / 2;
        const ym = Math.min(y0, y1) - 36;
        return (
          <div
            key={`${toss.key}-${i}`}
            className={ready ? (toss.land ? "card-throw" : "card-throw-fade") : ""}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: cardW,
              height: cardH,
              transform: `translate(${x0}px, ${y0}px) rotate(${startRot}deg) scale(0.72)`,
              ["--x0" as string]: `${x0}px`,
              ["--y0" as string]: `${y0}px`,
              ["--r0" as string]: `${startRot}deg`,
              ["--xm" as string]: `${xm}px`,
              ["--ym" as string]: `${ym}px`,
              ["--x1" as string]: `${x1}px`,
              ["--y1" as string]: `${y1}px`,
              ["--r1" as string]: `${endRot}deg`,
              animationDelay: `${i * STAGGER_MS}ms`,
            }}
          >
            <CardView card={card} size="md" />
          </div>
        );
      })}
    </div>
  );
}

export function CardDeal({
  deal,
  tableRef,
  pileRef,
  seatsRef,
}: {
  deal: Deal;
  tableRef: RefObject<HTMLDivElement | null>;
  pileRef: RefObject<HTMLDivElement | null>;
  seatsRef: RefObject<Map<string, HTMLElement>>;
}) {
  const [ready, setReady] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [dest, setDest] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const table = tableRef.current?.getBoundingClientRect();
    if (!table) return;
    const fromEl = pileRef.current;
    const toEl = seatsRef.current.get(deal.toId);
    const from = fromEl
      ? centerIn(table, fromEl.getBoundingClientRect())
      : { x: table.width / 2, y: table.height * 0.42 };
    const to = toEl
      ? centerIn(table, toEl.getBoundingClientRect())
      : { x: table.width / 2, y: table.height - 36 };
    setOrigin(from);
    setDest(to);
    setMeasured(true);
    setReady(false);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [deal.key, tableRef, pileRef, seatsRef, deal.toId]);

  if (!measured) return null;

  const cardW = 40;
  const cardH = 56;
  const dummy: Card = { rank: "3", suit: "S" };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {Array.from({ length: deal.count }, (_, i) => {
        const x0 = origin.x - cardW / 2;
        const y0 = origin.y - cardH / 2;
        const x1 = dest.x - cardW / 2 + (i - (deal.count - 1) / 2) * 10;
        const y1 = dest.y - cardH / 2;
        const xm = (x0 + x1) / 2;
        const ym = Math.min(y0, y1) - 28;
        return (
          <div
            key={`${deal.key}-${i}`}
            className={ready ? "card-deal" : ""}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: cardW,
              height: cardH,
              transform: `translate(${x0}px, ${y0}px) rotate(-12deg) scale(0.8)`,
              ["--x0" as string]: `${x0}px`,
              ["--y0" as string]: `${y0}px`,
              ["--r0" as string]: `-14deg`,
              ["--xm" as string]: `${xm}px`,
              ["--ym" as string]: `${ym}px`,
              ["--x1" as string]: `${x1}px`,
              ["--y1" as string]: `${y1}px`,
              ["--r1" as string]: `${8 + i * 6}deg`,
              animationDelay: `${i * DEAL_STAGGER_MS}ms`,
            }}
          >
            <CardView card={dummy} size="sm" faceDown />
          </div>
        );
      })}
    </div>
  );
}
