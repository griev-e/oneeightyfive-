"use client";

import { useEffect } from "react";

/**
 * Registers the gym-connectivity service worker. Production only — a SW in dev
 * fights Next's HMR and would serve stale bundles. Registration waits for load
 * so it never competes with first paint.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
