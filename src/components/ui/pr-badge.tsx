"use client";

import { m } from "motion/react";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Gold "PR" pill that springs in beside a record-setting set. */
export function PRBadge({
  label = "PR",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <m.span
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springs.gentle}
      className={cn(
        "type-label inline-flex items-center rounded-full px-2 py-1",
        "border border-pr/30 bg-pr-tint text-pr",
        className,
      )}
    >
      {label}
    </m.span>
  );
}
