"use client";

import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/**
 * Every motion root wears this: LazyMotion keeps the full animation renderer
 * out of the main bundle (components use `m.` — `strict` throws on any stray
 * full `motion.` import), and MotionConfig honors the OS reduce-motion
 * setting app-wide.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
