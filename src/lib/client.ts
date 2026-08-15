import { useSyncExternalStore } from "react";

/** True only after hydration, so localStorage / window reads stay SSR-safe. */
export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
