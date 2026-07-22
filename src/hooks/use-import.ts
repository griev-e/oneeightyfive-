"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { fetchJson, HttpError, jsonBody } from "./fetch-json";

/**
 * The restore half of the backup story: POSTs a parsed /api/export document
 * to /api/import, then refetches everything — the whole cache is stale by
 * definition after a restore.
 */
export function useImportData() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (parsed: unknown) =>
      fetchJson<{ ok: true; counts: Record<string, number> }>("/api/import", {
        method: "POST",
        ...jsonBody(parsed),
      }),
    onSuccess: () => {
      void qc.invalidateQueries();
      // announcing success breaks the usual rule, but a full restore with no
      // acknowledgement reads as "did anything happen?"
      toast.show("Backup restored");
    },
    onError: (error) =>
      toast.show(
        error instanceof HttpError && error.status === 400
          ? "That file isn't a Surplus backup"
          : "Couldn't restore — try again",
      ),
  });
}
