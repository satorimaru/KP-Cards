"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import { BLITZ_MS, DEFAULT_RULES, parseRules, teamOf } from "@/lib/rules";
import type { RoomEvent, RoomView } from "@/lib/rooms/types";
import { beats, detectCombo } from "@/lib/tienlen/combos";
import { isStuckOnLastTwo } from "@/lib/tienlen/engine";
import {
  cardId,
  formatCard,
  isJoker,
  sameCard,
  SUITS,
  WILD_RANKS,
  type Card,
  type Rank,
  type Suit,
} from "@/lib/tienlen/types";
import { eventSignature } from "./fxEvent";
import { useApp } from "./AppProviders";
import { useSfxWatch } from "./useSfx";
import type { SfxName } from "@/lib/sfx";
import { CardDeal, CardThrow, useCardThrow } from "./CardThrow";
import { CardView } from "./CardView";
import { Hand } from "./Hand";
import { ResultModal } from "./ResultModal";
import { MushroomCloud, useBombFx } from "./BombFx";
import { PassWave, usePassFx } from "./PassFx";
import {
  UnoBurst,
  UnoDirectionBar,
  SkipX,
  UnoPlayedBadge,
  UnoPlayerMark,
  UnoSeatArrow,
  playerLabel,
  useUnoFx,
} from "./UnoFx";

interface GameTableProps {
  room: RoomView;
  playerId: string;
  onPlay: (cards: Card[]) => Promise<void>;
  onPass: () => Promise<void>;
  onRematch: () => Promise<void>;
  onBuyIn?: () => void;
  onMenu?: () => void;
  busy?: boolean;
  error?: string | null;
  rematchLabel?: string;
  rematchHint?: string;
  menuLabel?: string;
  onTimeout?: () => void;
}

function comboKey(type: string): MessageKey {
  const key = `combo.${type}` as MessageKey;
  return key;
}

function messyLayer(i: number): { transform: string } {
  const rot = ((i * 23 + 7) % 25) - 12;
  const dx = ((i * 11) % 17) - 8;
  const dy = ((i * 9) % 13) - 6;
  return { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)` };
}

export function GameTable({
  room,
  playerId,
  onPlay,
  onPass,
  onRematch,
  onBuyIn,
  onMenu,
  busy,
  error,
  rematchLabel,
  rematchHint,
  menuLabel,
  onTimeout,
}: GameTableProps) {
  const playSfxName: SfxName | null = (() => {
    const e = room.lastEvent;
    if (!e) return null;
    if (e.kind === "pass") return "pass";
    if (e.kind === "start") return "deal";
    if (e.kind === "play") {
      if (e.bombed) return "bomb";
      if (e.uno) return "uno";
      return "play";
    }
    return null;
  })();
  useSfxWatch(eventSignature(room.lastEvent), playSfxName);
  useSfxWatch(
    room.status === "finished" ? `end|${room.winners.join(",")}` : "",
    room.status === "finished"
      ? room.winners[0] === playerId
        ? "win"
        : "lose"
      : null,
  );
  const { t, te } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [jokerFace, setJokerFace] = useState<
    Record<string, { rank: Rank; suit: Suit }>
  >({});
  const rules = room.rules ?? parseRules(DEFAULT_RULES);

  const me = room.players.find((p) => p.id === playerId);
  const isMyTurn = room.currentPlayerId === playerId;
  const opponents = room.players.filter((p) => p.id !== playerId);
  const { fx, burstKey } = useUnoFx(room);
  const { bombFx, bombKey } = useBombFx(room);
  const { passId, passKey } = usePassFx(room);
  const { tableRef, pileRef, seatsRef, bindSeat, toss, deal } = useCardThrow(room);
  const unoOn = Boolean(rules.uno);
  const hidePile = Boolean(toss?.land);
  const trick = room.trick ?? [];

  const selectedCards: Card[] = useMemo(() => {
    return room.hand
      .filter((c) => selected.includes(cardId(c)))
      .map((c) => {
        if (!isJoker(c)) return c;
        const face = jokerFace[cardId(c)];
        return face ? { ...c, as: face } : c;
      });
  }, [room.hand, selected, jokerFace]);

  const selectedJokers = selectedCards.filter(isJoker);
  const jokersReady = selectedJokers.every((c) => c.as);

  const combo = useMemo(() => detectCombo(selectedCards), [selectedCards]);

  const pileCombo = useMemo(() => {
    if (!room.pile.length || !room.pileType) return null;
    return detectCombo(room.pile);
  }, [room.pile, room.pileType]);

  const mustLeadCard =
    !room.pile.length &&
    room.leadCard &&
    room.hand.some((c) => sameCard(c, room.leadCard!))
      ? room.leadCard
      : null;

  const canPlay = useMemo(() => {
    if (!isMyTurn || !combo || !jokersReady) return false;
    if (me?.satOut && !rules.playAfterPass) return false;
    if (combo.uno && !rules.uno) return false;
    if (mustLeadCard && !selectedCards.some((c) => sameCard(c, mustLeadCard))) {
      return false;
    }
    if (
      rules.noFinishOnTwo &&
      selectedCards.length === room.hand.length &&
      selectedCards.some((c) => c.rank === "2")
    ) {
      return false;
    }
    return beats(combo, pileCombo);
  }, [
    isMyTurn,
    combo,
    mustLeadCard,
    selectedCards,
    pileCombo,
    rules.noFinishOnTwo,
    rules.uno,
    rules.playAfterPass,
    room.hand.length,
    jokersReady,
    me?.satOut,
  ]);

  const [blitzLeft, setBlitzLeft] = useState<number | null>(null);
  const timedOut = useRef(false);
  useEffect(() => {
    timedOut.current = false;
    if (!rules.blitz || room.status !== "playing" || !room.currentPlayerId) {
      setBlitzLeft(null);
      return;
    }
    const started = room.turnStartedAt ?? Date.now();
    const tick = () => {
      const left = Math.max(0, started + BLITZ_MS - Date.now());
      setBlitzLeft(left);
      if (left <= 0 && isMyTurn && !timedOut.current) {
        timedOut.current = true;
        onTimeout?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 80);
    return () => window.clearInterval(id);
  }, [
    rules.blitz,
    room.status,
    room.currentPlayerId,
    room.turnStartedAt,
    room.turnVersion,
    isMyTurn,
    onTimeout,
  ]);

  const canPass =
    isMyTurn &&
    (room.pile.length > 0 || isStuckOnLastTwo(room.hand, rules));

  const banner = (() => {
    const event: RoomEvent | null = room.lastEvent;
    if (!event) return null;
    const name =
      "playerId" in event
        ? playerLabel(
            room.players,
            event.playerId,
            playerId,
            t("game.you"),
            t("game.someone"),
          )
        : "";
    switch (event.kind) {
      case "play": {
        const uno = event.uno ?? (
          event.comboType === "skip" ||
          event.comboType === "reverse" ||
          event.comboType === "draw2" ||
          event.comboType === "draw4"
            ? event.comboType
            : undefined
        );
        if (uno === "skip") {
          return t("game.skipped", {
            name,
            target: playerLabel(
              room.players,
              event.targetPlayerId,
              playerId,
              t("game.you"),
              t("game.someone"),
            ),
          });
        }
        if (uno === "reverse") {
          return t("game.reversed", { name });
        }
        if (event.bombed) {
          return event.targetPlayerId
            ? t("game.bombed", {
                name,
                target: playerLabel(
                  room.players,
                  event.targetPlayerId,
                  playerId,
                  t("game.you"),
                  t("game.someone"),
                ),
              })
            : t("game.bombSolo", { name });
        }
        if (uno === "draw2" || uno === "draw4") {
          return t("game.drew", {
            name,
            target: playerLabel(
              room.players,
              event.targetPlayerId,
              playerId,
              t("game.you"),
              t("game.someone"),
            ),
            n: event.drawn ?? (event.comboType === "draw2" ? 2 : 4),
          });
        }
        return `${name} · ${t(comboKey(event.comboType))}`;
      }
      case "pass":
        return `${name} ${t("game.passed")}`;
      case "start":
        return t("game.cardsOut");
      default:
        return null;
    }
  })();

  const toggle = (c: Card) => {
    if (!isMyTurn) return;
    const id = cardId(c);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (selected.includes(id)) {
      setJokerFace((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const currentName =
    room.players.find((p) => p.id === room.currentPlayerId)?.name ?? "…";

  const prompt =
    room.status === "finished"
      ? t("game.handOver")
      : isMyTurn
        ? room.pile.length
          ? t("game.beatOrPass")
          : mustLeadCard
            ? t("game.lead", { card: formatCard(mustLeadCard) })
            : t("game.yourLead")
        : "\u00a0";

  const nextAfterMe = useMemo(() => {
    if (!unoOn || !me || room.status !== "playing") return null;
    let dir: 1 | -1 = room.direction === -1 ? -1 : 1;
    if (combo?.uno === "reverse") dir = dir === 1 ? -1 : 1;
    const n = room.players.length;
    for (let i = 1; i <= n; i++) {
      const seat = (me.seat + dir * i + n) % n;
      const p = room.players.find((x) => x.seat === seat);
      if (!p || p.finishOrder != null) continue;
      if (!rules.playAfterPass && p.satOut) continue;
      return p;
    }
    return null;
  }, [
    unoOn,
    me,
    room.status,
    room.direction,
    room.players,
    combo?.uno,
    rules.playAfterPass,
  ]);

  const nextSide = useMemo((): "left" | "right" | null => {
    if (!nextAfterMe) return null;
    const idx = opponents.findIndex((p) => p.id === nextAfterMe.id);
    if (idx < 0) return null;
    if (opponents.length <= 1) {
      let dir: 1 | -1 = room.direction === -1 ? -1 : 1;
      if (combo?.uno === "reverse") dir = dir === 1 ? -1 : 1;
      return dir === 1 ? "left" : "right";
    }
    return idx < opponents.length / 2 ? "left" : "right";
  }, [nextAfterMe, opponents, room.direction, combo?.uno]);

  return (
    <div ref={tableRef} className="game-board relative flex min-h-0 flex-1 flex-col">
      {toss && (
        <CardThrow
          key={toss.key}
          toss={toss}
          tableRef={tableRef}
          pileRef={pileRef}
          seatsRef={seatsRef}
        />
      )}
      {deal && (
        <CardDeal
          key={deal.key}
          deal={deal}
          tableRef={tableRef}
          pileRef={pileRef}
          seatsRef={seatsRef}
        />
      )}
      <div className="seat-row flex items-stretch gap-1 overflow-hidden px-1">
        {opponents.map((p, i) => (
          <div key={p.id} className="flex min-w-0 flex-1 items-stretch">
          {unoOn && i > 0 && (
            <UnoSeatArrow direction={room.direction === -1 ? -1 : 1} />
          )}
          <div
            ref={bindSeat(p.id)}
            className="relative min-w-0 flex-1"
          >
          <div
            className={[
              "seat-card relative flex flex-col items-center justify-center overflow-hidden rounded-2xl px-1.5 text-center",
              p.id === room.currentPlayerId
                ? "turn-seat"
                : p.satOut
                  ? "seat-out bg-black/20"
                  : "bg-black/20",
              fx?.playerId === p.id ? "uno-played-seat" : "",
              fx?.targetPlayerId === p.id &&
              (fx.uno === "draw2" || fx.uno === "draw4")
                ? "ring-1 ring-[var(--gold)]"
                : "",
            ].join(" ")}
          >
            <p
              className={[
                "h-3 text-[10px] font-bold uppercase tracking-[0.16em]",
                p.id === room.currentPlayerId
                  ? "text-[#1a1408]"
                  : "invisible",
              ].join(" ")}
            >
              {t("game.turnBadge")}
            </p>
            <p
              className={[
                "w-full truncate text-xs font-medium",
                p.id === room.currentPlayerId
                  ? "text-[#1a1408]"
                  : "text-[var(--ivory)]",
              ].join(" ")}
            >
              {p.name}
            </p>
            {rules.chips && (
              <p className="h-3 w-full truncate text-[10px] tabular-nums text-[var(--gold)]">
                {p.chips ?? 0}
                {(p.buyIns ?? 0) > 0 ? ` ↻${p.buyIns}` : ""}
              </p>
            )}
            {rules.fifty && (
              <p className="h-3 w-full truncate text-[10px] tabular-nums text-[var(--gold)]">
                {p.fiftyScore ?? 0}
              </p>
            )}
            <div className="mt-0.5 flex h-4 items-center justify-center gap-1">
              {p.finishOrder != null ? (
                <span className="text-[10px] font-semibold text-[var(--gold)]">
                  #{p.finishOrder}
                </span>
              ) : room.status === "playing" ? (
                <span className={p.satOut ? "round-out" : "round-in"}>
                  {p.satOut ? t("game.satOut") : t("game.inRound")}
                </span>
              ) : null}
              {rules.siege && room.players.length === 4 && (
                <span
                  className={[
                    "text-[10px]",
                    p.id === room.currentPlayerId
                      ? "text-[#1a1408]/70"
                      : "text-[var(--gold-dim)]",
                  ].join(" ")}
                >
                  {teamOf(p.seat) === 0 ? t("game.teamA") : t("game.teamB")}
                </span>
              )}
            </div>
            <p
              className={[
                "h-4 text-[11px] font-semibold",
                p.id === room.currentPlayerId
                  ? "text-[#1a1408]"
                  : "text-[var(--mute)]",
              ].join(" ")}
            >
              {p.cardCount}
            </p>
            <UnoPlayerMark player={p} fx={fx} youId={playerId} />
            <UnoPlayedBadge playerId={p.id} fx={fx} />
            {fx?.targetPlayerId === p.id && fx.uno === "skip" && (
              <SkipX burstKey={burstKey} />
            )}
            {passId === p.id && <PassWave burstKey={passKey} />}
            {bombFx?.targetPlayerId === p.id && (
              <MushroomCloud size="seat" burstKey={bombKey} />
            )}
          </div>
          </div>
          </div>
        ))}
      </div>

      <div
        className={[
          "table-felt relative my-1 flex min-h-0 flex-1 flex-col items-center overflow-hidden rounded-[1.6rem] px-3",
          unoOn && room.status === "playing" ? "pt-11 pb-3" : "py-3",
          bombFx ? "nuke-shake" : "",
        ].join(" ")}
      >
        {unoOn && room.status === "playing" && (
          <div className="absolute inset-x-2 top-1.5 z-10">
            <UnoDirectionBar
              direction={room.direction === -1 ? -1 : 1}
              reversing={fx?.comboType === "reverse"}
            />
          </div>
        )}
        {unoOn && nextSide && nextAfterMe && (
          <span
            className={[
              "dir-felt-arrow",
              nextSide === "left" ? "dir-felt-left" : "dir-felt-right",
              isMyTurn && combo?.uno ? "dir-felt-hot" : "",
            ].join(" ")}
            aria-label={`${t("game.unoHits")} ${nextAfterMe.name}`}
          >
            ▲
          </span>
        )}
        {bombFx && <MushroomCloud size="table" burstKey={bombKey} />}
        {fx && (
          <UnoBurst
            event={fx}
            burstKey={burstKey}
            actor={playerLabel(
              room.players,
              fx.playerId,
              playerId,
              t("game.you"),
              t("game.someone"),
            )}
            target={playerLabel(
              room.players,
              fx.targetPlayerId,
              playerId,
              t("game.you"),
              t("game.someone"),
            )}
          />
        )}
        {rules.blitz && blitzLeft != null && room.status === "playing" && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 w-16">
            <div className="mb-0.5 text-center text-[10px] tabular-nums text-[var(--gold)]">
              {t("game.timer", { n: Math.ceil(blitzLeft / 1000) })}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full bg-[var(--gold)]"
                style={{ width: `${(blitzLeft / BLITZ_MS) * 100}%` }}
              />
            </div>
          </div>
        )}
        <p className="felt-banner w-full shrink-0 text-center text-[11px] tracking-wide text-[var(--gold)]">
          {banner ?? "\u00a0"}
        </p>
        <div className="flex h-9 w-full shrink-0 items-center justify-center">
          {room.status === "playing" && (
            <div
              key={room.currentPlayerId ?? "none"}
              className="turn-chip"
            >
              {isMyTurn
                ? t("game.yourTurn")
                : t("game.turnOf", { name: currentName })}
            </div>
          )}
        </div>
        <p className="felt-prompt mb-1 w-full shrink-0 text-center text-sm text-[var(--ivory)]">
          {prompt}
        </p>
        <div
          ref={pileRef}
          className="relative flex min-h-0 w-full min-w-[9rem] flex-1 items-center justify-center"
        >
          {room.status !== "finished" &&
            trick.map((cards, i) => (
            <div
              key={`under-${i}`}
              className="trick-under pointer-events-none absolute flex gap-0.5"
              style={messyLayer(i)}
            >
              {cards.map((c) => (
                <CardView key={cardId(c)} card={c} size="sm" />
              ))}
            </div>
          ))}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-1">
            {room.status === "finished" || hidePile ? null : room.pile.length > 0 ? (
              room.pile.map((c) => (
                <CardView key={cardId(c)} card={c} size="md" />
              ))
            ) : trick.length === 0 ? (
              <p className="text-xs text-[var(--mute)]">{t("game.openTable")}</p>
            ) : null}
          </div>
        </div>
        <p className="felt-combo mt-1 w-full shrink-0 text-center text-[11px] uppercase tracking-[0.16em] text-[var(--gold-dim)]">
          {room.status !== "finished" && room.pileType
            ? t(comboKey(room.pileType))
            : "\u00a0"}
        </p>
      </div>

      <div
        ref={bindSeat(playerId)}
        className={[
          "dock-lock relative rounded-t-[1.6rem] border-t bg-[rgba(8,14,12,0.94)] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          isMyTurn && room.status === "playing"
            ? "turn-dock border-[var(--gold)]"
            : "border-[rgba(212,176,106,0.14)]",
        ].join(" ")}
      >
        {bombFx?.targetPlayerId === playerId && (
          <MushroomCloud size="seat" burstKey={bombKey} />
        )}
        <div className="dock-name relative flex items-center justify-between text-sm">
          <div className="pointer-events-none absolute inset-0 z-10">
            {me && <UnoPlayerMark player={me} fx={fx} youId={playerId} />}
            {fx?.targetPlayerId === playerId && fx.uno === "skip" && (
              <SkipX burstKey={burstKey} />
            )}
            {passId === playerId && <PassWave burstKey={passKey} />}
          </div>
          <span className="min-w-0 truncate text-[var(--ivory)]">
            {me?.name ?? t("game.you")}
            <span className="ml-2 text-[var(--mute)]">{room.hand.length}</span>
            {rules.chips && (
              <span className="ml-2 tabular-nums text-[var(--gold)]">
                {me?.chips ?? 0}
                {(me?.buyIns ?? 0) > 0 ? ` ↻${me?.buyIns}` : ""}
              </span>
            )}
            {rules.fifty && (
              <span className="ml-2 tabular-nums text-[var(--gold)]">
                {me?.fiftyScore ?? 0}
              </span>
            )}
            {room.status === "playing" && me?.finishOrder == null && (
              <span
                className={[
                  "ml-2",
                  me?.satOut ? "round-out" : "round-in",
                ].join(" ")}
              >
                {me?.satOut ? t("game.satOut") : t("game.inRound")}
              </span>
            )}
          </span>
          <button
            type="button"
            className={[
              "min-h-8 shrink-0 px-2 text-xs text-[var(--gold)]",
              selected.length > 0 ? "" : "invisible",
            ].join(" ")}
            disabled={selected.length === 0}
            onClick={() => {
              setSelected([]);
              setJokerFace({});
            }}
          >
            {t("game.clear")}
          </button>
        </div>

        <Hand
          cards={room.hand}
          selected={selected}
          onToggle={toggle}
          disabled={!isMyTurn || busy}
        />

        {selectedJokers.length > 0 && (
          <div className="absolute inset-x-2 bottom-full z-30 mb-1 max-h-[38vh] space-y-2 overflow-y-auto rounded-2xl border border-[rgba(212,176,106,0.22)] bg-[rgba(8,14,12,0.96)] p-2 shadow-[0_-12px_28px_rgba(0,0,0,0.45)]">
            {selectedJokers.map((joker, i) => {
              const id = cardId(joker);
              const face = jokerFace[id];
              return (
                <div
                  key={id}
                  className="rounded-xl bg-black/25 px-2 py-2"
                >
                  <p className="mb-1.5 text-[11px] text-[var(--gold)]">
                    {t("game.jokerAs")}
                    {selectedJokers.length > 1 ? ` ${i + 1}` : ""}
                    {face ? ` · ${formatCard({ ...joker, as: face })}` : ""}
                  </p>
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {WILD_RANKS.map((rank) => (
                      <button
                        key={rank}
                        type="button"
                        className={[
                          "min-h-8 min-w-8 rounded-lg text-xs font-semibold",
                          face?.rank === rank
                            ? "bg-[var(--gold)] text-[#1a1408]"
                            : "bg-black/30 text-[var(--ivory)]",
                        ].join(" ")}
                        onClick={() =>
                          setJokerFace((prev) => ({
                            ...prev,
                            [id]: { rank, suit: prev[id]?.suit ?? "S" },
                          }))
                        }
                      >
                        {rank}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {SUITS.map((suit) => (
                      <button
                        key={suit}
                        type="button"
                        className={[
                          "min-h-8 min-w-8 rounded-lg text-sm",
                          face?.suit === suit
                            ? "bg-[var(--gold)] text-[#1a1408]"
                            : "bg-black/30 text-[var(--ivory)]",
                        ].join(" ")}
                        onClick={() =>
                          setJokerFace((prev) => ({
                            ...prev,
                            [id]: { rank: prev[id]?.rank ?? "3", suit },
                          }))
                        }
                      >
                        {suit === "S"
                          ? "♠"
                          : suit === "C"
                            ? "♣"
                            : suit === "D"
                              ? "♦"
                              : "♥"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="pointer-events-none absolute inset-x-3 bottom-[4.35rem] z-20 rounded-lg bg-[rgba(196,30,58,0.92)] px-3 py-1.5 text-center text-sm text-[#f0b4bd]">
            {te(error)}
          </p>
        )}

        <div className="mt-2 flex h-12 shrink-0 gap-2">
          <button
            type="button"
            disabled={!canPlay || busy}
            onClick={() => {
              void onPlay(selectedCards).then(() => {
                setSelected([]);
                setJokerFace({});
              });
            }}
            className="btn-gold min-w-0 flex-1 touch-manipulation truncate whitespace-nowrap px-2"
          >
            {t("game.play")}
            {combo
              ? ` · ${t(comboKey(combo.type))}${combo.uno ? ` + ${t(comboKey(combo.uno))}` : ""}`
              : ""}
          </button>
          <button
            type="button"
            disabled={!canPass || busy}
            onClick={() => {
              void onPass().then(() => setSelected([]));
            }}
            className="btn-ghost flex-1 touch-manipulation"
          >
            {t("game.pass")}
          </button>
        </div>
      </div>

      {room.status === "finished" && (
        <ResultModal
          room={room}
          playerId={playerId}
          onRematch={onRematch}
          onBuyIn={onBuyIn}
          onMenu={onMenu}
          busy={busy}
          rematchLabel={rematchLabel}
          rematchHint={rematchHint}
          menuLabel={menuLabel}
        />
      )}
    </div>
  );
}
