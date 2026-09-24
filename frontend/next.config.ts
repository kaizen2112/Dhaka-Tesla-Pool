import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: a minimal server.js plus only the node_modules it needs, so the
  // Docker runtime image doesn't ship the full dependency tree.
  output: "standalone",
  // The "N" dev badge sits over the phone bottom tab bar. Build and runtime errors still show.
  devIndicators: false,
};

export default nextConfig;
