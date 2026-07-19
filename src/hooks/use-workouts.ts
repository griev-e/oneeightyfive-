"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonBody } from "./fetch-json";
import { useToast } from "@/components/ui/toast";
import type { ExerciseRecords } from "@/lib/stats";

export type Exercise = {
  id: string;
  name: string;
  isSeeded: boolean;
  sortOrder: number;
};

export type WorkoutSet = {
  id: string;
  date: string;
  exerciseId: string;
  weightLbs: number;
  reps: number;
  setNumber: number;
};

export type ExerciseHistory = {
  lastSession: { date: string; sets: { weightLbs: number; reps: number }[] } | null;
  records: ExerciseRecords | null;
  recent: { date: string; sets: number; topWeight: number; topReps: number }[];
};

export function useExercises() {
  return useQuery({
    queryKey: ["exercises"],
    queryFn: () => fetchJson<Exercise[]>("/api/exercises"),
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<Exercise>("/api/exercises", { method: "POST", ...jsonBody({ name }) }),
    onSuccess: (exercise) => {
      qc.setQueryData<Exercise[]>(["exercises"], (old = []) => [...old, exercise]);
    },
    onError: (e) => {
      toast.show(
        e instanceof Error && e.message.includes("409")
          ? "That exercise already exists"
          : "Couldn't add — try again",
      );
    },
  });
}

export function useArchiveExercise() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`/api/exercises/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["exercises"] });
      const prev = qc.getQueryData<Exercise[]>(["exercises"]);
      qc.setQueryData<Exercise[]>(["exercises"], (old = []) =>
        old.filter((e) => e.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["exercises"], ctx?.prev);
      toast.show("Couldn't archive — try again");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useSets(date: string) {
  return useQuery({
    queryKey: ["sets", date],
    queryFn: () => fetchJson<WorkoutSet[]>(`/api/sets?date=${date}`),
  });
}

export function useExerciseHistory(exerciseId: string | null, today: string) {
  return useQuery({
    queryKey: ["exercise-history", exerciseId],
    queryFn: () =>
      fetchJson<ExerciseHistory>(
        `/api/exercise-history/${exerciseId}?today=${today}`,
      ),
    enabled: exerciseId !== null,
  });
}

type LogSetInput = { exerciseId: string; weightLbs: number; reps: number };

export function useLogSet(date: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    // the gym is the app's worst connectivity context — retry before rolling
    // back, and (via the mutationKey + lib/mutation-defaults) queue + replay
    // when fully offline
    mutationKey: ["log-set"],
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    mutationFn: (input: LogSetInput & { date: string }) =>
      fetchJson<WorkoutSet>("/api/sets", {
        method: "POST",
        ...jsonBody(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["sets", date] });
      const tmpId = `tmp-${crypto.randomUUID()}`;
      qc.setQueryData<WorkoutSet[]>(["sets", date], (old = []) => {
        const mine = old.filter((s) => s.exerciseId === input.exerciseId);
        const setNumber =
          mine.reduce((m, s) => Math.max(m, s.setNumber), 0) + 1;
        return [...old, { id: tmpId, setNumber, ...input }];
      });
      return { tmpId };
    },
    onSuccess: (saved, _input, ctx) => {
      qc.setQueryData<WorkoutSet[]>(["sets", date], (old = []) =>
        old.map((s) => (s.id === ctx.tmpId ? saved : s)),
      );
    },
    onError: (_e, _input, ctx) => {
      qc.setQueryData<WorkoutSet[]>(["sets", date], (old = []) =>
        old.filter((s) => s.id !== ctx?.tmpId),
      );
      toast.show("Couldn't save the set — try again");
    },
    onSettled: (_d, _e, input) => {
      void qc.invalidateQueries({ queryKey: ["sets", date] });
      void qc.invalidateQueries({ queryKey: ["exercise-history", input.exerciseId] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
    },
  });

  // date rides in the VARIABLES so a queued set replayed after a relaunch
  // still knows its app-day
  return {
    ...mutation,
    mutate: (input: LogSetInput, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ date, ...input }, options),
    mutateAsync: (
      input: LogSetInput,
      options?: Parameters<typeof mutation.mutateAsync>[1],
    ) => mutation.mutateAsync({ date, ...input }, options),
  };
}

export function useUpdateSet(date: string, exerciseId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; weightLbs?: number; reps?: number }) =>
      fetchJson<{ ok: true }>(`/api/sets/${id}`, {
        method: "PATCH",
        ...jsonBody(patch),
      }),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["sets", date] });
      const prev = qc.getQueryData<WorkoutSet[]>(["sets", date]);
      qc.setQueryData<WorkoutSet[]>(["sets", date], (old = []) =>
        old.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["sets", date], ctx?.prev);
      toast.show("Couldn't save — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["sets", date] });
      void qc.invalidateQueries({ queryKey: ["exercise-history", exerciseId] });
    },
  });
}

export function useDeleteSet(date: string, exerciseId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`/api/sets/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["sets", date] });
      const prev = qc.getQueryData<WorkoutSet[]>(["sets", date]);
      qc.setQueryData<WorkoutSet[]>(["sets", date], (old = []) =>
        old.filter((s) => s.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["sets", date], ctx?.prev);
      toast.show("Couldn't delete — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["sets", date] });
      void qc.invalidateQueries({ queryKey: ["exercise-history", exerciseId] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
    },
  });
}
