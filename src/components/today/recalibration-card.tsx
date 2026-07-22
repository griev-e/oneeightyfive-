"use client";

import { AnimatePresence, m } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useApplyRecalibration,
  useDismissRecalibration,
  useRecalibration,
  type Recalibration,
} from "@/hooks/use-recalibration";
import { formatInt } from "@/lib/format";
import { fadeRise, fades, springs } from "@/lib/motion";

/**
 * "Your real TDEE looks like X — apply?" The app's one recalibration nudge.
 * It never scolds: an upward retarget means eat more to stay on pace, a
 * downward one only ever appears when the trend is already ahead of plan.
 * Numbers are server-computed; both actions quiet the card for the cooldown.
 */
export function RecalibrationCard() {
  const { data } = useRecalibration();
  const apply = useApplyRecalibration();
  const dismiss = useDismissRecalibration();

  const ready: Extract<Recalibration, { status: "ready" }> | null =
    data && data.status === "ready" ? data : null;
  const busy = apply.isPending || dismiss.isPending;

  return (
    <AnimatePresence>
      {ready && (
        <m.div
          initial={fadeRise.hidden}
          animate={fadeRise.visible}
          exit={{ opacity: 0, transition: fades.crossfade }}
          transition={springs.default}
        >
          <Card className="mt-6">
            <div className="type-label text-text-tertiary">Recalibration</div>
            <p className="type-headline mt-1.5">
              Your real TDEE looks like ~{formatInt(ready.observedTdee)} cal
            </p>
            <p className="type-footnote mt-1.5 text-text-secondary">
              {ready.direction === "up"
                ? "Your logs and weight trend say you can eat more to stay on pace."
                : "You're gaining ahead of plan — a smaller surplus keeps it lean."}{" "}
              Target moves {formatInt(ready.currentTarget)} →{" "}
              <span className="tabular-nums text-text-primary">
                {formatInt(ready.suggestedTarget)}
              </span>{" "}
              cal.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => apply.mutate()}
              >
                Apply
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={busy}
                onClick={() => dismiss.mutate()}
              >
                Not now
              </Button>
            </div>
          </Card>
        </m.div>
      )}
    </AnimatePresence>
  );
}
