"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

/**
 * All entry flows are bottom sheets. Vaul provides the native drag physics
 * (velocity dismissal, rubber-band, keyboard avoidance). Level-2 elevation:
 * overlay tint + default border + the app's ONLY shadow. Stays a bottom
 * sheet at every breakpoint — centered with a max width on iPad.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** always required for a11y; visually hidden by default */
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] outline-none",
            "rounded-t-sheet border-t border-border-default bg-overlay",
            "shadow-[0_-8px_40px_rgba(0,0,0,0.4)]",
            "pb-[max(env(safe-area-inset-bottom),16px)]",
            contentClassName,
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-3 h-[5px] w-9 rounded-full bg-border-strong"
          />
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
