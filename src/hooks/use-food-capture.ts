"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { fetchJson, jsonBody } from "./fetch-json";
import type { AnalyzedFood } from "@/lib/food-ai";
import type { CatalogFood } from "@/lib/food-catalog";

type CatalogResponse = { foods: CatalogFood[] };
type AnalysisResponse = { food: AnalyzedFood };

export function useCatalogSearch(query: string) {
  return useQuery({
    queryKey: ["food-catalog", query],
    queryFn: () =>
      fetchJson<CatalogResponse>(
        `/api/food-search?query=${encodeURIComponent(query)}`,
      ),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
  });
}

export function useBarcodeLookup() {
  const toast = useToast();
  return useMutation({
    mutationFn: (barcode: string) =>
      fetchJson<CatalogResponse>(
        `/api/food-search?barcode=${encodeURIComponent(barcode)}`,
      ),
    onError: () => toast.show("Couldn't look up that barcode"),
  });
}

export function useDescribeFood() {
  const toast = useToast();
  return useMutation({
    mutationFn: (description: string) =>
      fetchJson<AnalysisResponse>("/api/food-ai/describe", {
        method: "POST",
        ...jsonBody({ description }),
      }),
    onError: () => toast.show("Couldn't estimate that — try more detail"),
  });
}

export function useAnalyzeFoodImage() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      file,
      mode,
    }: {
      file: File;
      mode: "label" | "meal-photo";
    }) => {
      const form = new FormData();
      form.set("image", file);
      form.set("mode", mode);
      return fetchJson<AnalysisResponse>("/api/food-ai/image", {
        method: "POST",
        body: form,
      });
    },
    onError: () => toast.show("Couldn't read that image — try again"),
  });
}

export function useTranscribeFood() {
  const toast = useToast();
  return useMutation({
    mutationFn: (audio: Blob) => {
      const extension = audio.type.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.set(
        "audio",
        new File([audio], `food.${extension}`, {
          type: audio.type || "audio/webm",
        }),
      );
      return fetchJson<AnalysisResponse & { transcript: string }>(
        "/api/food-ai/transcribe",
        { method: "POST", body: form },
      );
    },
    onError: () => toast.show("Couldn't understand that recording"),
  });
}
