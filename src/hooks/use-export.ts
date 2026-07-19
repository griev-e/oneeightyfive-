"use client";

import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { HttpError } from "./fetch-json";

/**
 * Downloads the full-history backup from /api/export as a dated JSON file.
 * The blob dance (instead of a plain <a href>) keeps the standalone PWA on
 * its page — iOS treats a navigation-download as leaving the app.
 */
export function useExportData(date: string) {
  const toast = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/export");
      if (res.status === 401) {
        window.location.replace("/lock");
        throw new Error("locked");
      }
      if (!res.ok) throw new HttpError(res.status, "/api/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `surplus-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    onError: () => toast.show("Couldn't export — try again"),
  });
}
