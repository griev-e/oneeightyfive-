"use client";

import { useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { NumberPad } from "@/components/ui/number-pad";
import { cn } from "@/lib/cn";

const PIN_LENGTH = 4;

/** The Surplus mark — a rounded mint plus. */
function PlusMark({ size = 44 }: { size?: number }) {
  const bar = size * 0.26;
  const r = bar / 2;
  const c = size / 2;
  return (
    <svg width={size} height={size} aria-hidden>
      <rect
        x={c - bar / 2}
        y={0}
        width={bar}
        height={size}
        rx={r}
        fill="var(--color-accent)"
      />
      <rect
        x={0}
        y={c - bar / 2}
        width={size}
        height={bar}
        rx={r}
        fill="var(--color-accent)"
      />
    </svg>
  );
}

export default function LockPage() {
  const [digits, setDigits] = useState("");
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(0);
  const busy = useRef(false);

  const submit = async (pin: string) => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        // full navigation so the middleware sees the fresh cookie
        window.location.replace("/");
        return;
      }
    } catch {
      // fall through to the shake
    }
    setShake((s) => s + 1);
    setDigits("");
    setChecking(false);
    busy.current = false;
  };

  const handleKey = (k: string) => {
    if (busy.current) return;
    if (k === "del") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (k === ".") return;
    setDigits((d) => {
      if (d.length >= PIN_LENGTH) return d;
      const next = d + k;
      if (next.length === PIN_LENGTH) void submit(next);
      return next;
    });
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="fixed inset-0 flex flex-col items-center bg-canvas">
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <PlusMark />
          <div className="flex flex-col items-center gap-5">
            <span className="type-label text-text-tertiary">Enter PIN</span>
            <motion.div
              key={shake}
              animate={
                shake > 0 ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }
              }
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="flex gap-4"
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-3.5 rounded-full border transition-colors duration-150",
                    i < digits.length
                      ? "border-text-primary bg-text-primary"
                      : "border-border-strong bg-transparent",
                    checking && "opacity-60",
                  )}
                />
              ))}
            </motion.div>
          </div>
        </div>
        <div className="w-full max-w-90 pb-[max(env(safe-area-inset-bottom),24px)]">
          <NumberPad onKey={handleKey} />
        </div>
      </main>
    </MotionConfig>
  );
}
