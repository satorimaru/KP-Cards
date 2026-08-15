import { useEffect, useSyncExternalStore } from "react";

/** True only after hydration, so localStorage / window reads stay SSR-safe. */
export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Keep the page padded by the on-screen keyboard so focused fields stay visible. */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", `${covered}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--kb");
    };
  }, []);
}

/** Scroll a focused input into the visual viewport after the keyboard opens. */
export function revealField(el: HTMLElement): void {
  const run = () => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  };
  run();
  window.setTimeout(run, 80);
  window.setTimeout(run, 320);
}
