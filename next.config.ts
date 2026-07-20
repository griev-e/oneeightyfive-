import type { NextConfig } from "next";

// Next.js 16 no longer runs ESLint during `next build`, so there's nothing
// to opt out of here — keep the config minimal.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "x-content-type-options", value: "nosniff" },
          { key: "x-frame-options", value: "DENY" },
          { key: "referrer-policy", value: "same-origin" },
          {
            key: "strict-transport-security",
            value: "max-age=63072000; includeSubDomains",
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
