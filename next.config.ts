import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint is enforced separately (`pnpm lint` in CI); don't let a style nit
  // fail a production build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
