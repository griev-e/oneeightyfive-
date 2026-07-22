"use client";

import { useId } from "react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { springs } from "@/lib/motion";

/** iOS-style segmented control with a sliding thumb (layout animation). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      className="flex rounded-[10px] border border-border-subtle bg-raised p-0.5"
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "type-footnote relative h-8 flex-1 font-medium",
              // hit slop: the pill stays visually compact but the tappable
              // region meets the 44px touch minimum
              "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
              "transition-colors duration-150",
              isActive ? "text-text-primary" : "text-text-tertiary",
            )}
          >
            {isActive && (
              <m.span
                layoutId={layoutId}
                transition={springs.snappy}
                className="absolute inset-0 rounded-lg border border-border-default bg-overlay"
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
