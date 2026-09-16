import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle, so the production image doesn't need
  // node_modules and stays small.
  output: "standalone",

  // The dev-only badge defaults to the bottom-left corner, which on a phone
  // sits directly on top of the Home tab. Top-left overlaps only the logo.
  // Set `devIndicators: false` to hide it entirely; error reporting is
  // separate and stays either way.
  devIndicators: { position: "top-left" },

  // Previewing on a phone means the dev server is reached from something other
  // than localhost — a LAN address, or a tunnel hostname from `npm run share`.
  // Next warns on those now and will block them later; listing them keeps the
  // phone workflow working either way.
  allowedDevOrigins: [
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
