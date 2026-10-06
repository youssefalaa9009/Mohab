type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: EventData) => void };
  }
}

/**
 * Record a custom event. A no-op on the server, when analytics isn't
 * configured, while the script is still loading, or when it is blocked —
 * analytics must never break the shop. Never pass personal data here.
 */
export function track(event: string, data?: EventData) {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, data);
  } catch {
    // Ignore: a failing analytics call is not the visitor's problem.
  }
}
