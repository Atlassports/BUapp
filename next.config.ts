import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle, so the production image doesn't need
  // node_modules and stays small.
  output: "standalone",
};

export default nextConfig;
