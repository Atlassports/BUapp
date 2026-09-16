/**
 * Puts the local dev server on a public HTTPS URL so you can open it on a
 * phone — yours or someone else's — without deploying anything.
 *
 *   npm run share
 *
 * The URL lives only as long as this command runs, and traffic is served by
 * your laptop. It's for showing people, not for launching.
 */
import { spawn, spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";

const PORT = process.env.PORT ?? "3000";

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

const lan = lanAddress();
if (lan) {
  console.log(`\nOn the same Wi-Fi, your phone can already reach:\n    http://${lan}:${PORT}\n`);
  console.log("If that doesn't load, the network is isolating devices from each other");
  console.log("(common on school and office Wi-Fi). The public link below always works.\n");
}

const hasCloudflared = spawnSync("which", ["cloudflared"], { stdio: "ignore" }).status === 0;

if (!hasCloudflared) {
  console.log("Install cloudflared once for a reliable public link:\n");
  console.log("    brew install cloudflared\n");
  console.log("Then run `npm run share` again.\n");
  console.log("No Homebrew? This works without installing anything, but is slower");
  console.log("and occasionally flaky:\n");
  console.log(`    npx localtunnel --port ${PORT}\n`);
  process.exit(0);
}

console.log(`Opening a public link to localhost:${PORT} — press Ctrl+C to close it.\n`);

const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`], {
  stdio: "inherit",
});
tunnel.on("exit", (code) => process.exit(code ?? 0));
