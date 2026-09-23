import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: a minimal server.js plus only the node_modules it needs, so the
  // Docker runtime image doesn't ship the full dependency tree.
  output: "standalone",
};

export default nextConfig;
