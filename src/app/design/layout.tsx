import { notFound } from "next/navigation";

// The design gallery is a development tool — it 404s in production unless
// explicitly re-enabled (DESIGN_GALLERY=1) for an on-device review session.
export default function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DESIGN_GALLERY !== "1"
  ) {
    notFound();
  }
  return children;
}
