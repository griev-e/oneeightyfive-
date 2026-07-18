import { cn } from "@/lib/cn";

/**
 * Static raised-tint blocks. Deliberately not animated — a shimmer is a
 * spinner in disguise, and no spinners exist in this app.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-raised", className)} />;
}
