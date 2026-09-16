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
 *   npm i @capacitor/core @capacitor/ios @capacitor/push-notifications \
 *        @capacitor/app @capacitor/camera @capacitor/geolocation @capacitor/haptics
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

  /*
   * Info.plist needs a usage string for each of these or iOS kills the app the
   * moment it asks. Xcode → target → Info, or edit ios/App/App/Info.plist:
   *
   *   NSCameraUsageDescription
   *     Take photos of what needs doing, and show work is finished.
   *
   *   NSPhotoLibraryUsageDescription
   *     Attach a photo you already have to a task.
   *
   *   NSPhotoLibraryAddUsageDescription
   *     Save a photo from a task to your library.
   *
   *   NSLocationWhenInUseUsageDescription
   *     Show tasks near where you are right now, instead of where you signed up.
   *
   * Apple reads these during review. Write what the app actually does with the
   * permission — a vague string is a rejection on its own.
   */
};

export default config;
