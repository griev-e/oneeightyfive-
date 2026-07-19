"use client";

import { useState, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker";
import {
  registerMutationDefaults,
  shouldPersistMutation,
} from "@/lib/mutation-defaults";

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

/** Query cache persists to IndexedDB so a cold PWA launch paints instantly.
 *  v4: day-summaries grew liftDays; persisted log-set variables carry rpe/note. */
const CACHE_BUSTER = "v4";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60_000,
          retry: 1,
          refetchOnWindowFocus: true,
        },
        // offline → pause (and persist, for the queued keys), never fail
        mutations: { networkMode: "online" },
      },
    });
    registerMutationDefaults(qc);
    return qc;
  });
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
            dehydrateOptions: { shouldDehydrateMutation: shouldPersistMutation },
          }}
          onSuccess={() => {
            // replay writes queued before the last close (gym Wi-Fi survivors)
            void client.resumePausedMutations();
          }}
        >
          <ToastProvider>{children}</ToastProvider>
          <ServiceWorkerRegister />
        </PersistQueryClientProvider>
      </ClientGate>
    </MotionConfig>
  );
}
