"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LangToggle } from "./LangToggle";

export function ScreenShell({
  children,
  backHref,
  backLabel,
  trailing,
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  trailing?: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:justify-center">
      <div className="mb-4 flex items-center justify-between gap-3">
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="min-h-9 text-xs text-[var(--mute)]"
          >
            {backLabel}
          </Link>
        ) : (
          <LangToggle />
        )}
        {trailing ?? <span />}
      </div>
      {children}
    </main>
  );
}
