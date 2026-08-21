import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run without the full node_modules tree. Required for the
  // lean Heroku container image (see apps/console/Dockerfile).
  output: "standalone",
};

export default nextConfig;
