"use client";

import { motion } from "motion/react";
import { Delete } from "lucide-react";
import { springs } from "@/lib/motion";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

/** Custom decimal pad — the system keyboard never appears for numeric entry. */
export function NumberPad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 px-4">
      {KEYS.map((k) => (
        <motion.button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          whileTap={{ scale: 0.95, backgroundColor: "var(--color-raised)" }}
          transition={springs.instant}
          aria-label={k === "del" ? "Delete" : k}
          className="type-title tabular-nums flex h-14 items-center justify-center rounded-md text-text-primary"
        >
          {k === "del" ? <Delete size={24} strokeWidth={1.75} /> : k}
        </motion.button>
      ))}
    </div>
  );
}
