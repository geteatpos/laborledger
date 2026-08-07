import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/wasm/zxing_reader.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          // Not immutable: public/wasm is synced from node_modules on each build;
          // a year-long immutable cache would pin stale binaries after upgrades.
          { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }
        ]
      }
    ];
  }
};

export default nextConfig;
