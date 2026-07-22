"use client";

import { m, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { springs, press } from "@/lib/motion";

/**
 * 56px-minimum list row: primary text left, tabular value right.
 * Parents draw separators with divide-y divide-border-subtle.
 */
export function ListRow({
  title,
  subtitle,
  trailing,
  className,
  ...props
}: HTMLMotionProps<"button"> & {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: press.row }}
      transition={springs.instant}
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-3 px-1 py-2",
        "text-left active:bg-overlay/50",
        className,
      )}
      {...props}
    >
      <span className="min-w-0">
        <span className="type-body block truncate text-text-primary">
          {title}
        </span>
        {subtitle && (
          <span className="type-footnote block text-text-tertiary">
            {subtitle}
          </span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </m.button>
  );
}
