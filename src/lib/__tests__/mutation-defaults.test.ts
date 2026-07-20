import { describe, expect, it } from "vitest";
import { QueryClient, type Mutation } from "@tanstack/react-query";
import {
  QUEUED_MUTATION_KEYS,
  isQueuedMutationKey,
  registerMutationDefaults,
  shouldPersistMutation,
} from "../mutation-defaults";

type AnyMutation = Mutation<unknown, Error, unknown, unknown>;

const stub = (isPaused: boolean, mutationKey?: unknown) =>
  ({ state: { isPaused }, options: { mutationKey } }) as unknown as AnyMutation;

describe("isQueuedMutationKey", () => {
  it("accepts exactly the three replayable creates", () => {
    for (const key of QUEUED_MUTATION_KEYS) {
      expect(isQueuedMutationKey([key])).toBe(true);
    }
  });

  it("rejects everything else", () => {
    expect(isQueuedMutationKey(undefined)).toBe(false);
    expect(isQueuedMutationKey(null)).toBe(false);
    expect(isQueuedMutationKey("log-food")).toBe(false);
    expect(isQueuedMutationKey([])).toBe(false);
    expect(isQueuedMutationKey([123])).toBe(false);
    expect(isQueuedMutationKey(["update-food"])).toBe(false);
    expect(isQueuedMutationKey(["delete-set"])).toBe(false);
  });
});

describe("shouldPersistMutation", () => {
  it("requires BOTH a paused state and a registered queue key", () => {
    expect(shouldPersistMutation(stub(true, ["log-set"]))).toBe(true);
    expect(shouldPersistMutation(stub(false, ["log-set"]))).toBe(false);
    expect(shouldPersistMutation(stub(true, ["update-food"]))).toBe(false);
    expect(shouldPersistMutation(stub(true, undefined))).toBe(false);
  });
});

describe("registerMutationDefaults", () => {
  it("gives every queued create the same retry + backoff", () => {
    const qc = new QueryClient();
    registerMutationDefaults(qc);
    for (const key of QUEUED_MUTATION_KEYS) {
      const defaults = qc.getMutationDefaults([key]);
      expect(defaults.retry).toBe(3);
      const delay = defaults.retryDelay as (attempt: number) => number;
      expect(delay(0)).toBe(1000);
      expect(delay(1)).toBe(2000);
      expect(delay(10)).toBe(8000); // capped
      expect(typeof defaults.mutationFn).toBe("function");
    }
  });
});
