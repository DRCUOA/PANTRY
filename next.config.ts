import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy — without nonces so pages can stay statically
 * optimised. 'unsafe-inline' is required for Tailwind / style tags.
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' https://world.openfoodfacts.org https://fastly.jsdelivr.net;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`
  .replace(/\n/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  // Docker: produce a self-contained .next/standalone folder
  output: "standalone",

  // LAN access during development
  allowedDevOrigins: ["192.168.1.*"],
  devIndicators: false,

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
        ],
      },
    ];
  },
};

export default nextConfig;
