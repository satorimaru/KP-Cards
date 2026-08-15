"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CHAT_TEXT, type ChatMessage } from "@/lib/rooms/types";
import { useApp } from "./AppProviders";

interface ChatSheetProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  playerId: string;
  onSend: (text: string) => Promise<void>;
  busy?: boolean;
}

interface ChatButtonProps {
  unread?: number;
  onClick: () => void;
  className?: string;
}

export function ChatButton({
  unread = 0,
  onClick,
  className,
}: ChatButtonProps) {
  const { t } = useApp();
  return (
    <button type="button" onClick={onClick} className={className}>
      {t("nav.chat")}
      {unread > 0 && (
        <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#1a1408]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

export function ChatSheet({
  open,
  onClose,
  messages,
  playerId,
  onSend,
  busy,
}: ChatSheetProps) {
  const { t, te } = useApp();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages]);

  if (!open) return null;

  const text = draft.trim();
  const canSend = text.length > 0 && !busy;

  const submit = async () => {
    if (!canSend) return;
    setError(null);
    try {
      await onSend(text);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : t("err.requestFailed"));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("chat.close")}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("chat.title")}
        className="glass-panel relative z-10 flex max-h-[62dvh] flex-col rounded-t-3xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[rgba(244,234,216,0.18)]" />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--gold-dim)]">
              {t("chat.title")}
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ivory)]">
              {t("chat.heading")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full px-3 text-sm text-[var(--mute)]"
          >
            {t("nav.close")}
          </button>
        </div>

        <div
          ref={listRef}
          className="flex min-h-36 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-[rgba(244,234,216,0.08)] bg-black/20 px-3 py-3"
        >
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <p className="text-sm text-[var(--ivory)]">{t("chat.quiet")}</p>
              <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[var(--mute)]">
                {t("chat.quietHint")}
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.playerId === playerId;
              return (
                <div
                  key={m.id}
                  className={mine ? "ml-8 self-end" : "mr-8 self-start"}
                >
                  <p
                    className={[
                      "mb-0.5 text-[11px]",
                      mine
                        ? "text-right text-[var(--gold-dim)]"
                        : "text-[var(--mute)]",
                    ].join(" ")}
                  >
                    {mine ? t("game.you") : m.name}
                  </p>
                  <p
                    className={[
                      "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug",
                      mine
                        ? "bg-[rgba(212,176,106,0.18)] text-[var(--ivory)]"
                        : "bg-black/35 text-[var(--ivory)]",
                    ].join(" ")}
                  >
                    {m.text}
                  </p>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <p className="mt-2 text-center text-xs text-[#f0b4bd]">{error}</p>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            maxLength={MAX_CHAT_TEXT}
            placeholder={t("chat.placeholder")}
            enterKeyHint="send"
            autoComplete="off"
            className="field flex-1"
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="btn-gold px-4"
          >
            {t("chat.send")}
          </button>
        </form>
        {draft.length > 120 && (
          <p className="mt-1 text-right text-[11px] text-[var(--mute)]">
            {draft.length}/{MAX_CHAT_TEXT}
          </p>
        )}
      </section>
    </div>
  );
}
