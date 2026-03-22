import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run-next.mjs <dev|start>");
  process.exit(1);
}

if (existsSync(".env")) {
  config({ path: ".env" });
}
if (existsSync(".env.local")) {
  config({ path: ".env.local", override: true });
}

const nextBin = resolve(process.cwd(), "node_modules/next/dist/bin/next");
const args = [nextBin, mode];
if (mode === "dev") {
  // Listen on all interfaces so other devices on the LAN can connect.
  const host = process.env.NEXT_DEV_HOST?.trim() || "0.0.0.0";
  args.push("-H", host);

  // HTTPS is required for camera/getUserMedia on non-localhost devices (iPad, phone).
  // Next.js generates a self-signed cert on first run. Disable with NEXT_DEV_HTTPS=false.
  const wantHttps = (process.env.NEXT_DEV_HTTPS ?? "true").trim().toLowerCase();
  if (wantHttps !== "false" && wantHttps !== "0") {
    args.push("--experimental-https");
  }
}
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
