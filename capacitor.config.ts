import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS shell for the App Store build.
 *
 * The app is served from your deployment rather than bundled, so shipping a
 * fix does not require an App Store review — only changes to native capability
 * do. `server.url` must be HTTPS and must point at the deployed instance;
 * Apple rejects builds that load over plain HTTP.
 *
 * Setup on your Mac, once:
 *   npm i -D @capacitor/cli
 *   npm i @capacitor/core @capacitor/ios @capacitor/push-notifications @capacitor/app
 *   npx cap add ios
 *   npx cap open ios
 */
const config: CapacitorConfig = {
  appId: "edu.bu.sidekick",
  appName: "Sidekick",
  webDir: "public",
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://sidekick-bu.fly.dev",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#f6f6f7",
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
