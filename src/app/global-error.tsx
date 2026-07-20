"use client";

import { GeistSans } from "geist/font/sans";
import "./globals.css";

/**
 * Root-layout error boundary — replaces the entire document when the root
 * itself throws, so it must ship its own html/body and styles.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  console.error(error);
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-8 text-center">
          <h1 className="type-title text-text-primary">Something hiccuped</h1>
          <p className="type-body mt-2 max-w-xs text-text-secondary">
            Your data is safe — the app just failed to draw.
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
      </body>
    </html>
  );
}
