"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MessageKey } from "@/lib/i18n";
import { ScreenShell } from "../ScreenShell";
import { useApp } from "../AppProviders";

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: "speed.tut1Title", body: "speed.tut1Body" },
  { title: "speed.tut2Title", body: "speed.tut2Body" },
  { title: "speed.tut3Title", body: "speed.tut3Body" },
  { title: "speed.tut4Title", body: "speed.tut4Body" },
  { title: "speed.tut5Title", body: "speed.tut5Body" },
  { title: "speed.tut6Title", body: "speed.tut6Body" },
  { title: "speed.tut7Title", body: "speed.tut7Body" },
  { title: "speed.tut8Title", body: "speed.tut8Body" },
];

export function SpeedTutorial() {
  const router = useRouter();
  const { t } = useApp();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <ScreenShell backHref="/speed" backLabel={t("speed.title")}>
      <header className="mb-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold)]">
          {t("speed.tutorial")}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.4rem] leading-none tracking-tight">
          {t("speed.title")}
        </h1>
      </header>

      <section className="glass-panel rounded-[1.75rem] p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--gold-dim)]">
          {t("speed.tutStep", { n: step + 1, max: STEPS.length })}
        </p>
        <div className="mt-3 mb-5 flex gap-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={[
                "h-1 flex-1 rounded-full",
                i <= step ? "bg-[var(--gold)]" : "bg-black/30",
              ].join(" ")}
            />
          ))}
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[1.85rem] leading-none">
          {t(current.title)}
        </h2>
        <p className="mt-4 min-h-[8.5rem] text-sm leading-relaxed text-[var(--ivory)]">
          {t(current.body)}
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((n) => Math.max(0, n - 1))}
            className="btn-ghost flex-1"
          >
            {t("speed.tutBack")}
          </button>
          {last ? (
            <button
              type="button"
              onClick={() => router.push("/speed")}
              className="btn-gold flex-1"
            >
              {t("speed.tutDone")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}
              className="btn-gold flex-1"
            >
              {t("speed.tutNext")}
            </button>
          )}
        </div>
      </section>

      <p className="mt-4 text-center">
        <Link href="/speed" className="text-xs text-[var(--mute)]">
          {t("nav.home")}
        </Link>
      </p>
    </ScreenShell>
  );
}
