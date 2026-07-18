"use client";

import { useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import { MockProvider } from "@/lib/mock";
import { ToastProvider } from "@/components/ui/toast";

const noopSubscribe = () => () => {};

/**
 * The app renders client-side only: every number derives from the device's
 * local date, and a server render (UTC on Vercel) would hydrate-mismatch any
 * US evening. The SSR shell is the bare canvas — visually identical to the
 * PWA splash, so the gate is imperceptible.
 */
function ClientGate({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return mounted ? children : null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ClientGate>
        <MockProvider>
          <ToastProvider>{children}</ToastProvider>
        </MockProvider>
      </ClientGate>
    </MotionConfig>
  );
}
