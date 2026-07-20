"use client";

import { useEffect } from "react";

/**
 * Segment error boundary — a render throw used to white-screen the whole
 * PWA. Deliberately dependency-light (no motion, no ui/ imports): the
 * boundary must not share a failure mode with what it catches.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-8 text-center">
      <h1 className="type-title text-text-primary">Something hiccuped</h1>
      <p className="type-body mt-2 max-w-xs text-text-secondary">
        Your data is safe — this screen just failed to draw.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="type-headline mt-8 h-13 rounded-lg bg-text-primary px-6 text-canvas active:bg-text-primary/90"
        style={{ touchAction: "manipulation" }}
      >
        Try again
      </button>
    </main>
  );
}
