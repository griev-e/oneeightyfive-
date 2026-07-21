import type { NextConfig } from "next";

// Next.js 16 no longer runs ESLint during `next build`, so there's nothing
// to opt out of here — keep the config minimal.

// Everything the client touches is same-origin (all data flows through
// /api/*, fonts and icons ship in the bundle, no external images), so the
// policy can stay strict. script-src needs 'unsafe-inline' for Next's
// bootstrap inline scripts; 'unsafe-eval' is dev-only (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "content-security-policy", value: csp },
          { key: "x-content-type-options", value: "nosniff" },
          { key: "x-frame-options", value: "DENY" },
          { key: "referrer-policy", value: "same-origin" },
          { key: "cross-origin-opener-policy", value: "same-origin" },
          { key: "cross-origin-resource-policy", value: "same-origin" },
          {
            key: "strict-transport-security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // the app itself uses the camera (barcode/photos) and mic (voice)
          {
            key: "permissions-policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
