"use client";

import { m } from "motion/react";
import { Delete } from "lucide-react";
import { press, springs } from "@/lib/motion";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

/** Custom decimal pad — the system keyboard never appears for numeric entry. */
export function NumberPad({
  onKey,
  decimal = true,
}: {
  onKey: (key: string) => void;
  decimal?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-1 px-4"
      style={{ touchAction: "manipulation" }}
    >
      {KEYS.map((k) => {
        if (k === "." && !decimal) {
          // integers only: no dead keys, just an empty cell
          return <span key={k} aria-hidden className="h-14" />;
        }
        return (
          <m.button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            // scale only — an animated backgroundColor is not a transform, so
            // it would survive reduced-motion; active: handles the tint
            whileTap={{ scale: press.button }}
            transition={springs.instant}
            aria-label={k === "del" ? "Delete" : k}
            className="type-title tabular-nums flex h-14 items-center justify-center rounded-md text-text-primary active:bg-raised"
          >
            {k === "del" ? <Delete size={24} strokeWidth={1.75} /> : k}
          </m.button>
        );
      })}
    </div>
  );
}
