"use client";

import { cardId, type Card } from "@/lib/tienlen/types";
import { CardView } from "./CardView";

export function FeltStack({
  cards,
  faceDown,
  overlapRem = 0,
  className,
}: {
  cards: Array<Card | null>;
  faceDown?: boolean | ((i: number) => boolean);
  overlapRem?: number;
  className?: string;
}) {
  const hidden = (i: number) =>
    typeof faceDown === "function" ? faceDown(i) : Boolean(faceDown);

  return (
    <div
      className={["flex h-full min-h-0 items-stretch justify-center", className ?? ""].join(
        " ",
      )}
    >
      {cards.map((card, i) => {
        const down = hidden(i) || !card;
        return (
          <div
            key={card ? `${cardId(card)}-${i}` : `blank-${i}`}
            className="h-full min-h-0 aspect-[5/7]"
            style={i === 0 ? undefined : { marginLeft: `-${overlapRem}rem` }}
          >
            {card && !down ? (
              <CardView card={card} size="fill" />
            ) : (
              <div
                className="card-back h-full w-full rounded-[0.55rem] border border-[#3a0d16]"
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
