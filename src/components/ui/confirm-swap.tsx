"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Button } from "./button";
import { press, springs } from "@/lib/motion";

/**
 * The app's one destructive pattern: a ghost trigger that swaps in place to
 * Cancel + a destructive-tinted confirm. Muted red appears here and nowhere
 * else. Never a first-tap surface.
 */
export function ConfirmSwap({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <AnimatePresence mode="wait" initial={false}>
      {confirming ? (
        <m.div
          key="confirm"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.snappy}
          className="flex gap-2"
        >
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <m.button
            type="button"
            whileTap={{ scale: press.button }}
            transition={springs.instant}
            onClick={onConfirm}
            className="type-headline h-13 flex-1 rounded-lg border border-destructive-border bg-destructive-tint text-destructive"
          >
            {confirmLabel}
          </m.button>
        </m.div>
      ) : (
        <m.div
          key="trigger"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.snappy}
        >
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setConfirming(true)}
          >
            {label}
          </Button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
