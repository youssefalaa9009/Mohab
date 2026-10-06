import { lazy, useEffect, type ComponentType } from "react";

/**
 * A component kept out of the first page load (search overlay, cart drawer):
 * `Component` is a React.lazy wrapper to mount on first open, and `usePrefetch`
 * starts downloading it once the browser is idle, so opening still feels instant.
 */
// Same constraint as React.lazy: any component type, props inferred from it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyOnDemand<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  let started: Promise<{ default: T }> | null = null;
  const prefetch = () => (started ??= load());
  const Component = lazy(prefetch);

  function usePrefetch() {
    useEffect(() => {
      const idle = window.requestIdleCallback ?? ((callback) => window.setTimeout(callback, 1500));
      const cancel = window.cancelIdleCallback ?? window.clearTimeout;
      const handle = idle(() => void prefetch());
      return () => cancel(handle);
    }, []);
  }

  return { Component, prefetch, usePrefetch };
}
