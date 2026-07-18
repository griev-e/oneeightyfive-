"use client";

import { useEffect } from "react";

/**
 * Publishes the live PAINTABLE viewport height as --app-height (app-shell reads
 * `var(--app-height, 100vh)`).
 *
 * Why innerHeight and never window.screen.*: iOS standalone (home-screen) PWAs
 * refuse to paint below their viewport line even when a fixed box extends
 * further — sizing the shell to the physical screen laid the tab bar out
 * "correctly" but its bottom half was simply never rendered. The viewport
 * itself is the paintable region, so the shell must track it exactly. The
 * cold-start letterbox bug is fixed at the CSS root (html/body height:100vh —
 * see globals.css); once the viewport initializes full-screen, innerHeight IS
 * the physical height. If iOS still letterboxes, the tab bar sits at the
 * paintable bottom, fully visible, which is the best any code can do.
 *
 * Listens to visualViewport when present — iOS updates it more reliably than
 * window resize when the standalone viewport changes (e.g. after rotation).
 */
export function AppHeight() {
  useEffect(() => {
    const set = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`,
      );
    };
    set();
    const vv = window.visualViewport;
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", set);
    vv?.addEventListener("resize", set);
    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("orientationchange", set);
      vv?.removeEventListener("resize", set);
    };
  }, []);

  return null;
}
