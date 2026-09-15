import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: { optimizePackageImports: [] },
};

export default nextConfig;
