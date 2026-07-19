import Link from "next/link";

/** Unknown tab slugs already redirect to “/” — this covers everything else. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-8 text-center">
      <h1 className="type-title text-text-primary">Nothing here</h1>
      <p className="type-body mt-2 max-w-xs text-text-secondary">
        That page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="type-headline mt-8 flex h-13 items-center rounded-lg bg-text-primary px-6 text-canvas active:bg-text-primary/90"
      >
        Back to Today
      </Link>
    </main>
  );
}
