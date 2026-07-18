"use client";

import { useEffect, useState } from "react";
import { getAppDate } from "@/lib/dates";

/**
 * The app-day (3 AM rollover) as live state — a PWA that never remounts
 * must notice midnight passing. Re-checks on focus/visibility and once a
 * minute while open.
 */
export function useAppDate(): string {
  const [date, setDate] = useState(() => getAppDate());
  useEffect(() => {
    const check = () => {
      const now = getAppDate();
      setDate((prev) => (prev === now ? prev : now));
    };
    const interval = setInterval(check, 60_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return date;
}
