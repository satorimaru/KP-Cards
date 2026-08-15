"use client";

import { cardKind, formatCard, type Card } from "@/lib/tienlen/types";

const SUIT_SYMBOL: Record<Card["suit"], string> = {
  S: "♠",
  C: "♣",
  D: "♦",
  H: "♥",
};

interface CardViewProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "hand" | "lg" | "fill";
  faceDown?: boolean;
  className?: string;
}

const sizeClass = {
  sm: "h-11 w-8 text-[10px]",
  md: "h-[4.4rem] w-12 text-xs",
  hand: "h-[5.1rem] w-[3.45rem] text-[13px]",
  lg: "h-[6.8rem] w-[4.7rem] text-sm",
  fill: "h-full w-full min-h-0 text-[clamp(1rem,5.2vw,1.55rem)]",
};

function JokerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
    >
      <path
        d="M6 13 L10 6 L16 11 L22 6 L26 13 L20 12 L16 22 L12 12 Z"
        fill="#6b2a86"
      />
      <circle cx="10" cy="6" r="2" fill="#d4b06a" />
      <circle cx="22" cy="6" r="2" fill="#d4b06a" />
      <circle cx="16" cy="22.5" r="2.1" fill="#c41e3a" />
      <path
        d="M11 24.5 Q16 28 21 24.5"
        fill="none"
        stroke="#6b2a86"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CardView({
  card,
  selected,
  onClick,
  disabled,
  size = "md",
  faceDown,
  className,
}: CardViewProps) {
  if (faceDown) {
    return (
      <div
        className={`${sizeClass[size]} card-back rounded-[0.55rem] border border-[#3a0d16] ${className ?? ""}`}
        aria-hidden
      />
    );
  }

  const kind = cardKind(card);
  const special =
    kind === "joker"
      ? "★"
      : kind === "skip"
        ? "⏭"
        : kind === "reverse"
          ? "↻"
          : kind === "draw2"
            ? "+2"
            : kind === "draw4"
              ? "+4"
              : null;
  const specialLabel =
    kind === "joker"
      ? "JK"
      : kind === "skip"
        ? "SK"
        : kind === "reverse"
          ? "RV"
          : kind === "draw2"
            ? "+2"
            : kind === "draw4"
              ? "+4"
              : "";
  const face = kind === "joker" && card.as ? card.as : null;
  const cornerSuit = face?.suit ?? card.suit;
  const red = cornerSuit === "D" || cornerSuit === "H";
  const ink =
    kind === "joker" && !face
      ? "text-[#6b2a86]"
      : special && kind !== "joker"
        ? "text-[#6b2a86]"
        : red
          ? "text-[#c41e3a]"
          : "text-[#1a1612]";
  const symbol = SUIT_SYMBOL[card.suit];
  const interactive = Boolean(onClick) && !disabled;
  const faceClass = [
    sizeClass[size],
    "card-face relative box-border flex flex-col items-center justify-between rounded-[0.7rem] border-[3px] px-[0.32rem] py-[0.28rem]",
    "select-none font-semibold touch-manipulation",
    ink,
    selected ? "border-[var(--gold)]" : "border-transparent",
    selected && size !== "fill" ? "-translate-y-3" : "",
    interactive ? "cursor-pointer active:brightness-95" : "cursor-default",
    className ?? "",
  ].join(" ");

  const body = kind === "joker" ? (
    <>
      <span className="min-h-[1em] self-start leading-none">
        {face ? (
          <>
            {face.rank}
            <span className="text-[0.75em]">{SUIT_SYMBOL[face.suit]}</span>
          </>
        ) : null}
      </span>
      <JokerMark className="h-[1.55em] w-[1.55em]" />
      <span className="min-h-[1em] self-end rotate-180 leading-none">
        {face ? (
          <>
            {face.rank}
            <span className="text-[0.75em]">{SUIT_SYMBOL[face.suit]}</span>
          </>
        ) : null}
      </span>
    </>
  ) : special ? (
    <>
      <span className="self-start text-[10px] leading-none uppercase">
        {specialLabel}
      </span>
      <span className="text-[1.35em] leading-none">{special}</span>
      <span className="self-end text-[10px] leading-none uppercase">
        {specialLabel}
      </span>
    </>
  ) : (
    <>
      <span className="self-start leading-none">{card.rank}</span>
      <span className="text-[1.15em] leading-none">{symbol}</span>
      <span className="self-end rotate-180 leading-none">{card.rank}</span>
    </>
  );

  if (!interactive) {
    return (
      <div className={faceClass} aria-hidden={!selected} aria-label={formatCard(card)}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={faceClass}
      aria-pressed={selected}
      aria-label={formatCard(card)}
    >
      {body}
    </button>
  );
}
