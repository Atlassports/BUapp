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
import { connect } from "node:net";
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

/**
 * A tunnel is a doorway to a server, not a server. Pointing one at a port
 * nothing is listening on produces a link that answers "Bad Gateway" from the
 * phone, with nothing on screen explaining why — so check first.
 */
function isServerRunning(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port: Number(port) });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

if (!(await isServerRunning(PORT))) {
  console.log(`\nNothing is running on port ${PORT}, so there's nothing to share yet.`);
  console.log("\nThe tunnel only forwards to the app — it doesn't start it. You need both,");
  console.log("in two terminal tabs:\n");
  console.log("    Tab 1:   npm run dev      ← leave this running");
  console.log("    Tab 2:   npm run share    ← this one\n");
  console.log("Open a new tab with Cmd+T, start the app there, then run this again.\n");
  process.exit(1);
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
