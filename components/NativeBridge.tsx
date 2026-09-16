"use client";

import { useEffect } from "react";

/**
 * Connects the native iOS shell to the server.
 *
 * In a browser this does nothing — Capacitor isn't present, so every branch
 * falls through. Inside the App Store build it registers for APNs and hands
 * the device token to the server, which is what makes real push notifications
 * possible without an App Store review for every message.
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    PushNotifications?: {
      requestPermissions: () => Promise<{ receive: string }>;
      register: () => Promise<void>;
      addListener: (event: string, handler: (data: unknown) => void) => void;
      removeAllDeliveredNotifications?: () => Promise<void>;
    };
  };
};

export function NativeBridge() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    const push = cap.Plugins?.PushNotifications;
    if (!push) return;

    let cancelled = false;

    (async () => {
      const permission = await push.requestPermissions();
      if (cancelled || permission.receive !== "granted") return;

      push.addListener("registration", (data) => {
        const token = (data as { value?: string }).value;
        if (!token) return;
        void fetch("/api/devices/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform: "ios" }),
        });
      });

      push.addListener("registrationError", (err) => {
        console.error("APNs registration failed", err);
      });

      // Tapping a notification should land on the thing it was about.
      push.addListener("pushNotificationActionPerformed", (event) => {
        const link = (event as { notification?: { data?: { link?: string } } }).notification?.data?.link;
        if (link) window.location.assign(link);
      });

      await push.register();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
