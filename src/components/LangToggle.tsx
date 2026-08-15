"use client";

import { useApp } from "./AppProviders";

export function LangToggle() {
  const { locale, setLocale } = useApp();

  return (
    <div className="inline-flex rounded-full bg-black/30 p-0.5">
      {(["en", "vi"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={[
            "min-h-8 min-w-10 rounded-full px-2.5 text-[11px] font-semibold tracking-wide",
            locale === code
              ? "bg-[var(--gold)] text-[#1a1408]"
              : "text-[var(--mute)]",
          ].join(" ")}
        >
          {code === "en" ? "EN" : "VI"}
        </button>
      ))}
    </div>
  );
}
