import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static HTML export
  output: "export",
  // Use trailing slashes to make exported paths predictable
  trailingSlash: true,
};

export default nextConfig;
