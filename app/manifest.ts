import type { MetadataRoute } from "next";

/**
 * Makes "Add to Home Screen" produce something that behaves like an installed
 * app: its own icon, no browser chrome, and the scarlet status bar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sidekick — BU",
    short_name: "Sidekick",
    description:
      "A verified BU-only marketplace. Post anything you need done, set a price and a deadline, and have nearby verified students claim it.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f6f7",
    theme_color: "#cc0000",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
