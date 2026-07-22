"use client";

import { m, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { springs, press } from "@/lib/motion";

export function IconButton({
  className,
  "aria-label": ariaLabel,
  ...props
}: HTMLMotionProps<"button"> & { "aria-label": string }) {
  return (
    <m.button
      type="button"
      aria-label={ariaLabel}
      whileTap={{ scale: press.icon }}
      transition={springs.instant}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full",
        "border border-border-subtle bg-raised text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}
