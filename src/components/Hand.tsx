"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cardId, type Card } from "@/lib/tienlen/types";
import { CardView } from "./CardView";

const CARD_WIDTH = 52;

interface HandProps {
  cards: Card[];
  selected: string[];
  onToggle: (card: Card) => void;
  disabled?: boolean;
}

export function Hand({ cards, selected, onToggle, disabled }: HandProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = cards.length;
  const step =
    n <= 1 || width === 0
      ? CARD_WIDTH
      : Math.min(CARD_WIDTH - 4, Math.max(24, (width - CARD_WIDTH) / (n - 1)));

  return (
    <div
      ref={scroller}
      className="flex overflow-x-auto overflow-y-visible px-1 pt-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((card, i) => {
        const id = cardId(card);
        const isSelected = selected.includes(id);
        return (
          <div
            key={id}
            className="relative shrink-0"
            style={{
              marginLeft: i === 0 ? 0 : step - CARD_WIDTH,
              zIndex: isSelected ? 50 : i + 1,
            }}
          >
            <CardView
              card={card}
              size="hand"
              selected={isSelected}
              onClick={() => onToggle(card)}
              disabled={disabled}
            />
          </div>
        );
      })}
    </div>
  );
}
