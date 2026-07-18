"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { springs, press } from "@/lib/motion";

const VARIANTS = {
  /** white-on-dark, Vercel-style — the one big action on a screen */
  primary:
    "h-13 bg-text-primary text-canvas type-headline rounded-lg px-6 active:bg-text-primary/90",
  secondary:
    "h-13 bg-raised border border-border-subtle text-text-primary type-headline rounded-lg px-6",
  ghost: "h-11 text-text-secondary type-body px-4 rounded-md",
} as const;

export function Button({
  variant = "primary",
  className,
  ...props
}: HTMLMotionProps<"button"> & { variant?: keyof typeof VARIANTS }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: press.button }}
      transition={springs.instant}
      className={cn(
        "inline-flex items-center justify-center gap-2 disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
