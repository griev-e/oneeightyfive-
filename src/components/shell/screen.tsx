"use client";

import { cn } from "@/lib/cn";

/**
 * Per-tab layout: a scroll container (all scrolling happens here — the page
 * itself never scrolls) plus an optional pinned footer for the screen's one
 * primary action. Gutters respect landscape safe areas.
 */
export function Screen({
  label,
  title,
  trailing,
  children,
  footer,
  className,
}: {
  /** micro-caps context line above the title (e.g. the date) */
  label?: string;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  /** pinned above the tab bar — the screen's primary action */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-screen",
          footer ? "pb-6" : "pb-tab-clearance",
          "pt-[calc(env(safe-area-inset-top)+20px)]",
          className,
        )}
      >
        <header className="mx-auto mb-5 flex max-w-2xl items-end justify-between">
          <div>
            {label && (
              <div className="type-label mb-1 text-text-tertiary">{label}</div>
            )}
            <h1 className="type-title">{title}</h1>
          </div>
          {trailing}
        </header>
        <div className="mx-auto max-w-2xl">{children}</div>
      </div>
      {footer && (
        <div className="px-screen pb-tab-clearance pt-2">
          <div className="mx-auto max-w-2xl lg:max-w-105">{footer}</div>
        </div>
      )}
    </div>
  );
}
