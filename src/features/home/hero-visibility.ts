import { useSyncExternalStore } from "react";

/**
 * Whether the homepage hero wordmark is on screen. While it is, the header
 * hides its own wordmark so "QUATTRO" never appears twice; as the hero scrolls
 * away the header logo takes over.
 *
 * Defaults to true (visible) on both server and client, so the server-rendered
 * homepage already omits the header logo — no flash on load.
 */
let wordmarkVisible = true;
const listeners = new Set<() => void>();

export function setHeroWordmarkVisible(visible: boolean) {
  if (visible === wordmarkVisible) return;
  wordmarkVisible = visible;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHeroWordmarkVisible() {
  return useSyncExternalStore(
    subscribe,
    () => wordmarkVisible,
    () => true,
  );
}
