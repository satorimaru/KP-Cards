"use client";

import { useEffect, useRef } from "react";
import { playSfx, type SfxName } from "@/lib/sfx";
import { useApp } from "./AppProviders";

/** Play `name` when `signature` changes, skipping the first observation. */
export function useSfxWatch(signature: string, name: SfxName | null): void {
  const { sound } = useApp();
  const seen = useRef(false);
  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      return;
    }
    if (sound && name && signature) playSfx(name, signature);
  }, [signature, name, sound]);
}
