"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

/**
 * Registers the gym-connectivity service worker. Production only — a SW in dev
 * fights Next's HMR and would serve stale bundles. Registration waits for load
 * so it never competes with first paint.
 */
export function ServiceWorkerRegister() {
  const toast = useToast();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // iOS evicts IndexedDB after ~a week of disuse — and that store holds
    // the offline write queue. Best-effort pin; denial is fine.
    void navigator.storage?.persist?.().catch(() => {});

    // The stamped SW skipWaiting()s on every deploy, so this page keeps
    // running the previous JS bundle until a full reload. Offer one quietly
    // instead of leaving the user on stale code until the next relaunch.
    let hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true; // first install, nothing stale yet
        return;
      }
      toast.show("Surplus updated", {
        label: "Reload",
        onPress: () => window.location.reload(),
      });
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      window.removeEventListener("load", register);
    };
  }, [toast]);

  return null;
}
