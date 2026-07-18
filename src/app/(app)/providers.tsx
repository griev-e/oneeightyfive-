"use client";

import { useState, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { ToastProvider } from "@/components/ui/toast";

const noopSubscribe = () => () => {};

/**
 * The app renders client-side only: numbers derive from the device's local
 * date, and a server render (UTC on Vercel) would hydrate-mismatch any US
 * evening. The SSR shell is the bare canvas — visually identical to the PWA
 * splash, so the gate is imperceptible.
 */
function ClientGate({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return mounted ? children : null;
}

/** Query cache persists to IndexedDB so a cold PWA launch paints instantly. */
const CACHE_BUSTER = "v2";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: {
        getItem: (key: string) => get(key).then((v) => v ?? null),
        setItem: (key: string, value: string) => set(key, value),
        removeItem: (key: string) => del(key),
      },
    }),
  );

  return (
    <MotionConfig reducedMotion="user">
      <ClientGate>
        <PersistQueryClientProvider
          client={client}
          persistOptions={{
            persister,
            maxAge: 30 * 24 * 3_600_000,
            buster: CACHE_BUSTER,
          }}
        >
          <ToastProvider>{children}</ToastProvider>
        </PersistQueryClientProvider>
      </ClientGate>
    </MotionConfig>
  );
}
