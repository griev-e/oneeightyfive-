"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { springs } from "@/lib/motion";

/**
 * A calm, transient pill when the device drops offline. Reads still work from
 * the persisted query cache and set logging keeps its optimistic retries — this
 * just sets expectations, it never blocks or scolds. App-wide, so it lives in
 * the shell above the (inert) panels.
 */
export function OfflineIndicator() {
  const online = useOnlineStatus();
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center pt-[calc(env(safe-area-inset-top)+8px)]">
      <AnimatePresence>
        {!online && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduced ? { duration: 0 } : springs.default}
            className="flex items-center gap-2 rounded-full border border-border-default bg-overlay px-3.5 py-1.5"
          >
            <WifiOff size={13} strokeWidth={2} className="text-text-tertiary" />
            <span className="type-footnote text-text-secondary">
              You&apos;re offline
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
