"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { springs, press } from "@/lib/motion";
import { TABS, type TabId } from "./tabs";

export function TabBar({
  active,
  onSelect,
}: {
  active: TabId;
  onSelect: (id: TabId) => void;
}) {
  return (
    <nav
      aria-label="Tabs"
      className={cn(
        // iPhone: blurred bottom bar above the safe area
        "z-20 order-last flex shrink-0 border-t border-border-default",
        "bg-[rgb(10_10_11/0.85)] backdrop-blur-[20px]",
        "pb-[env(safe-area-inset-bottom)]",
        "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        // iPad: 80px left rail
        "lg:order-first lg:h-full lg:w-20 lg:flex-col lg:justify-start",
        "lg:gap-2 lg:border-t-0 lg:border-r lg:border-border-subtle lg:pt-[calc(env(safe-area-inset-top)+24px)] lg:pr-0 lg:pb-0",
      )}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            whileTap={{ scale: press.icon }}
            transition={springs.instant}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-tab-bar flex-1 flex-col items-center justify-center gap-0.5",
              "transition-colors duration-150 lg:h-16 lg:flex-none",
              isActive ? "text-text-primary" : "text-text-tertiary",
            )}
          >
            <Icon size={24} strokeWidth={1.75} />
            <span className="text-[10px] leading-3.5 font-semibold tracking-[0.02em]">
              {label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}
