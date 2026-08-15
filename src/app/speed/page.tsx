"use client";

import { useApp } from "@/components/AppProviders";
import { LangToggle } from "@/components/LangToggle";
import { ScreenShell } from "@/components/ScreenShell";

export default function SpeedPlaceholderPage() {
  const { t } = useApp();

  return (
    <ScreenShell
      backHref="/"
      backLabel={t("nav.games")}
      trailing={<LangToggle />}
    >
      <header className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold)]">
          {t("speed.tagline")}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.75rem] leading-none tracking-tight">
          {t("speed.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--mute)]">
          {t("speed.blurb")}
        </p>
      </header>

      <section className="glass-panel rounded-[1.75rem] p-5">
        <div className="table-felt relative mb-5 flex min-h-[11rem] items-center justify-center overflow-hidden rounded-[1.35rem]">
          <span
            className="card-back absolute left-[28%] h-[5.4rem] w-[3.7rem] -rotate-[18deg] rounded-[0.55rem] border border-[#3a0d16]"
            aria-hidden
          />
          <span
            className="card-back absolute right-[28%] h-[5.4rem] w-[3.7rem] rotate-[16deg] rounded-[0.55rem] border border-[#3a0d16]"
            aria-hidden
          />
          <span className="relative z-10 rounded-full bg-black/45 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]">
            {t("app.soon")}
          </span>
        </div>
        <p className="text-center text-sm text-[var(--mute)]">{t("speed.hold")}</p>
        <button type="button" disabled className="btn-gold mt-5 w-full">
          {t("home.create")}
        </button>
        <button type="button" disabled className="btn-ghost mt-2 w-full">
          {t("home.join")}
        </button>
      </section>
    </ScreenShell>
  );
}
