"use client";

import { m, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { springs, press } from "@/lib/motion";

/** Level-1 elevation: raised tint + subtle border. No shadows, ever. */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-subtle bg-raised p-4",
        className,
      )}
      {...props}
    />
  );
}

/** A card that is a button — presses down 2% and tints toward overlay. */
export function PressableCard({
  className,
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: press.row }}
      transition={springs.instant}
      className={cn(
        "block w-full rounded-2xl border border-border-subtle bg-raised p-4",
        "text-left active:bg-overlay",
        className,
      )}
      {...props}
    />
  );
}
