import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true once React is in control.
 *
 * Controls that only work through JavaScript (add to bag, place order) stay
 * disabled until then. Otherwise a click on a slow connection is silently
 * lost — or worse, a form submits natively and puts personal data in the URL.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
