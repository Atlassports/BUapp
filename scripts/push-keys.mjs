/**
 * Generates a VAPID key pair for Web Push.
 *
 *   npm run push:keys
 *
 * Put both values in .env. Without them, notifications still appear in the
 * in-app activity feed — they just don't reach the phone's notification centre.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\nAdd these to your .env:\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:you@yourdomain.com\n`);
console.log("Keep the private key secret. Changing it invalidates every existing subscription.\n");
