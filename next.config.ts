import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tsc is the real gate; lint style rules (apostrophes in copy etc.) must not block builds
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? `local-${Date.now().toString(36)}`,
  },
};

export default nextConfig;
