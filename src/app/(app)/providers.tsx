"use client";

import { useState, useSyncExternalStore } from "react";
import { MotionProvider } from "@/components/ui/motion-provider";
import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker";
import {
  registerMutationDefaults,
  salvageQueuedMutations,
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
 *  v5: queries carry clientId-stamped write variables; persistence is now
 *  domain-keys-only. Bumps are safe for the offline queue — restore salvages
 *  queued mutations across busters (salvageQueuedMutations). */
const CACHE_BUSTER = "v5";

/** Only domain data earns a place in IndexedDB — ephemeral catalog searches
 *  and one-shot lookups would otherwise accrete forever and bloat every
 *  throttled re-serialize of the persisted blob. */
const PERSISTED_QUERY_KEYS = new Set([
  "weigh-ins",
  "food-logs",
  "food-suggestions",
  "sets",
  "meals",
  "exercises",
  "exercise-history",
  "day-summaries",
  "settings",
  "profile",
  "plan-events",
]);

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
  const [persister] = useState(() => {
    const base = createAsyncStoragePersister({
      storage: {
        getItem: (key: string) => get(key).then((v) => v ?? null),
        setItem: (key: string, value: string) => set(key, value),
        removeItem: (key: string) => del(key),
      },
    });
    return {
      ...base,
      // a buster mismatch must wipe queries, never the offline write queue
      restoreClient: async () =>
        salvageQueuedMutations(await base.restoreClient(), CACHE_BUSTER),
    };
  });

  return (
    <MotionProvider>
      <ClientGate>
        <PersistQueryClientProvider
          client={client}
          persistOptions={{
            persister,
            maxAge: 30 * 24 * 3_600_000,
            buster: CACHE_BUSTER,
            dehydrateOptions: {
              shouldDehydrateMutation: shouldPersistMutation,
              shouldDehydrateQuery: (query) =>
                defaultShouldDehydrateQuery(query) &&
                typeof query.queryKey[0] === "string" &&
                PERSISTED_QUERY_KEYS.has(query.queryKey[0]),
            },
          }}
          onSuccess={() => {
            // replay writes queued before the last close (gym Wi-Fi survivors)
            void client.resumePausedMutations();
          }}
        >
          <ToastProvider>
            {children}
            <ServiceWorkerRegister />
          </ToastProvider>
        </PersistQueryClientProvider>
      </ClientGate>
    </MotionProvider>
  );
}
