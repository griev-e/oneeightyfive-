"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckDraw } from "@/components/ui/check-draw";
import { springs } from "@/lib/motion";

/**
 * The one celebration in the app — fired the first time the day crosses its
 * surplus target, exactly once per app-day. The guard is persisted so a reload
 * (or crossing while the app was closed) doesn't re-fire it, and a new app-day
 * naturally arms it again.
 *
 * It renders through a body portal because the crossing usually happens on the
 * Food tab while this (Today) panel is inert/hidden — a fixed child of a
 * `visibility:hidden` ancestor would never show. Under reduced motion it
 * degrades to a plain static confirmation. It celebrates, it never scolds.
 */
const key = (date: string) => `surplus:celebrated:${date}`;

export function SurplusCelebration({
  hit,
  date,
  streakCount,
}: {
  hit: boolean;
  date: string;
  streakCount: number;
}) {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  // guards a single fire per app-day even across re-renders; re-arms on rollover
  const firedForDate = useRef<string | null>(null);

  useEffect(() => {
    if (!hit || firedForDate.current === date) return;

    let already = false;
    try {
      already = window.localStorage.getItem(key(date)) === "1";
    } catch {
      already = false;
    }
    if (already) {
      firedForDate.current = date;
      return;
    }
    try {
      window.localStorage.setItem(key(date), "1");
    } catch {
      /* private mode — celebrate this session, just don't persist */
    }

    firedForDate.current = date;
    // defer out of the effect body (next frame) so the crossing reads as a
    // beat after the number lands, and to keep the update off the commit path
    const raf = requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShow(false), 2620);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [hit, date]);

  // Rendered only client-side (ClientGate), so document.body is always present.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          aria-label="Dismiss"
          onClick={() => setShow(false)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-canvas/70 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <motion.div
            className="relative flex items-center justify-center"
            initial={reduced ? false : { scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={reduced ? { duration: 0 } : springs.gentle}
          >
            <span
              className="absolute size-40 rounded-full"
              style={{ backgroundColor: "var(--color-accent-tint)" }}
            />
            <CheckDraw checked size={88} />
          </motion.div>

          <motion.div
            className="flex flex-col items-center gap-1.5 text-center"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced ? { duration: 0 } : { ...springs.default, delay: 0.08 }
            }
          >
            <span className="type-title text-accent">Surplus hit</span>
            <span className="type-footnote text-text-secondary">
              {streakCount > 0
                ? `${streakCount}-day streak — keep it lit.`
                : "The streak starts today."}
            </span>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body,
  );
}
