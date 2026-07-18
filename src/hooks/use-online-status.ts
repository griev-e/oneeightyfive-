"use client";

import { useSyncExternalStore } from "react";

/**
 * Live connectivity via the browser's online/offline events. Uses
 * useSyncExternalStore so there's no setState-in-effect churn; the server
 * snapshot is optimistic (online) so the SSR shell never flashes offline.
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
