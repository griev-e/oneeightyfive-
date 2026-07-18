"use client";

import { useEffect } from "react";

/**
 * Sizes the shell to the true screen height on iOS standalone (home-screen) PWAs.
 *
 * iOS mis-reports every CSS viewport unit AND window.innerHeight in standalone
 * mode — measured on-device, 100dvh resolves ~758pt against an 874pt screen — so
 * the fixed shell falls short and its overflow:hidden clips the bottom of the tab
 * bar. In a full-bleed standalone PWA the content covers the PHYSICAL display, so
 * window.screen.* (already in CSS points) is the reliable target. We publish it
 * as --app-height; app-shell reads `var(--app-height, 100vh)`.
 *
 * Only overrides in standalone mode — in a normal browser tab screen.* is the
 * whole monitor, so there we set innerHeight (matching 100vh). An inline <head>
 * script would run before paint, but React drops those from the RSC-rendered
 * document, so this runs as an effect; the 100vh fallback covers the first frame.
 */
export function AppHeight() {
  useEffect(() => {
    const set = () => {
      const standalone =
        (navigator as unknown as { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches;
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      const value = standalone
        ? portrait
          ? Math.max(screen.width, screen.height)
          : Math.min(screen.width, screen.height)
        : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${value}px`);
    };
    set();
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", set);
    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("orientationchange", set);
    };
  }, []);

  return null;
}
